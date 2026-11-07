/*
 * @Description: 一次性迁移：把线上 story 文档里的旧分组框语法替换为标签语法
 *   - 框 / { … } / 结束框  →  标签 N 色=#... … 结束标签（N 为该剧本中框的出现顺序，从 1 开始）
 *   - 同时改写指向框标题的跳转 / 调用 / 检测目标
 *   - 默认只做转换与校验，不写回服务端；加 --write 且提供管理员 token（hex）才写回
 * 运行：
 *   bun tmp/migrate-story-boxes.cjs                 # 只转换 + 校验，输出到系统临时目录
 *   $env:STORY_TOKEN_HEX='...'; bun tmp/migrate-story-boxes.cjs --write
 *   bun tmp/migrate-story-boxes.cjs --file story.json [--out out.json] [--write]
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const msgpack = require('msgpack-lite');

const STORY_KEY = 'story';
const LEVEL_KEYS = ['level', 'title', 'script', 'stats', 'updated_at', 'creator'];

// ---------- 载入剧情解析器 ----------
const loadStory = () => {
    const file = path.resolve(__dirname, '..', 'js', 'global', 'story.cjs');
    const text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    const module = { exports: {} };
    new Function('module', 'exports', text)(module, module.exports);
    return module.exports;
};
const { StoryScript } = loadStory();

// ---------- 线上加密 API ----------
global.window = {};
const apiSrc = fs.readFileSync(path.resolve(__dirname, '..', 'risk', 'api.cjs'), 'utf8').replace(/\r?\nverf\(\);\r?\n/, '\n');
new Function('window', apiSrc)(global.window);
const { encrypt, decrypt } = global.window.RiskExports.Api;

const call = async (route, params) => {
    const body = new Uint8Array(encrypt(Array.from(msgpack.encode(params))));
    const response = await fetch(`https://online.siziqi.net${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body
    });
    const raw = Array.from(new Uint8Array(await response.arrayBuffer()));
    return msgpack.decode(decrypt(raw));
};

// ---------- 框 → 标签 ----------
const COLOR_TOKEN_RE = /色\s*[=:]\s*\S+/;
const BOX_OPEN_RE = /^([ \t]*)\{\s*(.*?)\s*$/;
const BOX_OPEN_LEGACY_RE = /^([ \t]*)框(?:\s+(.*))?$/;
const BOX_CLOSE_RE = /^([ \t]*)\}\s*$/;
const BOX_CLOSE_LEGACY_RE = /^([ \t]*)(?:结束框|框结束)\s*$/;

const boxTitle = (raw) => String(raw || '').split(/\s+/).filter(Boolean).every((token) => !/^色\s*[=:]/.test(token))
    ? String(raw || '').replace(COLOR_TOKEN_RE, '').trim()
    : '';

/**
 * 把一段剧本里的旧框语法替换为标签语法
 * @param {string} script 原剧本
 * @return {{script: string, from: string, boxes: {ordinal: number, title: string}[], renames: Map<string, string>}}
 */
const convertBoxes = (script) => {
    const text = String(script == null ? '' : script);
    const crlf = /\r\n/.test(text);
    const lines = text.split(/\r?\n/);
    const boxes = [];
    const renames = new Map();
    const out = [];
    let ordinal = 0;
    lines.forEach((line) => {
        let match = BOX_OPEN_RE.exec(line) || BOX_OPEN_LEGACY_RE.exec(line);
        if (match) {
            ordinal += 1;
            const indent = match[1] || '';
            const rest = match[2] || '';
            const color = (COLOR_TOKEN_RE.exec(rest) || [''])[0];
            const title = rest.replace(COLOR_TOKEN_RE, '').trim();
            boxes.push({ 'ordinal': ordinal, 'title': title });
            if (title && !renames.has(title)) renames.set(title, String(ordinal));
            out.push(`${indent}标签 ${ordinal}${color ? ` ${color}` : ''}`);
            return;
        }
        if (BOX_CLOSE_RE.test(line) || BOX_CLOSE_LEGACY_RE.test(line)) {
            const indent = (BOX_CLOSE_RE.exec(line) || BOX_CLOSE_LEGACY_RE.exec(line))[1] || '';
            out.push(`${indent}结束标签`);
            return;
        }
        out.push(line);
    });
    return { 'script': out.join(crlf ? '\r\n' : '\n'), 'boxes': boxes, 'renames': renames, 'from': text };
};

/**
 * 把一行里引用的目标名替换为新标签名
 * @param {string} line 单行
 * @param {Map<string, string>} renames 旧框标题 -> 新标签名
 * @return {{line: string, changed: string[]}}
 */
const rewriteTarget = (line, renames) => {
    if (!renames.size || !/->|调用|检测|步数对话/.test(line)) return { 'line': line, 'changed': [] };
    const changed = [];
    const replace = (name) => {
        const key = String(name || '').trim();
        if (renames.has(key)) { changed.push(key); return renames.get(key); }
        return name;
    };
    let result = line;
    result = result.replace(/(->\s*)([^\s|,]+(?:\s+[^\s|,]+)*)$/, (all, prefix, target) => `${prefix}${replace(target)}`);
    result = result.replace(/^(\s*调用\s+)([^\s]+)$/, (all, prefix, target) => `${prefix}${replace(target)}`);
    result = result.replace(/(步数对话\s*=\s*|\|)([^:|]+):/g, (all, prefix, target) => `${prefix}${replace(target)}:`);
    return { 'line': result, 'changed': changed };
};

// ---------- 迁移后语义校验 ----------
const normalize = (script) => {
    const parsed = StoryScript.parse(script);
    const labelOrder = new Map();
    const walk = (nodes) => nodes.forEach((node) => {
        if (node.type === 'label' && node.name && !labelOrder.has(node.name)) labelOrder.set(node.name, `L${labelOrder.size + 1}`);
    });
    walk(parsed.nodes || []);
    const fixTarget = (target) => (labelOrder.has(target) ? labelOrder.get(target) : target);
    const clean = (nodes) => (nodes || []).map((node) => {
        const item = { ...node };
        ['indent', 'lineStart', 'lineEnd', 'color', 'block', 'legacy_box', 'body', 'from_cond', 'consumed'].forEach((key) => delete item[key]);
        if (item.type === 'label' || item.type === 'label_end') item.name = fixTarget(item.name);
        if (item.target) item.target = fixTarget(item.target);
        if (item.config) {
            item.config = { ...item.config };
            ['detections', 'step_detections'].forEach((key) => {
                if (Array.isArray(item.config[key])) item.config[key] = item.config[key].map((entry) => ({ ...entry, 'target': fixTarget(entry.target) }));
            });
        }
        ['detections', 'step_detections'].forEach((key) => {
            if (Array.isArray(item[key])) item[key] = item[key].map((entry) => ({ ...entry, 'target': fixTarget(entry.target) }));
        });
        return item;
    });
    return { 'errors': parsed.errors, 'nodes': clean(parsed.nodes), 'labelOrder': labelOrder };
};

const migrateLevel = (level) => {
    const original = String(level.script || '');
    const converted = convertBoxes(original);
    const lines = [];
    const renames = converted.renames;
    converted.script.split(/\r?\n/).forEach((line) => {
        const result = rewriteTarget(line, renames);
        lines.push(result.line);
    });
    const next = lines.join(/\r\n/.test(converted.script) ? '\r\n' : '\n');
    const before = normalize(original);
    const after = normalize(next);
    const problems = [];
    if (after.errors.length) problems.push(`迁移后解析错误：${after.errors.join('；')}`);
    if (JSON.stringify(before.nodes) !== JSON.stringify(after.nodes)) problems.push('迁移前后运行时节点不一致');
    return { ...converted, 'script': next, 'problems': problems, 'boxes': converted.boxes };
};

// ---------- 主流程 ----------
(async () => {
    const args = process.argv.slice(2);
    const flag = (name) => args.includes(name);
    const value = (name, fallback = '') => {
        const index = args.indexOf(name);
        return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
    };

    const file = value('--file');
    let doc;
    if (file) {
        doc = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    } else {
        const response = await call('/docs/query', { 'key': STORY_KEY });
        const raw = response && response.result && response.result.data;
        if (!raw) throw new Error(`读取 story 文档失败：${JSON.stringify(response).slice(0, 300)}`);
        doc = JSON.parse(raw);
    }

    const levels = Array.isArray(doc.levels) ? doc.levels : [];
    let changedLevels = 0;
    let boxCount = 0;
    let failed = 0;
    levels.forEach((level) => {
        const result = migrateLevel(level);
        if (!result.boxes.length) return;
        changedLevels += 1;
        boxCount += result.boxes.length;
        console.log(`关卡 ${level.level}「${level.title}」：${result.boxes.length} 个框 -> 标签 ${result.boxes.map((box) => box.ordinal).join(', ')}`);
        const titled = result.boxes.filter((box) => box.title);
        if (titled.length) console.log(`  原框标题：${titled.map((box) => `${box.title}=${box.ordinal}`).join('，')}`);
        if (result.problems.length) {
            failed += 1;
            result.problems.forEach((problem) => console.log(`  FAIL ${problem}`));
        }
        level.script = result.script;
    });
    console.log(`\n共 ${levels.length} 关，含框剧本 ${changedLevels} 关，框 ${boxCount} 个，校验失败 ${failed} 关`);

    const outFile = value('--out', path.join(os.tmpdir(), 'story-migrated.json'));
    fs.writeFileSync(outFile, JSON.stringify(doc, null, 4));
    console.log(`转换结果：${outFile}`);

    if (!flag('--write')) {
        console.log('未写回服务端（默认 dry-run）。确认无误后加 --write 并提供管理员 token。');
        return;
    }
    if (failed) throw new Error('存在校验失败的关卡，已终止写回');
    const tokenHex = value('--token-hex') || process.env.STORY_TOKEN_HEX || '';
    if (!/^[0-9a-fA-F]+$/.test(tokenHex)) throw new Error('缺少管理员 token（--token-hex 或 STORY_TOKEN_HEX，浏览器 localStorage.token 的 hex 值）');
    const token = Uint8Array.from(tokenHex.match(/../g).map((byte) => parseInt(byte, 16)));
    const response = await call('/docs/update', { 'token': token, 'key': STORY_KEY, 'data': JSON.stringify(doc) });
    console.log('写回结果：', JSON.stringify(response));
})();
