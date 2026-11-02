/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 剧情系统：剧本格式解析与播放状态机
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */

const BOARD_SIZE = 9;

// 对局节点允许的配置键（结束对局=... 为新写法，结束残局=... 兼容旧剧本）
const GAME_KEYS = ['残局码', '结束对局', '结束残局', '结束后', '步数对话', '刷草点', '刷草计划', '我方', '先手', '胜利', '失败', '平局'];
// 保留目标：直接结束剧情
const END_TARGETS = ['结束', '剧终'];
// 返回对局：中途触发的对话播完后回到当前对局继续下棋
const RESUME_KEYWORDS = ['继续对局', '返回对局'];
// 对局块结束标记：编辑器据此把「* 对局」到本行之间的内容包进同一个对局框
const GAME_END_KEYWORDS = ['结束此对局'];
// 分组框：仅用于编辑器分区（可自定义颜色），播放时按普通节点跳过
const BOX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// 条件分支：% IF 条件 -> 标签 / % ELSE -> 标签
// 条件取自"最近一次对局的结果"
const COND_MAP = { '胜利': 'win', 'win': 'win', '失败': 'lose', 'lose': 'lose', '平局': 'draw', 'draw': 'draw' };
const COND_TEXT = { 'win': '胜利', 'lose': '失败', 'draw': '平局' };

const SIDE_BLACK = 'black';
const SIDE_WHITE = 'white';

// 标注：红色动态箭头（指向界面区域）与旋转虚线圈（指向棋盘交叉点）
// 箭头锚点既可用内置名称，也可直接写界面元素 id（#game_p1_hp）
const MARK_ANCHORS = ['名字', '棋子颜色', '生命值', '信息', '刷草点', '棋盘', '我方', '对手'];
const MARK_KIND_MAP = { '箭头': 'arrow', '圈': 'circle', '清除': 'clear' };

/**
 * @description: 归一化阵营写法
 * @param {string} value
 * @return {'black' | 'white' | null}
 */
const toSide = (value) => {
    const text = String(value == null ? '' : value).trim().toLowerCase();
    if (!text) return null;
    if (text === '黑' || text === 'black' || text === 'b' || text === '1') return SIDE_BLACK;
    if (text === '白' || text === 'white' || text === 'w' || text === '0') return SIDE_WHITE;
    return null;
};

/**
 * @description: 解析刷草点字符串：4,4;5,4;6,5
 * @param {string} value
 * @return {[number, number][]}
 */
const parsePoints = (value) => {
    const result = [];
    String(value == null ? '' : value).split(';').forEach((chunk) => {
        const text = chunk.trim();
        if (!text) return;
        const parts = text.split(',');
        if (parts.length < 2) return;
        const x = Number.parseInt(parts[0], 10);
        const y = Number.parseInt(parts[1], 10);
        if (!Number.isInteger(x) || !Number.isInteger(y)) return;
        if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return;
        result.push([x, y]);
    });
    return result;
};

/**
 * @description: 解析单个棋盘交叉点：4,4
 * @param {string} value
 * @return {[number, number] | null}
 */
const parseCell = (value) => {
    const parts = String(value == null ? '' : value).trim().split(',');
    if (parts.length < 2) return null;
    const x = Number.parseInt(parts[0], 10);
    const y = Number.parseInt(parts[1], 10);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return null;
    return [x, y];
};

/**
 * @description: 解析刷草计划：3:4,4;5,4|9:2,2
 * 每条计划形如 回合:坐标;坐标，多条用 | 分隔；坐标数即该回合刷草的数量。
 * @param {string} value
 * @return {{turn: number, cells: [number, number][]}[]}
 */
const parseSchedule = (value) => {
    const result = [];
    String(value == null ? '' : value).split('|').forEach((chunk) => {
        const text = chunk.trim();
        if (!text) return;
        const split = text.indexOf(':');
        if (split < 0) return;
        const turn = Number.parseInt(text.slice(0, split), 10);
        if (!Number.isInteger(turn) || turn < 0) return;
        const cells = parsePoints(text.slice(split + 1));
        if (cells.length === 0) return;
        result.push({ turn, cells });
    });
    return result;
};

/**
 * @description: 归一化对局配置
 * @param {object} raw
 * @return {object}
 */
const normalizeGameConfig = (raw) => {
    const source = raw || {};
    const pointsText = String(source['刷草点'] == null ? '' : source['刷草点']);
    const scheduleText = String(source['刷草计划'] == null ? '' : source['刷草计划']);
    const selfText = String(source['我方'] == null ? '' : source['我方']).trim();
    const firstText = String(source['先手'] == null ? '' : source['先手']).trim();
    // 结束对局条件：优先取新键 结束对局，回退旧键 结束残局（兼容旧剧本）
    const endSource = source['结束对局'] == null ? source['结束残局'] : source['结束对局'];
    const endText = String(endSource == null ? '' : endSource).trim();
    const dialogueText = String(source['步数对话'] == null ? '' : source['步数对话']);
    // 结束后：对局结束时显示什么、之后去哪。继续 = 显示「继续」并直接进入下一段剧情
    const afterText = String(source['结束后'] == null ? '' : source['结束后']).trim();
    const endSteps = /^步数\s*[:：]\s*(\d+)$/.exec(endText);
    return {
        'archive': String(source['残局码'] == null ? '' : source['残局码']).trim(),
        'end_text': endText,
        'end_kind': endSteps ? 'steps' : endText === '胜负' ? 'outcome' : '',
        'end_steps': endSteps ? Math.max(1, Number(endSteps[1])) : 0,
        'post': afterText === '继续' ? 'continue' : afterText === '结果' ? 'result' : '',
        'post_text': afterText,
        'dialogues': parseDialogues(dialogueText),
        'dialogues_text': dialogueText,
        'points': parsePoints(pointsText),
        'points_text': pointsText,
        'schedule': parseSchedule(scheduleText),
        'schedule_text': scheduleText,
        'self': selfText ? toSide(selfText) : null,
        'self_text': selfText,
        'first': firstText ? toSide(firstText) : null,
        'first_text': firstText,
        'win': String(source['胜利'] == null ? '' : source['胜利']).trim(),
        'lose': String(source['失败'] == null ? '' : source['失败']).trim(),
        'draw': String(source['平局'] == null ? '' : source['平局']).trim(),
    };
};

/**
 * @description: 把刷草点数组还原成文本
 * @param {[number, number][]} points
 * @return {string}
 */
const pointsToText = (points) => (points || []).map((point) => `${point[0]},${point[1]}`).join(';');

/**
 * @description: 把刷草计划数组还原成文本
 * @param {{turn: number, cells: [number, number][]}[]} schedule
 * @return {string}
 */
const scheduleToText = (schedule) => (schedule || []).map((entry) => `${entry.turn}:${pointsToText(entry.cells)}`).join('|');

/**
 * @description: 解析步数对话：3:标签A|6:标签B
 * 每条形如 第几手:标签，多条用 | 分隔；第几手按落子总手数计数（玩家第一步=1、AI 应手=2、玩家第二次=3），可在任意步数触发。
 * @param {string} value
 * @return {{step: number, target: string}[]}
 */
const parseDialogues = (value) => {
    const result = [];
    String(value == null ? '' : value).split('|').forEach((chunk) => {
        const match = /^(\d+)\s*[:：]\s*(.+?)\s*$/.exec(chunk.trim());
        if (!match) return;
        const step = Number.parseInt(match[1], 10);
        if (!Number.isInteger(step) || step < 1) return;
        result.push({ 'step': step, 'target': match[2] });
    });
    return result;
};

/**
 * @description: 把步数对话数组还原成文本
 * @param {{step: number, target: string}[]} dialogues
 * @return {string}
 */
const dialoguesToText = (dialogues) => (dialogues || []).map((entry) => `${entry.step}:${entry.target}`).join('|');


class StoryScript {
    /**
     * @description: 解析剧本 DSL
     * @param {string} text
     * @return {{nodes: object[], labels: object, errors: string[]}}
     */
    static parse(text) {
        const nodes = [];
        const labels = {};
        const errors = [];
        const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
        let pending = null;

        lines.forEach((line, lineIndex) => {
            // 行首缩进（2 空格 = 1 级，Tab 按 2 空格计）仅用于编辑器排版，解析时照常 trim
            const expanded = line.replace(/\t/g, '  ');
            const indent = Math.min(8, Math.floor((expanded.length - expanded.trimStart().length) / 2));
            const text_ = expanded.trim();
            if (!text_ || text_.startsWith('#')) return;

            // 统一写入行首缩进，供编辑器回填时还原手动缩进
            const push = (node) => { node.indent = indent; nodes.push(node); return node; };

            // 选项行：- 文本 -> 标签
            const option = text_.match(/^-\s*(.+?)\s*->\s*(.+)$/);
            if (option && pending && pending.type === 'choice') {
                pending.options.push({ 'text': option[1].trim(), 'target': option[2].trim() });
                return;
            }

            // 对局配置行：键=值
            const config = text_.match(/^([^\s=]+)\s*=\s*(.*)$/);
            if (config && pending && pending.type === 'game' && GAME_KEYS.includes(config[1])) {
                pending.config_raw[config[1]] = config[2].trim();
                return;
            }

            // 对话框：[说话人] 台词 / [角色|表情] 台词
            const say = text_.match(/^\[([^\]]*)\]\s*(.*)$/);
            if (say) {
                const raw = say[1].trim();
                const split = raw.indexOf('|');
                const speaker = split < 0 ? raw : raw.slice(0, split).trim();
                const expression = split < 0 ? '' : raw.slice(split + 1).trim();
                push({ 'type': 'say', 'speaker': speaker, 'expression': expression, 'text': say[2].trim() });
                pending = null;
                return;
            }

            // 条件分支：% IF 胜利 -> 标签 / % ELSE -> 标签
            if (text_.startsWith('%')) {
                const body = text_.slice(1).trim();
                const arrow = body.indexOf('->');
                if (arrow < 0) { errors.push(`第 ${lineIndex + 1} 行条件分支缺少“-> 标签”：${text_}`); return; }
                const head = body.slice(0, arrow).trim();
                const target = body.slice(arrow + 2).trim();
                if (/^else$/i.test(head)) {
                    push({ 'type': 'cond', 'kind': 'else', 'condition': null, 'target': target });
                    pending = null;
                    return;
                }
                const stripped = head.replace(/^if\s*/i, '').trim();
                const condition = COND_MAP[stripped] || COND_MAP[stripped.toLowerCase()] || null;
                if (!condition) { errors.push(`第 ${lineIndex + 1} 行条件无效：${text_}（可用 胜利 / 失败 / 平局）`); return; }
                push({ 'type': 'cond', 'kind': 'if', 'condition': condition, 'target': target });
                pending = null;
                return;
            }

            if (text_.startsWith('?')) {
                // 选择节点可携带角色表情：? [角色|表情] 提示（与对话台词写法一致，可省略）
                let body = text_.slice(1).trim();
                let speaker = '';
                let expression = '';
                const face = body.match(/^\[([^\]]*)\]\s*(.*)$/);
                if (face) {
                    const raw = face[1].trim();
                    const split = raw.indexOf('|');
                    speaker = split < 0 ? raw : raw.slice(0, split).trim();
                    expression = split < 0 ? '' : raw.slice(split + 1).trim();
                    body = face[2].trim();
                }
                pending = push({ 'type': 'choice', 'speaker': speaker, 'expression': expression, 'prompt': body, 'options': [] });
                return;
            }

            if (text_.startsWith('*')) {
                pending = push({ 'type': 'game', 'title': text_.slice(1).trim(), 'config_raw': {} });
                return;
            }

            // 对局块结束标记：结束此对局（仅作分块边界，运行时按普通节点跳过）
            if (GAME_END_KEYWORDS.includes(text_)) {
                push({ 'type': 'game_end' });
                pending = null;
                return;
            }

            // 分组框：框 标题 色=#6f42c1 / 结束框（仅编辑器分区，播放时跳过）
            if (text_ === '结束框' || text_ === '框结束') {
                push({ 'type': 'box_end' });
                pending = null;
                return;
            }
            if (/^框(?:\s|$)/.test(text_)) {
                const tokens = text_.slice(1).trim().split(/\s+/).filter(Boolean);
                let color = null;
                const titleParts = [];
                tokens.forEach((token) => {
                    const matched = token.match(/^色=(.+)$/);
                    if (matched) { color = matched[1].trim(); return; }
                    titleParts.push(token);
                });
                push({ 'type': 'box', 'title': titleParts.join(' '), 'color': color });
                pending = null;
                return;
            }

            // 标注：@ 箭头 锚点 / @ 圈 4,4 / @ 清除（可选 色=#ff3b30）
            if (text_.startsWith('@')) {
                const tokens = text_.slice(1).trim().split(/\s+/).filter(Boolean);
                const kind = MARK_KIND_MAP[tokens[0]] || null;
                if (!kind) {
                    errors.push(`第 ${lineIndex + 1} 行标注类型无效：${text_}`);
                    return;
                }
                let color = null;
                const positional = [];
                tokens.slice(1).forEach((token) => {
                    const matched = token.match(/^色=(.+)$/);
                    if (matched) { color = matched[1].trim(); return; }
                    positional.push(token);
                });
                push({ 'type': 'mark', 'kind': kind, 'target': positional[0] || '', 'color': color });
                pending = null;
                return;
            }

            if (text_.startsWith(':')) {
                const name = text_.slice(1).trim();
                labels[name] = nodes.length;
                push({ 'type': 'label', 'name': name });
                pending = null;
                return;
            }

            if (text_.startsWith('->')) {
                push({ 'type': 'jump', 'target': text_.slice(2).trim() });
                pending = null;
                return;
            }

            if (END_TARGETS.includes(text_)) {
                push({ 'type': 'end' });
                pending = null;
                return;
            }

            // 继续对局：步数对话播完后回到当前对局
            if (RESUME_KEYWORDS.includes(text_)) {
                push({ 'type': 'resume' });
                pending = null;
                return;
            }

            errors.push(`第 ${lineIndex + 1} 行无法识别：${text_}`);
        });

        nodes.forEach((node) => {
            if (node.type === 'game') {
                node.config = normalizeGameConfig(node.config_raw);
                delete node.config_raw;
                return;
            }
            if (node.type === 'mark' && node.kind === 'circle') node.cell = parseCell(node.target);
        });

        return { nodes, labels, errors };
    }

    /**
     * @description: 校验剧本（结构、跳转目标、刷草点、对局配置）
     * @param {string} text
     * @return {string[]} 错误列表，空数组表示通过
     */
    static validate(text) {
        const { nodes, labels, errors } = StoryScript.parse(text);
        const result = [...errors];

        const hasTarget = (name) => Object.prototype.hasOwnProperty.call(labels, name) || END_TARGETS.includes(name);

        nodes.forEach((node, index) => {
            if (node.type === 'choice') {
                if (!node.options.length) result.push(`第 ${index + 1} 个节点的选项为空。`);
                node.options.forEach((item) => {
                    if (!item.text) result.push(`第 ${index + 1} 个节点存在空选项文字。`);
                    if (!hasTarget(item.target)) result.push(`选项“${item.text}”指向了不存在的标签：${item.target}`);
                });
            } else if (node.type === 'jump') {
                if (!hasTarget(node.target)) result.push(`跳转指向了不存在的标签：${node.target}`);
            } else if (node.type === 'cond') {
                if (!node.target) result.push(`第 ${index + 1} 个条件分支缺少跳转标签。`);
                else if (!hasTarget(node.target)) result.push(`条件分支指向了不存在的标签：${node.target}`);
            } else if (node.type === 'game') {
                const config = node.config;
                if (config.self_text && config.self === null) result.push(`对局“${node.title}”的“我方”不是黑/白：${config.self_text}`);
                if (config.first_text && config.first === null) result.push(`对局“${node.title}”的“先手”不是黑/白：${config.first_text}`);
                ['win', 'lose', 'draw'].forEach((key) => {
                    if (config[key] && !hasTarget(config[key])) result.push(`对局“${node.title}”的“${key}”指向了不存在的标签：${config[key]}`);
                });
                if (config.points_text && config.points.length === 0) result.push(`对局“${node.title}”的刷草点格式无效：${config.points_text}`);
                if (config.schedule_text && config.schedule.length === 0) result.push(`对局“${node.title}”的刷草计划格式无效：${config.schedule_text}（应形如 3:4,4;5,4|9:2,2）`);
                if (config.end_text && !config.end_kind) result.push(`对局“${node.title}”的“结束对局”格式无效：${config.end_text}（应为 胜负 或 步数:12）`);
                if (config.post_text && !config.post) result.push(`对局“${node.title}”的“结束后”格式无效：${config.post_text}（应为 结果 或 继续）`);
                if (config.dialogues_text && !config.dialogues.length) result.push(`对局“${node.title}”的“步数对话”格式无效：${config.dialogues_text}（应形如 3:标签|6:标签）`);
                (config.dialogues || []).forEach((item) => {
                    if (!hasTarget(item.target)) result.push(`对局“${node.title}”的步数对话指向了不存在的标签：${item.target}`);
                });
            } else if (node.type === 'mark') {
                if (node.kind === 'arrow') {
                    const anchor = String(node.target || '').trim();
                    if (!anchor) result.push(`第 ${index + 1} 个标注的箭头缺少锚点。`);
                    else if (!anchor.startsWith('#') && !MARK_ANCHORS.includes(anchor)) result.push(`箭头锚点未知：${anchor}（可用 ${MARK_ANCHORS.join(' / ')} 或 #元素id）`);
                } else if (node.kind === 'circle') {
                    if (!node.cell) result.push(`第 ${index + 1} 个标注的圈坐标无效：${node.target}（应形如 4,4，取值 0-8）`);
                }
            }
        });

        // 分组框：颜色合法且必须成对出现
        const boxStack = [];
        nodes.forEach((node, index) => {
            if (node.type === 'box') {
                if (node.color && !BOX_COLOR_RE.test(node.color)) result.push(`第 ${index + 1} 个框的颜色无效：${node.color}（应形如 #6f42c1）`);
                boxStack.push(index);
            } else if (node.type === 'box_end') {
                if (!boxStack.length) result.push(`第 ${index + 1} 个「结束框」没有对应的「框」。`);
                else boxStack.pop();
            }
        });
        if (boxStack.length) result.push(`第 ${boxStack[boxStack.length - 1] + 1} 个「框」缺少「结束框」。`);

        return result;
    }

    /**
     * @description: 收集剧本用到的角色与表情（供按关卡只加载这些角色图）
     * 台词与选择节点里的 [角色|表情] 都算；表情为空表示只用到角色代表图。
     * @param {{nodes: object[]}} parsed
     * @return {{name: string, expressions: string[]}[]}
     */
    static faces(parsed) {
        const map = new Map();
        ((parsed && parsed.nodes) || []).forEach((node) => {
            if (!node || (node.type !== 'say' && node.type !== 'choice')) return;
            const name = String(node.speaker == null ? '' : node.speaker).trim();
            if (!name) return;
            if (!map.has(name)) map.set(name, new Set());
            const expression = String(node.expression == null ? '' : node.expression).trim();
            if (expression) map.get(name).add(expression);
        });
        return Array.from(map, ([name, expressions]) => ({ 'name': name, 'expressions': Array.from(expressions) }));
    }

    /**
     * @description: 把解析结果还原成 DSL 文本（供编辑器回填）
     * @param {{nodes: object[]}} parsed
     * @return {string}
     */
    static stringify(parsed) {
        const nodes = (parsed && parsed.nodes) || [];
        const lines = [];
        const pad = (node) => '  '.repeat(Math.max(0, Math.min(10, Math.trunc(Number(node.indent) || 0))));
        nodes.forEach((node) => {
            const lead = pad(node);
            if (node.type === 'say') lines.push(lead + (node.expression ? `[${node.speaker}|${node.expression}] ${node.text}` : `[${node.speaker}] ${node.text}`));
            else if (node.type === 'choice') {
                const face = node.speaker ? (node.expression ? `[${node.speaker}|${node.expression}] ` : `[${node.speaker}] `) : '';
                lines.push(lead + `? ${face}${node.prompt}`);
                (node.options || []).forEach((item) => lines.push(lead + `- ${item.text} -> ${item.target}`));
            } else if (node.type === 'game') {
                const config = node.config || normalizeGameConfig(node.config_raw || {});
                lines.push(lead + `* ${node.title}`);
                const configLead = lead + '  ';
                if (config.archive) lines.push(`${configLead}残局码=${config.archive}`);
                if (config.end_text) lines.push(`${configLead}结束对局=${config.end_text}`);
                if (config.post) lines.push(`${configLead}结束后=${config.post === 'continue' ? '继续' : '结果'}`);
                if (config.dialogues.length) lines.push(`${configLead}步数对话=${dialoguesToText(config.dialogues)}`);
                if (config.points.length) lines.push(`${configLead}刷草点=${pointsToText(config.points)}`);
                if (config.schedule.length) lines.push(`${configLead}刷草计划=${scheduleToText(config.schedule)}`);
                if (config.self) lines.push(`${configLead}我方=${config.self === SIDE_BLACK ? '黑' : '白'}`);
                if (config.first) lines.push(`${configLead}先手=${config.first === SIDE_BLACK ? '黑' : '白'}`);
                if (config.win) lines.push(`${configLead}胜利=${config.win}`);
                if (config.lose) lines.push(`${configLead}失败=${config.lose}`);
                if (config.draw) lines.push(`${configLead}平局=${config.draw}`);
            } else if (node.type === 'label') lines.push(lead + `:${node.name}`);
            else if (node.type === 'jump') lines.push(lead + `-> ${node.target}`);
            else if (node.type === 'cond') {
                if (node.kind === 'else') lines.push(lead + `% ELSE -> ${node.target}`);
                else lines.push(lead + `% IF ${COND_TEXT[node.condition] || node.condition} -> ${node.target}`);
            } else if (node.type === 'end') lines.push(lead + '结束');
            else if (node.type === 'resume') lines.push(lead + '继续对局');
            else if (node.type === 'game_end') lines.push(lead + '结束此对局');
            else if (node.type === 'box') lines.push(lead + `框${node.title ? ` ${node.title}` : ''}${node.color ? ` 色=${node.color}` : ''}`);
            else if (node.type === 'box_end') lines.push(lead + '结束框');
            else if (node.type === 'mark') {
                const tail = node.color ? ` 色=${node.color}` : '';
                if (node.kind === 'clear') lines.push(lead + '@ 清除');
                else if (node.kind === 'arrow') lines.push(lead + `@ 箭头 ${node.target || ''}${tail}`.trimEnd());
                else if (node.kind === 'circle') { const cell = node.cell || [0, 0]; lines.push(lead + `@ 圈 ${cell[0]},${cell[1]}${tail}`); }
            }
        });
        return lines.join('\n');
    }
}


class StoryRuntime {
    /**
     * @description: 播放状态机
     * @param {{nodes: object[], labels: object}} parsed
     * @return {StoryRuntime}
     */
    constructor(parsed) {
        this.nodes = (parsed && parsed.nodes) || [];
        this.labels = (parsed && parsed.labels) || {};
        this.index = 0;
        // 最近一次对局的结果（'win' | 'lose' | 'draw'），供条件分支判定
        this.last_outcome = null;
        this.skip_labels();
    }

    skip_labels() {
        while (this.index < this.nodes.length && this.nodes[this.index].type === 'label') this.index++;
    }

    /**
     * @description: 当前节点（越界时返回结束节点）
     * @return {object}
     */
    current() {
        return this.index < this.nodes.length ? this.nodes[this.index] : { 'type': 'end' };
    }

    /**
     * @description: 是否已到剧本末尾
     * @return {boolean}
     */
    is_end() {
        return this.index >= this.nodes.length || this.current().type === 'end';
    }

    /**
     * @description: 前进到下一个可展示节点
     * @return {object}
     */
    advance() {
        this.index++;
        this.skip_labels();
        return this.current();
    }

    /**
     * @description: 跳到指定标签
     * @param {string} name
     * @return {object}
     */
    goto(name) {
        if (END_TARGETS.includes(name)) {
            this.index = this.nodes.length;
            return this.current();
        }
        if (Object.prototype.hasOwnProperty.call(this.labels, name)) {
            this.index = this.labels[name];
            this.skip_labels();
        }
        return this.current();
    }

    /**
     * @description: 选择某个选项并跳转
     * @param {number} option_index
     * @return {object}
     */
    choose(option_index) {
        const node = this.current();
        if (node.type !== 'choice') return this.current();
        const option = node.options[option_index];
        if (!option) return this.current();
        return this.goto(option.target);
    }

    /**
     * @description: 解析对局结束应跳转的标签
     * @param {'win' | 'lose' | 'draw'} outcome
     * @return {string | null}
     */
    resolve_game(outcome) {
        const node = this.current();
        if (node.type !== 'game') return null;
        const config = node.config || {};
        if (outcome === 'win') return config.win || null;
        if (outcome === 'draw') return config.draw || null;
        return config.lose || null;
    }

    /**
     * @description: 对局结束，按结果跳转；未配置时直接前进
     * @param {'win' | 'lose' | 'draw'} outcome
     * @return {object}
     */
    finish_game(outcome) {
        this.last_outcome = outcome;
        const node = this.current();
        const config = node && node.type === 'game' ? (node.config || {}) : {};
        // 结束后=继续：不按胜负跳标签，直接进入下一段剧情（胜负结果仍保留给 % IF 使用）
        if (config.post === 'continue') return this.advance();
        const target = this.resolve_game(outcome);
        return target ? this.goto(target) : this.advance();
    }

    /**
     * @description: 条件分支（% IF / % ELSE）判定：命中则跳转，未命中则前进到下一个节点
     * @param {object} node
     * @return {object}
     */
    step_cond(node) {
        if (!node) return this.current();
        if (node.kind === 'else' || (node.kind === 'if' && this.last_outcome === node.condition)) return this.goto(node.target);
        return this.advance();
    }
}


// ==================== 内置剧情（服务端未配置时的兜底） ====================

const TUTORIAL_BASIC = [
    '[???] 你好～',
    '[???] 你就是新来到这里的棋手，<玩家名称>吧？',
    '[???] 我先自我介绍一下。我是这里的引导人员，ZERO哦～',
    '[导员ZERO] 既然已经来到了这里，你大概已经迫不及待要开始下棋了吧？',
    '[导员ZERO] 不过我猜，作为萌新的你应该是不完全了解规则的吧？',
    '[导员ZERO] 那么！让我现在先来教你第一场吧？',
    '? 选择是否观看新手教程',
    '- 不观看 -> 不观看',
    '- 观看 -> 教程开始',
    ':不观看',
    '[导员ZERO] 诶，有别的事要忙吗？好吧。那，之后需要的时候也可以来找我哦～',
    '结束',
    ':教程开始',
    '[导员ZERO] 好诶！让我们开始吧！',
    '[导员ZERO] 现在，我们已经进入对决了哦！',
    '[导员ZERO] 这场我不会拆开我的包装纸的。所以放心就好～',
    '@ 箭头 名字',
    '[导员ZERO] 首先，你可以看到，这里的最上面显示了我们的名字哦！',
    '@ 箭头 棋子颜色',
    '[导员ZERO] 而名字左边的棋子颜色会是对应选手在本局中使用的棋子颜色。',
    '[导员ZERO] 当然，这和是否先手没有任何关系。',
    '[导员ZERO] 让我们进入到下一项吧！',
    '@ 箭头 生命值',
    '[导员ZERO] 名字下面，就是对应选手的生命值哦。',
    '[导员ZERO] 显而易见，当你的生命值不大于0，你就输了哦。',
    '[导员ZERO] 生命值很重要。当你的生命值慢慢减少到一定程度，你的名字也会逐渐变成红色哦。',
    '@ 圈 4,4',
    '[导员ZERO] 来。试着在这洁白的棋盘上第一次落子吧？',
    '? 准备好后开始第一场实战',
    '- 开始 -> 实战',
    '- 再讲讲 -> 教程开始',
    ':实战',
    '* 对局 第一场实战',
    '  刷草点=4,4;5,4;6,5;3,5;5,5',
    '  我方=黑',
    '  先手=黑',
    '  胜利=胜利',
    '  失败=失败',
    ':胜利',
    '[导员ZERO] 干得漂亮！你已经掌握了基本规则。',
    '结束',
    ':失败',
    '[导员ZERO] 别灰心，我们再试一次吧？',
    '-> 实战',
].join('\n');

const TUTORIAL_ADVANCED = [
    '[导员ZERO] 怎么样？刚才的战斗是不是让你心情汹涌澎湃？',
    '[导员ZERO] 那么接下来该让你理解更多的战斗技巧了！',
    '? 选择是否观看进阶教程',
    '- 我早已经差不多都懂了…… -> 结束',
    '- 请讲。我迫不及待了！ -> 进阶开始',
    ':进阶开始',
    '[导员ZERO] 那些古老的派别虽对立严重，却仍有一些通用的技巧。',
    '[导员ZERO] 实战是最好的老师。让我们开始吧？',
    '@ 箭头 棋盘',
    '[导员ZERO] 首先，试着接下这一击吧！',
    '[导员ZERO] 看？在一方攻击时，你可以直接在其攻击的棋子上落子，也就是反击！',
    '[导员ZERO] 这样便可以夺下那颗棋子的力量……甚至包括其中的反曲点！',
    '[导员ZERO] 你甚至可以在反击时发动攻击……只要连成了足以算作攻击的形态就可以！',
    '[导员ZERO] 在实战中请多多利用反击，尤其是可以夺下反曲点的反击。当然，也要注意对手的反击！',
    '[导员ZERO] 接下来，你可以试着准备一道足够强的斩击。',
    '@ 箭头 生命值',
    '[导员ZERO] 足够强力的攻击可以在哪怕对手反击的情况下也能一击将其打倒，换句话说，它至少由7颗棋子构成。',
    '[导员ZERO] 我们将其称之为“重击”。',
    '@ 圈 4,4',
    ':进阶实战',
    '* 对局 进阶实战',
    '  刷草点=4,4;2,4;6,4;4,2;4,6',
    '  我方=黑',
    '  先手=黑',
    '  胜利=进阶胜利',
    '  失败=进阶失败',
    ':进阶胜利',
    '[导员ZERO] 怎么样，这些够带劲不？我看到你想拔出剑来。来吧！',
    '结束',
    ':进阶失败',
    '[导员ZERO] 再来一次吧！',
    '-> 进阶实战',
].join('\n');

const DEFAULT_CATALOG = {
    'version': 1,
    'levels': [
        { 'level': 1, 'title': '新手引导', 'script': TUTORIAL_BASIC },
        { 'level': 2, 'title': '进阶引导', 'script': TUTORIAL_ADVANCED },
    ],
};

globalThis.StoryExports = { StoryScript, StoryRuntime, DEFAULT_CATALOG, BOARD_SIZE, MARK_ANCHORS, COND_TEXT, COND_MAP };

export { StoryScript, StoryRuntime, DEFAULT_CATALOG, MARK_ANCHORS, COND_TEXT, COND_MAP };
