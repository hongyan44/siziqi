/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 剧情系统：剧本格式解析与播放状态机
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */

const BOARD_SIZE = 9;

// 对局节点允许的配置键（结束对局=... 为新写法，结束残局=... 兼容旧剧本）
const GAME_KEYS = ['残局码', '结束对局', '结束残局', '结束后', '步数对话', '刷草点', '刷草计划', '我方', '先手', '胜利', '失败', '平局'];
// 剧情级设置：可写在任意位置，播放时跳过；对话框不透明度单位为百分比，默认 60%
const STORY_SETTING_KEYS = ['对话框不透明度'];
const DEFAULT_DIALOGUE_OPACITY = 60;
// 保留目标：直接结束剧情
const END_TARGETS = ['结束', '剧终'];
// 返回对局：中途触发的对话播完后回到当前对局继续下棋
const RESUME_KEYWORDS = ['继续对局', '返回对局'];
// 对局块结束标记：编辑器据此把「* 对局」到本行之间的内容包进同一个对局框
const GAME_END_KEYWORDS = ['结束此对局'];
// 标签：可自定义颜色，可作为跳转/调用目标；「结束标签」标记标签块结束
const LABEL_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// 条件分支：% IF 条件 -> 标签 / % ELIF 条件 -> 标签 / % ELSE -> 标签
// 条件支持：胜利 / 失败 / 平局、检测 N 横,竖、第 N 步、选项 序号或文字
// 条件取自"最近一次对局的结果"
const COND_MAP = { '胜利': 'win', 'win': 'win', '失败': 'lose', 'lose': 'lose', '平局': 'draw', 'draw': 'draw' };
const COND_TEXT = { 'win': '胜利', 'lose': '失败', 'draw': '平局', 'move': '检测落子', 'step': '第几步落子', 'option': '用户选择选项' };

/**
 * @description: 解析条件分支头部（IF / ELIF 共用），支持胜负、检测落子、第几步落子与选项选择
 * @param {string} raw 去掉 IF/ELIF 前缀后的条件文本
 * @return {{data?: object, error?: string}}
 */
const parseCondHead = (raw) => {
    const head = String(raw == null ? '' : raw).trim();
    if (!head) return { 'error': '条件为空' };
    const key = COND_MAP[head] || COND_MAP[head.toLowerCase()];
    if (key) return { 'data': { 'condition': key } };
    // 检测 在/不在 N 横,竖：省略“在/不在”时按「在」处理，兼容旧剧本
    let match = /^检测\s+(?:(在|不在)\s+)?(\d+)\s+(\d+)\s*,\s*(\d+)$/.exec(head);
    if (match) {
        const negate = match[1] === '不在';
        const step = Math.trunc(Number(match[2]));
        const across = Number(match[3]);
        const down = Number(match[4]);
        if (!(step >= 1)) return { 'error': '「检测」的步数必须是 1 或更大的整数' };
        if (!toBoardPoint(across, down)) return { 'error': `「检测」坐标无效：${across},${down}（应为 1-9 的 横,竖）` };
        return { 'data': { 'condition': 'move', 'step': step, 'x': across, 'y': down, 'negate': negate, 'cell_text': `${across},${down}` } };
    }
    match = /^第\s*(\d+)\s*步(?:落子)?$/.exec(head);
    if (match) {
        const step = Math.trunc(Number(match[1]));
        if (!(step >= 1)) return { 'error': '「第几步落子」的步数必须是 1 或更大的整数' };
        return { 'data': { 'condition': 'step', 'step': step } };
    }
    match = /^选项\s+([\s\S]+)$/.exec(head);
    if (match) {
        let option = match[1].trim();
        if ((option.startsWith('"') && option.endsWith('"')) || (option.startsWith("'") && option.endsWith("'"))) option = option.slice(1, -1).trim();
        if (!option) return { 'error': '「选项」不能为空（可写选项序号或选项文字）' };
        return { 'data': { 'condition': 'option', 'option': option } };
    }
    return { 'error': `条件无效：${head}（可用 胜利 / 失败 / 平局 / 检测 在|不在 N 横,竖 / 第 N 步 / 选项 序号或文字）` };
};

/**
 * @description: 解析条件分支的目标：标签名、调用标签、调用封装块、继续对局
 * @param {string} raw “->” 之后的文本
 * @return {{target: string, call?: boolean, call_label?: boolean, action?: string}}
 */
const parseCondTarget = (raw) => {
    const text = String(raw == null ? '' : raw).trim();
    const callLabel = /^调用标签\s+([\s\S]+)$/.exec(text);
    if (callLabel) return { 'target': callLabel[1].trim(), 'call_label': true };
    const call = /^调用\s+([\s\S]+)$/.exec(text);
    if (call) return { 'target': call[1].trim(), 'call': true };
    if (RESUME_KEYWORDS.includes(text)) return { 'target': RESUME_KEYWORDS[0], 'action': 'resume' };
    return { 'target': text };
};

/**
 * @description: 条件目标解析结果里的附加标记（调用 / 调用标签 / 继续对局）
 * @param {object} parsed parseCondTarget 的返回值
 * @return {object}
 */
const condTargetProps = (parsed) => {
    const props = {};
    if (parsed && parsed.call) props.call = true;
    if (parsed && parsed.call_label) props.call_label = true;
    if (parsed && parsed.action) props.action = parsed.action;
    return props;
};

/**
 * @description: 把条件节点还原成条件文本（与 parseCondHead 互逆）
 * @param {object} node 条件节点
 * @return {string}
 */
const condToText = (node) => {
    if (!node) return '';
    if (node.condition === 'move') {
        const cell = node.cell_text || `${node.x},${node.y}`;
        return `检测 ${node.negate ? '不在 ' : ''}${Math.max(1, Math.trunc(Number(node.step) || 1))} ${cell}`;
    }
    if (node.condition === 'step') return `第 ${Math.max(1, Math.trunc(Number(node.step) || 1))} 步`;
    if (node.condition === 'option') return `选项 ${node.option}`;
    return COND_TEXT[node.condition] || node.condition;
};

/**
 * @description: 把连续的条件链（IF / ELIF / ELSE）里的「检测落子」抽成对局内即时触发
 * 命中某手时立即暂停本局并跳到对应标签；链尾 ELSE 在该手所有检测条件都未命中时立即跳转
 * @param {object[]} chain 连续的条件节点
 * @param {object[]} detections 对局检测触发列表（会被追加）
 */
const collectMoveCondTriggers = (chain, detections) => {
    if (!Array.isArray(chain) || !chain.length || !Array.isArray(detections)) return;
    const conds = chain.filter((item) => item && item.type === 'cond');
    // 调用封装块 / 调用标签 / 继续对局无法在对局中直接跳转，保留为普通条件节点，对局结束后再判定
    const extractable = (item) => item.condition === 'move' && item.target && !item.call && !item.call_label && item.action !== 'resume';
    const moves = conds.filter(extractable);
    if (!moves.length) return;
    // 链里混入胜负 / 第 N 步 / 选项等条件时，ELSE 无法在第 N 手立即判定，保持原有流程
    const pure = conds.every((item) => extractable(item) || item.kind === 'else');
    let lastStep = 0;
    moves.forEach((item) => {
        const point = toBoardPoint(item.x, item.y);
        detections.push({
            'step': item.step, 'negate': Boolean(item.negate), 'x': point ? point[0] : null, 'y': point ? point[1] : null,
            'cell_text': item.cell_text, 'target': item.target, 'from_cond': true,
        });
        item.consumed = true;
        lastStep = Math.max(lastStep, Math.max(1, Math.trunc(Number(item.step) || 1)));
    });
    const elseNode = pure ? conds.find((item) => item.kind === 'else' && item.target) : null;
    if (elseNode) {
        detections.push({
            'step': lastStep, 'negate': false, 'x': null, 'y': null, 'cell_text': '',
            'target': elseNode.target, 'from_cond': true, 'fallback': true,
        });
        elseNode.consumed = true;
    }
    // 兜底触发排在同手的检测条件之后，保证明确命中的检测优先
    detections.sort((left, right) => (left.fallback ? 1 : 0) - (right.fallback ? 1 : 0));
};

const SIDE_BLACK = 'black';
const SIDE_WHITE = 'white';
// 标注：红色动态箭头（指向界面区域）与旋转虚线圈（指向棋盘交叉点）
// 箭头锚点既可用内置名称，也可直接写界面元素 id（#game_p1_hp）
const MARK_ANCHORS = ['名字', '棋子颜色', '生命值', '信息', '刷草点', '棋盘', '我方', '对手'];
const MARK_KIND_MAP = { '箭头': 'arrow', '圈': 'circle', '清除': 'clear' };

/**
 * @description: 解析对话框不透明度（百分比 0-100），支持省略 % 号
 * @param {string|number} value
 * @return {number | null}
 */
const parseDialogueOpacity = (value) => {
    const text = String(value == null ? '' : value).replace(/[%％]/g, '').trim();
    if (!/^\d{1,3}$/.test(text)) return null;
    const number = Number.parseInt(text, 10);
    return number >= 0 && number <= 100 ? number : null;
};

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
 * @description: 作者坐标（1-9，左下原点，先横后竖）转棋盘内部坐标（0-8，左上原点）
 * @param {number|string} x
 * @param {number|string} y
 * @return {[number, number] | null}
 */
const toBoardPoint = (x, y) => {
    const px = Number.parseInt(x, 10);
    const py = Number.parseInt(y, 10);
    if (!Number.isInteger(px) || !Number.isInteger(py)) return null;
    if (px < 1 || px > BOARD_SIZE || py < 1 || py > BOARD_SIZE) return null;
    return [px - 1, BOARD_SIZE - py];
};

/**
 * @description: 棋盘内部坐标转作者坐标（1-9，左下原点，先横后竖）
 * @param {number} x
 * @param {number} y
 * @return {[number, number]}
 */
const fromBoardPoint = (x, y) => [x + 1, BOARD_SIZE - y];

/**
 * @description: 解析刷草点字符串：5,5;6,5;7,6
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
        const point = toBoardPoint(parts[0], parts[1]);
        if (point) result.push(point);
    });
    return result;
};

/**
 * @description: 解析单个棋盘交叉点：5,5
 * @param {string} value
 * @return {[number, number] | null}
 */
const parseCell = (value) => {
    const parts = String(value == null ? '' : value).trim().split(',');
    if (parts.length < 2) return null;
    return toBoardPoint(parts[0], parts[1]);
};

/**
 * @description: 解析刷草计划：3:5,5;6,5|9:3,3
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
        'end_steps': endSteps ? Math.max(0, Number(endSteps[1])) : 0,
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
 * @description: 把刷草点数组还原成文本（作者坐标 1-9）
 * @param {[number, number][]} points
 * @return {string}
 */
const pointsToText = (points) => (points || []).map((point) => fromBoardPoint(point[0], point[1]).join(',')).join(';');

/**
 * @description: 把刷草计划数组还原成文本
 * @param {{turn: number, cells: [number, number][]}[]} schedule
 * @return {string}
 */
const scheduleToText = (schedule) => (schedule || []).map((entry) => `${entry.turn}:${pointsToText(entry.cells)}`).join('|');

/**
 * @description: 解析对话触发条件：3:标签A|落子5,5:标签B|拿起:标签C|AI拿起:标签D
 * 步数按落子总手数计数（玩家第一步=1、AI 应手=2、玩家第二次=3）；
 * 位置坐标为作者坐标（1-9，先横后竖，5,5 为正中心），内部转换为 0-8 棋盘坐标。
 * @param {string} value
 * @return {{type: string, step?: number, x?: number|null, y?: number|null, cell_text?: string, target: string}[]}
 */
const parseDialogues = (value) => {
    const result = [];
    String(value == null ? '' : value).split('|').forEach((chunk) => {
        const text = chunk.trim();
        if (!text) return;
        // 位置落子触发：落子5,5:标签
        const cell = /^落子\s*([0-9]+)\s*,\s*([0-9]+)\s*[:：]\s*(.+)$/.exec(text);
        if (cell) {
            const point = toBoardPoint(cell[1], cell[2]);
            result.push({
                'type': 'cell',
                'x': point ? point[0] : null,
                'y': point ? point[1] : null,
                'cell_text': `${Number.parseInt(cell[1], 10)},${Number.parseInt(cell[2], 10)}`,
                'target': cell[3].trim(),
            });
            return;
        }
        // AI 拿起棋子触发：AI拿起:标签
        const aiPick = /^AI\s*拿起\s*[:：]\s*(.+)$/i.exec(text);
        if (aiPick) {
            result.push({ 'type': 'ai_pick', 'target': aiPick[1].trim() });
            return;
        }
        // 我方拿起棋子触发：拿起:标签
        const pick = /^拿起\s*[:：]\s*(.+)$/.exec(text);
        if (pick) {
            result.push({ 'type': 'pick', 'target': pick[1].trim() });
            return;
        }
        // 步数触发：3:标签
        const match = /^(\d+)\s*[:：]\s*(.+?)\s*$/.exec(text);
        if (!match) return;
        const step = Number.parseInt(match[1], 10);
        if (!Number.isInteger(step) || step < 1) return;
        result.push({ 'type': 'step', 'step': step, 'target': match[2] });
    });
    return result;
};

/**
 * @description: 把对话触发条件还原成文本
 * @param {{type: string, step?: number, x?: number|null, y?: number|null, cell_text?: string, target: string}[]} dialogues
 * @return {string}
 */
const dialoguesToText = (dialogues) => (dialogues || []).map((entry) => {
    if (entry.type === 'cell') {
        const cell = entry.cell_text || (entry.x == null || entry.y == null ? '5,5' : fromBoardPoint(entry.x, entry.y).join(','));
        return `落子${cell}:${entry.target}`;
    }
    if (entry.type === 'pick') return `拿起:${entry.target}`;
    if (entry.type === 'ai_pick') return `AI拿起:${entry.target}`;
    return `${entry.step}:${entry.target}`;
}).join('|');


// ==================== JQBJ 语言（v0.4）====================
// 文本、拖动框与运行时共用同一套节点；JQBJ 是旧剧本 DSL 的超集。
// 新语法：说 / 菜单 / 如果 / 重复 / 当 / 直到 / 设 / 赋值 / 跳出 / 继续 / 对局 等。
// v0.4：条件支持 与 / 或 / 非、括号、四则运算与数值比较。
const JQBJ_VERSION = 'v0.4';
const JQBJ_DETECT = /^(?:说(?:\s|$)|菜单(?:\s|$)|选项(?:\s|$)|结束菜单$|如果(?:\s|$)|否则如果(?:\s|$)|否则$|结束如果$|重复(?:\s|$)|当(?:\s|$)|直到(?:\s|$)|结束重复$|结束当$|结束直到$|跳出$|继续$|设(?:\s|$)|赋值(?:\s|$)|对局(?:\s|$)|结束对局$|标签(?:\s|$)|结束标签$|调用标签(?:\s|$)|跳转(?:\s|$)|标注(?:\s|$)|不透明度(?:\s|$)|如果胜利$|如果失败$|如果平局$|检测步数(?:\s|$)|检测(?:\s|$)|\{|\})/;
const JQBJ_NAME_RE = /^[A-Za-z_\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5]*$/;
const JQBJ_OUTCOME_TEXT = { 'win': '胜利', 'lose': '失败', 'draw': '平局' };
const JQBJ_OUTCOME_KEY = { '胜利': 'win', '失败': 'lose', '平局': 'draw' };
const JQBJ_GAME_KEYS = [...GAME_KEYS, '结束条件'];
const JQBJ_ASSIGN_RE = /^(设|赋值)\s+([^\s=+\-*/%&]+)\s*(=|\+=|-=|\*=|\/=|%=|&=)\s*(\S[\s\S]*)$/;

const jqbjIsClosing = (text) => (
    text === '结束如果' || text === '否则如果' || text === '否则'
    || text === '结束菜单' || text === '结束选择'
    || text === '结束重复' || text === '结束当' || text === '结束直到'
    || text === '结束定义' || text === '}' || text === '结束框' || text === '框结束'
    || text === '结束标签'
    || GAME_END_KEYWORDS.includes(text) || text === '结束对局'
);

const jqbjValueType = (raw, vars) => {
    const text = String(raw == null ? '' : raw).trim();
    if (text === '真' || text === '假') return 'boolean';
    if (/^"(?:[^"\\]|\\.)*"$/.test(text) || /^'(?:[^'\\]|\\.)*'$/.test(text)) return 'string';
    if (/^-?\d+(?:\.\d+)?$/.test(text)) return 'number';
    if (JQBJ_NAME_RE.test(text) && vars && vars.has(text)) return vars.get(text);
    return 'string';
};

const jqbjUnquote = (raw) => {
    const text = String(raw == null ? '' : raw).trim();
    const matched = /^"(?:[^"\\]|\\.)*"$/.test(text) || /^'(?:[^'\\]|\\.)*'$/.test(text);
    if (!matched) return text;
    const body = text.slice(1, -1);
    return body.replace(/\\(["'\\nrt])/g, (_, ch) => ({ '"': '"', "'": "'", '\\': '\\', 'n': '\n', 'r': '\r', 't': '\t' }[ch]));
};

// ---------- v0.4 条件表达式 ----------
// 优先级：非 > 比较 > 与 > 或；算术沿用四则运算优先级。
const JQBJ_EXPR_TWO_OPS = ['==', '!=', '>=', '<=', '&&', '||'];
const JQBJ_EXPR_ONE_OPS = '<>+-*/%!()';
const jqbjExprBoundary = (ch) => (!ch || /\s/.test(ch) || '<>+-*/%!&|=()'.includes(ch));

const jqbjTokenize = (text) => {
    const tokens = [];
    const source = String(text == null ? '' : text);
    let index = 0;
    while (index < source.length) {
        const ch = source[index];
        if (/\s/.test(ch)) { index += 1; continue; }
        if (ch === '"' || ch === "'") {
            let cursor = index + 1;
            let closed = false;
            while (cursor < source.length) {
                const current = source[cursor];
                if (current === '\\') { cursor += 2; continue; }
                if (current === ch) { closed = true; break; }
                cursor += 1;
            }
            if (!closed) throw new Error('字符串缺少结束引号');
            tokens.push({ 't': 'str', 'v': source.slice(index, cursor + 1) });
            index = cursor + 1;
            continue;
        }
        if (/[0-9]/.test(ch)) {
            const matched = /^\d+(?:\.\d+)?/.exec(source.slice(index));
            tokens.push({ 't': 'num', 'v': Number(matched[0]) });
            index += matched[0].length;
            continue;
        }
        const two = source.slice(index, index + 2);
        if (JQBJ_EXPR_TWO_OPS.includes(two)) {
            tokens.push({ 't': 'op', 'v': two });
            index += 2;
            continue;
        }
        if (JQBJ_EXPR_ONE_OPS.includes(ch)) {
            tokens.push({ 't': 'op', 'v': ch });
            index += 1;
            continue;
        }
        if ('与或非'.includes(ch) && jqbjExprBoundary(source[index - 1]) && jqbjExprBoundary(source[index + 1])) {
            tokens.push({ 't': 'op', 'v': ch });
            index += 1;
            continue;
        }
        const word = /^[A-Za-z_\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5]*/.exec(source.slice(index));
        if (word) {
            const value = word[0];
            if (value === '真' || value === '假') tokens.push({ 't': 'bool', 'v': value === '真' });
            else tokens.push({ 't': 'id', 'v': value });
            index += value.length;
            continue;
        }
        throw new Error(`无法识别的字符：${ch}`);
    }
    return tokens;
};

class JQBJExprParser {
    constructor(tokens) {
        this.tokens = tokens;
        this.index = 0;
    }

    peek() { return this.tokens[this.index] || null; }
    next() { const token = this.peek(); if (token) this.index += 1; return token; }
    isOp(value) { const token = this.peek(); return Boolean(token && token.t === 'op' && token.v === value); }
    tokenText(token) {
        if (!token) return '结尾';
        if (token.t === 'bool') return token.v ? '真' : '假';
        return String(token.v);
    }

    parse() {
        if (!this.tokens.length) throw new Error('条件不能为空');
        const node = this.parseOr();
        const rest = this.peek();
        if (rest) throw new Error(`多余的内容：${this.tokenText(rest)}`);
        return node;
    }

    parseOr() {
        let left = this.parseAnd();
        while (this.isOp('或') || this.isOp('||')) {
            this.next();
            left = { 'type': 'logic', 'op': '或', 'left': left, 'right': this.parseAnd() };
        }
        return left;
    }

    parseAnd() {
        let left = this.parseNot();
        while (this.isOp('与') || this.isOp('&&')) {
            this.next();
            left = { 'type': 'logic', 'op': '与', 'left': left, 'right': this.parseNot() };
        }
        return left;
    }

    parseNot() {
        if (this.isOp('非') || this.isOp('!')) {
            this.next();
            return { 'type': 'not', 'expr': this.parseNot() };
        }
        return this.parseCompare();
    }

    parseCompare() {
        const left = this.parseAdd();
        const token = this.peek();
        if (!token || token.t !== 'op' || !['==', '!=', '>=', '<=', '>', '<'].includes(token.v)) return left;
        this.next();
        const right = this.parseAdd();
        const extra = this.peek();
        if (extra && extra.t === 'op' && ['==', '!=', '>=', '<=', '>', '<'].includes(extra.v)) {
            throw new Error('不支持连续比较，请用 与 / 或 连接多个条件');
        }
        return { 'type': 'compare', 'op': token.v, 'left': left, 'right': right };
    }

    parseAdd() {
        let left = this.parseMul();
        while (this.isOp('+') || this.isOp('-')) {
            const op = this.next().v;
            left = { 'type': 'binary', 'op': op, 'left': left, 'right': this.parseMul() };
        }
        return left;
    }

    parseMul() {
        let left = this.parseUnary();
        while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
            const op = this.next().v;
            left = { 'type': 'binary', 'op': op, 'left': left, 'right': this.parseUnary() };
        }
        return left;
    }

    parseUnary() {
        if (this.isOp('-')) {
            this.next();
            return { 'type': 'unary', 'op': '-', 'expr': this.parseUnary() };
        }
        return this.parsePrimary();
    }

    parsePrimary() {
        const token = this.next();
        if (!token) throw new Error('条件不完整');
        if (token.t === 'num') return { 'type': 'literal', 'valueType': 'number', 'value': token.v };
        if (token.t === 'str') return { 'type': 'literal', 'valueType': 'string', 'value': token.v };
        if (token.t === 'bool') return { 'type': 'literal', 'valueType': 'boolean', 'value': token.v };
        if (token.t === 'id') return { 'type': 'var', 'name': token.v };
        if (token.t === 'op' && token.v === '(') {
            const node = this.parseOr();
            if (!this.isOp(')')) throw new Error('括号没有闭合');
            this.next();
            return node;
        }
        throw new Error(`无法识别的内容：${this.tokenText(token)}`);
    }
}

const parseJQBJExpr = (text) => new JQBJExprParser(jqbjTokenize(text)).parse();

// 解析标签声明：名称 + 可选 色=#rrggbb / 不顺序播放；名称允许包含空格
const jqbjLabelParts = (raw) => {
    let color = '';
    let manual = false;
    const names = [];
    String(raw == null ? '' : raw).trim().split(/\s+/).filter(Boolean).forEach((token) => {
        const colorToken = /^色\s*[=:]\s*(.+)$/.exec(token);
        if (colorToken) color = colorToken[1];
        else if (token === '不顺序播放') manual = true;
        else names.push(token);
    });
    return { 'name': names.join(' ').trim(), 'color': color, 'manual': manual };
};

/**
 * @description: JQBJ v0.4 解析器：先构造语法树（供编辑器还原拖动框），再编译为运行时节点
 */
class JQBJParser {
    constructor(text) {
        const source = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
        this.errors = [];
        this.nodes = [];
        this.labels = {};
        this.seq = { 'if': 0, 'loop': 0, 'menu': 0, 'game': 0, 'box': 0 };
        // 当前解析位置所处的「对局」块深度：条件「检测落子」只允许写在对局块内
        this.gameDepth = 0;
        this.lines = source.split('\n').map((line, lineIndex) => {
            const expanded = line.replace(/\t/g, '  ');
            const trimmed = expanded.trim();
            return {
                'raw': expanded.replace(/\s+$/, ''),
                'text': trimmed,
                'indent': Math.min(20, Math.floor((expanded.length - expanded.trimStart().length) / 2)),
                'lineIndex': lineIndex,
            };
        });
        // 预扫描所有显式标签名，旧分组框转标签时避免命名冲突
        this.usedLabelNames = new Set();
        this.lines.forEach((line) => {
            const label = /^标签(?:\s+([\s\S]*))?$/.exec(line.text);
            const colon = /^:([^\s]+)$/.exec(line.text);
            const name = label ? jqbjLabelParts(label[1] || '').name : (colon ? colon[1] : '');
            if (name) this.usedLabelNames.add(name);
        });
    }

    error(lineIndex, message) {
        this.errors.push(`第 ${Number(lineIndex) + 1} 行：${message}`);
    }

    parse() {
        this.tree = this.parseBlock(0, this.lines.length);
        this.compileList(this.tree, { 'loopStack': [], 'defDepth': 0 });
        this.nodes.forEach((node) => {
            if (node.type === 'game') {
                node.config = normalizeGameConfig(node.config_raw);
                node.config.detections = Array.isArray(node.detections) ? node.detections : [];
                node.config.step_detections = Array.isArray(node.step_detections) ? node.step_detections : [];
                delete node.config_raw;
                delete node.detections;
                delete node.step_detections;
            }
            if (node.type === 'mark' && node.kind === 'circle') node.cell = parseCell(node.target);
        });
        return { 'nodes': this.nodes, 'labels': this.labels, 'errors': this.errors, 'tree': this.tree, 'jqbj': true };
    }

    /** 从语法树中取回原始代码行（按块首行缩进反缩进），供拖动框模式只读展示 */
    spanLines(start, end) {
        const base = this.lines[start] ? this.lines[start].indent : 0;
        const strip = '  '.repeat(base);
        const result = this.lines.slice(start, end).map((line) => (
            line.raw.startsWith(strip) ? line.raw.slice(strip.length) : line.raw.replace(/^\s+/, '')
        ));
        while (result.length && !result[0].trim()) result.shift();
        while (result.length && !result[result.length - 1].trim()) result.pop();
        return result;
    }

    parseBlock(start, end) {
        const list = [];
        let index = start;
        while (index < end) {
            const line = this.lines[index];
            if (!line.text || line.text.startsWith('#')) { index += 1; continue; }
            const result = this.parseStatement(index, end);
            if (!result || !result.node) { index += 1; continue; }
            list.push(result.node);
            index = Math.max(index + 1, result.next);
        }
        return list;
    }

    /** 找同级缩进的块结束标记 */
    findEnd(from, end, indent, keywords) {
        for (let index = from; index < end; index += 1) {
            const line = this.lines[index];
            if (!line.text) continue;
            if (line.indent === indent && keywords.includes(line.text)) return index;
        }
        return -1;
    }

    /** 没有显式结束标记时，遇到同级或更浅缩进的行即视为块结束 */
    implicitEnd(from, end, indent) {
        for (let index = from; index < end; index += 1) {
            const line = this.lines[index];
            if (!line.text || line.text.startsWith('#')) continue;
            if (line.indent <= indent) return index;
        }
        return end;
    }

    parseFace(rest) {
        const face = rest.match(/^\[([^\]]*)\]\s*([\s\S]*)$/);
        if (!face) return { 'speaker': '', 'expression': '', 'text': rest.trim() };
        const raw = face[1].trim();
        const split = raw.indexOf('|');
        return {
            'speaker': split < 0 ? raw : raw.slice(0, split).trim(),
            'expression': split < 0 ? '' : raw.slice(split + 1).trim(),
            'text': face[2].trim(),
        };
    }

    parseCondition(raw, lineIndex) {
        const text = String(raw == null ? '' : raw).trim();
        if (!text) {
            this.error(lineIndex, '条件格式无效：条件不能为空。');
            return null;
        }
        try {
            return { 'ast': parseJQBJExpr(text), 'raw': text };
        } catch (err) {
            this.error(lineIndex, `条件格式无效：${text}（${err.message}）`);
            return null;
        }
    }

    parseStatement(start, end) {
        const line = this.lines[start];
        const text = line.text;
        const indent = line.indent;

        const closing = jqbjIsClosing(text);
        if (closing || text === '选项' || /^-(?:\s|$)/.test(text)) {
            this.error(line.lineIndex, `「${text}」没有对应的开始标记。`);
            return { 'node': null, 'next': start + 1 };
        }

        // 说 [角色|表情] 台词 / 说 旁白
        const say = /^说(?:\s+|$)([\s\S]*)$/.exec(text);
        if (say) {
            const rest = say[1].trim();
            const face = this.parseFace(rest);
            if (!face.text) this.error(line.lineIndex, '「说」缺少台词内容。');
            return { 'node': { 'type': 'say', 'speaker': face.speaker, 'expression': face.expression, 'text': face.text, 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, 'next': start + 1 };
        }

        // 兼容旧写法：[角色|表情] 台词
        const legacySay = text.match(/^\[([^\]]*)\]\s*([\s\S]*)$/);
        if (legacySay) {
            const face = this.parseFace(text);
            return { 'node': { 'type': 'say', 'speaker': face.speaker, 'expression': face.expression, 'text': face.text, 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, 'next': start + 1 };
        }

        // 菜单 / 选项 / 结束菜单（结构化）
        if (/^菜单(?:\s|$)/.test(text) || text.startsWith('?')) {
            const endIndex = this.findEnd(start + 1, end, indent, ['结束菜单', '结束选择']);
            if (endIndex >= 0) return this.parseMenu(start, endIndex, text.startsWith('?'));
            if (text.startsWith('?')) return this.parseLegacyChoice(start, end);
            this.error(line.lineIndex, '菜单块缺少「结束菜单」。');
            const fallback = this.implicitEnd(start + 1, end, indent);
            return this.parseMenu(start, fallback, false);
        }

        // 如果 / 否则如果 / 否则 / 结束如果
        if (/^如果(?:\s|$)/.test(text)) {
            const endIndex = this.findEnd(start + 1, end, indent, ['结束如果']);
            if (endIndex < 0) this.error(line.lineIndex, '「如果」缺少「结束如果」。');
            return this.parseIf(start, endIndex < 0 ? this.implicitEnd(start + 1, end, indent) : endIndex);
        }

        // 循环：重复 N 次 / 当 条件 / 直到 条件
        const repeat = /^重复\s+(.+?)(?:\s*次)?$/.exec(text);
        if (repeat) {
            const endIndex = this.findEnd(start + 1, end, indent, ['结束重复']);
            if (endIndex < 0) this.error(line.lineIndex, '「重复」缺少「结束重复」。');
            const bodyEnd = endIndex < 0 ? this.implicitEnd(start + 1, end, indent) : endIndex;
            return {
                'node': {
                    'type': 'repeat', 'count_raw': repeat[1].trim(), 'body': this.parseBlock(start + 1, bodyEnd),
                    'indent': indent, 'lineStart': start, 'lineEnd': bodyEnd + 1,
                },
                'next': bodyEnd + 1,
            };
        }
        if (/^当(?:\s|$)/.test(text)) {
            const endIndex = this.findEnd(start + 1, end, indent, ['结束当']);
            if (endIndex < 0) this.error(line.lineIndex, '「当」缺少「结束当」。');
            const bodyEnd = endIndex < 0 ? this.implicitEnd(start + 1, end, indent) : endIndex;
            const cond = this.parseCondition(text.slice(1).trim(), line.lineIndex);
            return {
                'node': { 'type': 'while', 'cond': cond, 'body': this.parseBlock(start + 1, bodyEnd), 'indent': indent, 'lineStart': start, 'lineEnd': bodyEnd + 1 },
                'next': bodyEnd + 1,
            };
        }
        if (/^直到(?:\s|$)/.test(text)) {
            const endIndex = this.findEnd(start + 1, end, indent, ['结束直到']);
            if (endIndex < 0) this.error(line.lineIndex, '「直到」缺少「结束直到」。');
            const bodyEnd = endIndex < 0 ? this.implicitEnd(start + 1, end, indent) : endIndex;
            const cond = this.parseCondition(text.slice(2).trim(), line.lineIndex);
            return {
                'node': { 'type': 'until', 'cond': cond, 'body': this.parseBlock(start + 1, bodyEnd), 'indent': indent, 'lineStart': start, 'lineEnd': bodyEnd + 1 },
                'next': bodyEnd + 1,
            };
        }

        // 对局 / 结束对局 / 如果胜利·失败·平局
        if (/^对局(?:\s|$)/.test(text) || text.startsWith('*')) {
            return this.parseGame(start, end);
        }
        if (/^如果胜利$|^如果失败$|^如果平局$/.test(text)) {
            this.error(line.lineIndex, `「${text}」只能写在「对局」块内。`);
            return { 'node': null, 'next': start + 1 };
        }
        if (/^检测步数(?:\s|$)/.test(text)) {
            this.error(line.lineIndex, '「检测步数」只能写在「对局」块内。');
            return { 'node': null, 'next': start + 1 };
        }
        if (/^检测(?:\s|$)/.test(text)) {
            this.error(line.lineIndex, '「检测」只能写在「对局」块内。');
            return { 'node': null, 'next': start + 1 };
        }

        // 定义 / 结束定义
        if (/^定义(?:\s|$)/.test(text)) {
            const endIndex = this.findEnd(start + 1, end, indent, ['结束定义']);
            if (endIndex < 0) this.error(line.lineIndex, '定义块缺少「结束定义」。');
            const bodyEnd = endIndex < 0 ? this.implicitEnd(start + 1, end, indent) : endIndex;
            const name = text.slice(2).trim();
            if (!name) this.error(line.lineIndex, '定义块缺少名称。');
            return {
                'node': { 'type': 'def', 'name': name, 'body': this.parseBlock(start + 1, bodyEnd), 'indent': indent, 'lineStart': start, 'lineEnd': bodyEnd + 1 },
                'next': bodyEnd + 1,
            };
        }

        // 旧分组框：{ 标题 色=#6f42c1 … } / 框 … 结束框
        // 分组框逻辑已移除；读取旧剧本时自动转换为带颜色的标签块，保存时不再输出框语法。
        if (/^\{/.test(text) || /^框(?:\s|$)/.test(text)) {
            const endIndex = this.findEnd(start + 1, end, indent, ['}', '结束框', '框结束']);
            if (endIndex < 0) this.error(line.lineIndex, '分组框缺少「}」。');
            const bodyEnd = endIndex < 0 ? this.implicitEnd(start + 1, end, indent) : endIndex;
            const { 'color': boxColor } = jqbjLabelParts(text.replace(/^(?:框|\{)/, ''));
            // 旧框按出现顺序命名为 1、2、3…（忽略原框标题）
            const ordinal = this.seq.box += 1;
            let name = String(ordinal);
            let suffix = 1;
            while (this.usedLabelNames.has(name)) name = `${ordinal}_${suffix += 1}`;
            this.usedLabelNames.add(name);
            return {
                'node': { 'type': 'label', 'name': name, 'color': boxColor || null, 'body': this.parseBlock(start + 1, bodyEnd), 'legacy_box': true, 'indent': indent, 'lineStart': start, 'lineEnd': bodyEnd + 1 },
                'next': bodyEnd + 1,
            };
        }

        // 标签 / 跳转
        if (/^标签(?:\s|$)/.test(text) || text.startsWith(':')) {
            const isColon = text.startsWith(':');
            const { 'name': labelName, 'color': labelColor, 'manual': labelManual } = isColon
                ? { 'name': text.slice(1).trim(), 'color': '', 'manual': false }
                : jqbjLabelParts(text.replace(/^标签\s*/, ''));
            if (!labelName) this.error(line.lineIndex, '标签缺少名称。');
            const endIndex = isColon ? -1 : this.findEnd(start + 1, end, indent, ['结束标签']);
            if (endIndex >= 0) {
                this.usedLabelNames.add(labelName);
                return {
                    'node': {
                        'type': 'label', 'name': labelName, 'color': labelColor || null, 'manual': labelManual,
                        'body': this.parseBlock(start + 1, endIndex), 'indent': indent,
                        'lineStart': start, 'lineEnd': endIndex + 1,
                    },
                    'next': endIndex + 1,
                };
            }
            this.usedLabelNames.add(labelName);
            return { 'node': { 'type': 'label', 'name': labelName, 'color': labelColor || null, 'manual': labelManual, 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, 'next': start + 1 };
        }
        if (/^调用标签(?:\s|$)/.test(text)) {
            const target = text.slice(4).trim();
            if (!target) this.error(line.lineIndex, '调用标签缺少目标标签。');
            return { 'node': { 'type': 'call_label', 'target': target, 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, 'next': start + 1 };
        }
        if (/^跳转(?:\s|$)/.test(text) || text.startsWith('->')) {
            const target = text.replace(/^跳转\s*/, '').replace(/^->/, '').trim();
            if (!target) this.error(line.lineIndex, '跳转缺少目标标签。');
            return { 'node': { 'type': 'jump', 'target': target, 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, 'next': start + 1 };
        }

        // 结束 / 继续对局 / 返回 / 调用
        if (END_TARGETS.includes(text)) {
            return { 'node': { 'type': 'end', 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, 'next': start + 1 };
        }
        if (RESUME_KEYWORDS.includes(text)) {
            return { 'node': { 'type': 'resume', 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, 'next': start + 1 };
        }
        if (text === '返回') {
            return { 'node': { 'type': 'return', 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, 'next': start + 1 };
        }
        if (/^调用(?:\s|$)/.test(text)) {
            const target = text.slice(2).trim();
            if (!target) this.error(line.lineIndex, '调用缺少封装块名称。');
            return { 'node': { 'type': 'call', 'target': target, 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, 'next': start + 1 };
        }

        // 变量：设 / 赋值
        const assign = JQBJ_ASSIGN_RE.exec(text);
        if (assign) {
            const name = assign[2].trim();
            if (!JQBJ_NAME_RE.test(name)) this.error(line.lineIndex, `变量名无效：${name}`);
            return {
                'node': { 'type': assign[1] === '设' ? 'declare' : 'assign', 'name': name, 'op': assign[3], 'value_raw': assign[4].trim(), 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 },
                'next': start + 1,
            };
        }

        // 跳出 / 继续
        if (text === '跳出') {
            return { 'node': { 'type': 'break', 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, 'next': start + 1 };
        }
        if (text === '继续') {
            return { 'node': { 'type': 'continue', 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, 'next': start + 1 };
        }

        // 标注 / 不透明度
        if (/^标注(?:\s|$)/.test(text) || text.startsWith('@')) {
            const body = text.replace(/^标注\s*/, '').replace(/^@\s*/, '');
            const tokens = body.split(/\s+/).filter(Boolean);
            const kind = MARK_KIND_MAP[tokens[0]] || null;
            if (!kind) {
                this.error(line.lineIndex, `标注类型无效：${text}（可用 箭头 / 圈 / 清除）`);
                return { 'node': null, 'next': start + 1 };
            }
            let color = null;
            const positional = [];
            tokens.slice(1).forEach((token) => {
                const matched = token.match(/^色=(.+)$/);
                if (matched) { color = matched[1].trim(); return; }
                positional.push(token);
            });
            return {
                'node': { 'type': 'mark', 'kind': kind, 'target': positional[0] || '', 'color': color, 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 },
                'next': start + 1,
            };
        }
        const opacity = /^(?:不透明度|对话框不透明度=)\s*([\s\S]*)$/.exec(text);
        if (opacity) {
            const raw = opacity[1].trim();
            const value = parseDialogueOpacity(raw);
            if (value === null) this.error(line.lineIndex, `对话框不透明度无效：${raw}（应为 0-100 的整数）`);
            return {
                'node': { 'type': 'setting', 'key': 'opacity', 'value': value === null ? DEFAULT_DIALOGUE_OPACITY : value, 'raw': raw, 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 },
                'next': start + 1,
            };
        }

        // 旧式结果条件：% IF / ELIF 条件 -> 标签 / % ELSE -> 标签
        if (text.startsWith('%')) {
            const body = text.slice(1).trim();
            const arrow = body.indexOf('->');
            if (arrow < 0) {
                this.error(line.lineIndex, `条件分支缺少“-> 标签”：${text}`);
                return { 'node': null, 'next': start + 1 };
            }
            const head = body.slice(0, arrow).trim();
            const parsedTarget = parseCondTarget(body.slice(arrow + 2));
            const target = parsedTarget.target;
            if (!target) this.error(line.lineIndex, '条件分支的目标不能为空。');
            if (/^else$/i.test(head)) {
                return { 'node': Object.assign({ 'type': 'cond', 'kind': 'else', 'condition': null, 'target': target, 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, condTargetProps(parsedTarget)), 'next': start + 1 };
            }
            const kind = /^elif\b/i.test(head) ? 'elif' : 'if';
            const parsedCondition = parseCondHead(head.replace(/^(?:if|elif)\b\s*/i, ''));
            if (parsedCondition.error) {
                this.error(line.lineIndex, parsedCondition.error);
                return { 'node': null, 'next': start + 1 };
            }
            // 条件「检测落子」只允许写在「对局」块内
            if (parsedCondition.data.condition === 'move' && !this.gameDepth) {
                this.error(line.lineIndex, '条件「检测落子」必须位于「对局」块内，对局框外不可使用。');
                return { 'node': null, 'next': start + 1 };
            }
            return { 'node': Object.assign({ 'type': 'cond', 'kind': kind, 'target': target, 'indent': indent, 'lineStart': start, 'lineEnd': start + 1 }, condTargetProps(parsedTarget), parsedCondition.data), 'next': start + 1 };
        }

        this.error(line.lineIndex, `无法识别：${text}`);
        return { 'node': null, 'next': start + 1 };
    }

    parseMenu(start, endIndex, legacyHeader) {
        const line = this.lines[start];
        const rest = legacyHeader ? line.text.slice(1).trim() : line.text.replace(/^菜单\s*/, '');
        const header = this.parseFace(rest);
        const bodyStart = start + 1;
        const bodyEnd = endIndex;
        let optionIndent = -1;
        const optionLines = [];
        for (let index = bodyStart; index < bodyEnd; index += 1) {
            const item = this.lines[index];
            if (!item.text) continue;
            if (!/^(?:选项|-)(?:\s|$)/.test(item.text)) continue;
            if (optionIndent < 0 || item.indent < optionIndent) optionIndent = item.indent;
        }
        for (let index = bodyStart; index < bodyEnd; index += 1) {
            const item = this.lines[index];
            if (item.indent === optionIndent && /^(?:选项|-)(?:\s|$)/.test(item.text)) optionLines.push(index);
        }
        if (!optionLines.length) this.error(line.lineIndex, '菜单块内没有任何选项。');
        const options = optionLines.map((optionLine, position) => {
            const option = this.lines[optionLine];
            const raw = option.text.replace(/^(?:选项|-)\s*/, '').trim();
            const segmentEnd = position + 1 < optionLines.length ? optionLines[position + 1] : bodyEnd;
            const arrow = /^(.+?)\s*->\s*(.+)$/.exec(raw);
            const text = arrow ? arrow[1].trim() : raw;
            if (!text) this.error(option.lineIndex, '菜单选项文字为空。');
            if (arrow) {
                if (segmentEnd > optionLine + 1 && this.lines.slice(optionLine + 1, segmentEnd).some((item) => item.text)) {
                    this.error(option.lineIndex, `选项“${text}”既写了“-> 标签”又带缩进内容，二者只能选一种。`);
                }
                return { 'text': text, 'target': arrow[2].trim(), 'explicit': true, 'body': [], 'indent': option.indent, 'lineStart': optionLine, 'lineEnd': optionLine + 1 };
            }
            return { 'text': text, 'target': '', 'explicit': false, 'body': this.parseBlock(optionLine + 1, segmentEnd), 'indent': option.indent, 'lineStart': optionLine, 'lineEnd': segmentEnd };
        });
        return {
            'node': {
                'type': 'menu', 'speaker': header.speaker, 'expression': header.expression, 'prompt': header.text,
                'options': options, 'indent': line.indent, 'lineStart': start, 'lineEnd': bodyEnd + 1,
            },
            'next': bodyEnd + 1,
        };
    }

    parseLegacyChoice(start, end) {
        const line = this.lines[start];
        const header = this.parseFace(line.text.slice(1).trim());
        const options = [];
        let index = start + 1;
        while (index < end) {
            const item = this.lines[index];
            if (!item.text) { index += 1; continue; }
            if (!/^-\s*/.test(item.text)) break;
            const raw = item.text.replace(/^-\s*/, '').trim();
            const arrow = /^(.+?)\s*->\s*(.+)$/.exec(raw);
            if (!arrow) {
                this.error(item.lineIndex, `旧式选项缺少“-> 标签”：${item.text}`);
                options.push({ 'text': raw, 'target': '', 'indent': item.indent });
            } else {
                options.push({ 'text': arrow[1].trim(), 'target': arrow[2].trim(), 'indent': item.indent });
            }
            index += 1;
        }
        return {
            'node': { 'type': 'choice', 'speaker': header.speaker, 'expression': header.expression, 'prompt': header.text, 'options': options, 'indent': line.indent, 'lineStart': start, 'lineEnd': index },
            'next': index,
        };
    }

    parseIf(start, endIndex) {
        const line = this.lines[start];
        const branches = [];
        let branchStart = start;
        let cond = this.parseCondition(line.text.replace(/^如果\s*/, ''), line.lineIndex);
        let index = start + 1;
        while (index <= endIndex) {
            const item = this.lines[index];
            const isElseIf = item && item.indent === line.indent && /^否则如果(?:\s|$)/.test(item.text);
            const isElse = item && item.indent === line.indent && item.text === '否则';
            if (index === endIndex || isElseIf || isElse) {
                branches.push({ 'cond': cond, 'body': this.parseBlock(branchStart + 1, index), 'lineStart': branchStart, 'lineEnd': index });
                if (index === endIndex) break;
                cond = isElse ? null : this.parseCondition(item.text.replace(/^否则如果\s*/, ''), item.lineIndex);
                branchStart = index;
            }
            index += 1;
        }
        return {
            'node': { 'type': 'if', 'branches': branches, 'indent': line.indent, 'lineStart': start, 'lineEnd': endIndex + 1 },
            'next': endIndex + 1,
        };
    }

    parseGame(start, end) {
        const line = this.lines[start];
        const title = line.text.replace(/^对局\s*/, '').replace(/^\*\s*/, '').replace(/^对局\s*/, '').trim();
        this.gameDepth += 1;
        let endIndex = this.findEnd(start + 1, end, line.indent, ['结束对局', ...GAME_END_KEYWORDS]);
        if (endIndex < 0) endIndex = this.implicitEnd(start + 1, end, line.indent);
        const configs = [];
        const configRaw = {};
        const branches = [];
        const detections = [];
        const stepDetections = [];
        const body = [];
        let branchIndent = -1;
        let index = start + 1;
        while (index < endIndex) {
            const item = this.lines[index];
            if (!item.text || item.text.startsWith('#')) { index += 1; continue; }
            const result = /^(如果胜利|如果失败|如果平局)$/.exec(item.text);
            if (result && item.indent > line.indent) {
                if (branchIndent < 0) branchIndent = item.indent;
                if (item.indent === branchIndent || branchIndent < 0) {
                    const outcome = JQBJ_OUTCOME_KEY[result[1].slice(2)];
                    let next = index + 1;
                    while (next < endIndex) {
                        const sibling = this.lines[next];
                        if (sibling.text && sibling.indent === branchIndent && (/^(如果胜利|如果失败|如果平局)$/.test(sibling.text) || /^检测步数(?:\s|$)/.test(sibling.text) || /^检测(?:\s|$)/.test(sibling.text))) break;
                        next += 1;
                    }
                    branches.push({ 'outcome': outcome, 'body': this.parseBlock(index + 1, next), 'indent': item.indent, 'lineStart': index, 'lineEnd': next });
                    index = next;
                    continue;
                }
            }
            const config = item.text.match(/^([^\s=]+)\s*=\s*([\s\S]*)$/);
            if (config && JQBJ_GAME_KEYS.includes(config[1])) {
                const key = config[1] === '结束条件' ? '结束对局' : config[1];
                configs.push({ 'key': key, 'value': config[2].trim(), 'lineIndex': item.lineIndex });
                configRaw[key] = config[2].trim();
                index += 1;
                continue;
            }
            // 检测步数 N -> 标签：对局总手数达到 N 时立即跳转标签（只允许写在对局块内）
            const stepDetect = /^检测步数\s+(\d+)\s*->\s*([\s\S]+)$/.exec(item.text);
            if (stepDetect) {
                const step = Math.trunc(Number(stepDetect[1]));
                const target = stepDetect[2].trim();
                // 0 表示无需落子，点击屏幕立即跳转；其余按总手数判定
                if (!(step >= 0)) this.error(item.lineIndex, '「检测步数」的步数必须是 0 或更大的整数。');
                if (!target) this.error(item.lineIndex, '「检测步数」缺少“-> 标签”。');
                stepDetections.push({
                    'type': 'step', 'step': step >= 0 ? step : 0, 'target': target,
                    'indent': item.indent, 'lineStart': index, 'lineEnd': index + 1,
                });
                index += 1;
                continue;
            }
            if (/^检测步数(?:\s|$)/.test(item.text)) {
                this.error(item.lineIndex, '「检测步数」缺少“-> 标签”（应形如 检测步数 4 -> 标签）。');
                index += 1;
                continue;
            }
            // 检测 [在|不在] N 横,竖 -> 标签：玩家自己的第 N 手落在（或不在）该交叉点时，暂停本局并跳转标签
            const detect = /^检测\s+(?:(在|不在)\s+)?(\d+)\s+(\d+)\s*,\s*(\d+)\s*->\s*([\s\S]+)$/.exec(item.text);
            if (detect) {
                const negate = detect[1] === '不在';
                const step = Math.trunc(Number(detect[2]));
                const across = Number(detect[3]);
                const down = Number(detect[4]);
                const target = detect[5].trim();
                if (!(step >= 1)) this.error(item.lineIndex, '「检测」的步数必须是 1 或更大的整数。');
                if (!toBoardPoint(across, down)) this.error(item.lineIndex, `「检测」坐标无效：${across},${down}（应为 1-9 的 横,竖）。`);
                if (!target) this.error(item.lineIndex, '「检测」缺少“-> 标签”。');
                detections.push({
                    'type': 'detect', 'step': step >= 1 ? step : 1, 'negate': negate, 'cell_text': `${across},${down}`,
                    'x': across, 'y': down, 'target': target, 'indent': item.indent, 'lineStart': index, 'lineEnd': index + 1,
                });
                index += 1;
                continue;
            }
            if (/^检测(?:\s|$)/.test(item.text)) {
                this.error(item.lineIndex, '「检测」缺少“-> 标签”（应形如 检测 1 4,4 -> 标签 / 检测 不在 1 4,4 -> 标签）。');
                index += 1;
                continue;
            }
            const parsed = this.parseStatement(index, endIndex);
            if (!parsed || !parsed.node) { index += 1; continue; }
            body.push(parsed.node);
            index = Math.max(index + 1, parsed.next);
        }
        this.gameDepth = Math.max(0, this.gameDepth - 1);
        return {
            'node': {
                'type': 'game', 'title': title, 'configs': configs, 'config_raw': configRaw, 'branches': branches, 'detections': detections, 'step_detections': stepDetections, 'body': body,
                'indent': line.indent, 'lineStart': start, 'lineEnd': endIndex + 1,
            },
            'next': endIndex + 1,
        };
    }

    // ---------- 语法树 → 运行时节点 ----------

    emitAutoJump(target, indent, kind) {
        this.nodes.push({ 'type': 'jump', 'target': target, 'auto': kind || 'jqbj', 'indent': indent });
    }

    emitLabel(name, indent, auto) {
        if (Object.prototype.hasOwnProperty.call(this.labels, name)) this.errors.push(`标签重复：${name}`);
        this.labels[name] = this.nodes.length;
        this.nodes.push({ 'type': 'label', 'name': name, 'auto': auto === undefined ? 'jqbj' : auto, 'indent': indent });
    }

    compileList(list, ctx) {
        (list || []).forEach((node) => this.compileNode(node, ctx));
    }

    compileNode(node, ctx) {
        const indent = node.indent == null ? 0 : node.indent;
        if (node.type === 'say') {
            this.nodes.push({ 'type': 'say', 'speaker': node.speaker, 'expression': node.expression, 'text': node.text, 'indent': indent });
            return;
        }
        if (node.type === 'choice') {
            this.nodes.push({ 'type': 'choice', 'speaker': node.speaker, 'expression': node.expression, 'prompt': node.prompt, 'options': node.options, 'indent': indent });
            return;
        }
        if (node.type === 'menu') {
            const seq = this.seq.menu;
            this.seq.menu += 1;
            const endLabel = `__jqbj_menu_end_${seq}`;
            const choice = { 'type': 'choice', 'block': true, 'speaker': node.speaker, 'expression': node.expression, 'prompt': node.prompt, 'options': [], 'indent': indent };
            this.nodes.push(choice);
            node.options.forEach((option, position) => {
                const record = { 'text': option.text, 'target': option.target || '', 'explicit': Boolean(option.explicit), 'body': [] };
                if (option.explicit) { choice.options.push(record); return; }
                record.target = `__jqbj_menu_${seq}_${position}`;
                this.emitLabel(record.target, indent + 1, 'menu');
                const before = this.nodes.length;
                this.compileList(option.body, ctx);
                record.body = this.nodes.slice(before);
                this.emitAutoJump(endLabel, indent + 1, 'menu');
                choice.options.push(record);
            });
            this.nodes.push({ 'type': 'choice_end', 'auto': 'menu', 'indent': indent });
            this.emitLabel(endLabel, indent, 'menu_end');
            return;
        }
        if (node.type === 'if') {
            const seq = this.seq.if;
            this.seq.if += 1;
            const endLabel = `__jqbj_if_${seq}_end`;
            node.branches.forEach((branch, position) => {
                const bodyLabel = `__jqbj_if_${seq}_${position}_body`;
                const nextLabel = `__jqbj_if_${seq}_${position}_next`;
                if (branch.cond) {
                    this.nodes.push({ 'type': 'if', 'cond': branch.cond, 'target': bodyLabel, 'indent': indent });
                    this.emitAutoJump(nextLabel, indent);
                }
                this.emitLabel(bodyLabel, indent + 1);
                this.compileList(branch.body, ctx);
                this.emitAutoJump(endLabel, indent + 1);
                this.emitLabel(nextLabel, indent);
            });
            this.emitLabel(endLabel, indent);
            return;
        }
        if (node.type === 'repeat') {
            const seq = this.seq.loop;
            this.seq.loop += 1;
            const bodyLabel = `__jqbj_repeat_${seq}_body`;
            const contLabel = `__jqbj_repeat_${seq}_cont`;
            const endLabel = `__jqbj_repeat_${seq}_end`;
            this.nodes.push({ 'type': 'repeat', 'count_raw': node.count_raw, 'body': bodyLabel, 'end': endLabel, 'loop_id': seq, 'indent': indent });
            this.emitLabel(bodyLabel, indent + 1);
            ctx.loopStack.push({ 'break': endLabel, 'continue': contLabel, 'defDepth': ctx.defDepth });
            this.compileList(node.body, ctx);
            ctx.loopStack.pop();
            this.emitLabel(contLabel, indent + 1);
            this.nodes.push({ 'type': 'repeat_end', 'body': bodyLabel, 'end': endLabel, 'loop_id': seq, 'indent': indent });
            this.emitLabel(endLabel, indent);
            return;
        }
        if (node.type === 'while') {
            const seq = this.seq.loop;
            this.seq.loop += 1;
            const checkLabel = `__jqbj_while_${seq}_check`;
            const bodyLabel = `__jqbj_while_${seq}_body`;
            const endLabel = `__jqbj_while_${seq}_end`;
            this.emitLabel(checkLabel, indent);
            this.nodes.push({ 'type': 'while', 'cond': node.cond, 'body': bodyLabel, 'end': endLabel, 'indent': indent });
            this.emitLabel(bodyLabel, indent + 1);
            ctx.loopStack.push({ 'break': endLabel, 'continue': checkLabel, 'defDepth': ctx.defDepth });
            this.compileList(node.body, ctx);
            ctx.loopStack.pop();
            this.emitAutoJump(checkLabel, indent + 1, 'loop');
            this.emitLabel(endLabel, indent);
            return;
        }
        if (node.type === 'until') {
            const seq = this.seq.loop;
            this.seq.loop += 1;
            const bodyLabel = `__jqbj_until_${seq}_body`;
            const condLabel = `__jqbj_until_${seq}_cond`;
            const endLabel = `__jqbj_until_${seq}_end`;
            this.emitLabel(bodyLabel, indent + 1);
            ctx.loopStack.push({ 'break': endLabel, 'continue': condLabel, 'defDepth': ctx.defDepth });
            this.compileList(node.body, ctx);
            ctx.loopStack.pop();
            this.emitLabel(condLabel, indent + 1);
            this.nodes.push({ 'type': 'until', 'cond': node.cond, 'body': bodyLabel, 'end': endLabel, 'indent': indent });
            this.emitLabel(endLabel, indent);
            return;
        }
        if (node.type === 'game') {
            const seq = this.seq.game;
            this.seq.game += 1;
            const endLabel = `__jqbj_game_${seq}_end`;
            const gameNode = { 'type': 'game', 'title': node.title, 'config_raw': Object.assign({}, node.config_raw), 'detections': [], 'step_detections': [], 'indent': indent };
            this.nodes.push(gameNode);
            this.emitAutoJump(endLabel, indent);
            const seen = new Set();
            node.branches.forEach((branch) => {
                if (seen.has(branch.outcome)) { this.errors.push(`对局“${node.title}”重复配置了「如果${JQBJ_OUTCOME_TEXT[branch.outcome]}」。`); return; }
                seen.add(branch.outcome);
                const label = `__jqbj_game_${seq}_${branch.outcome}`;
                gameNode.config_raw[JQBJ_OUTCOME_TEXT[branch.outcome]] = label;
                this.emitLabel(label, indent + 1, 'game');
                this.compileList(branch.body, ctx);
                this.emitAutoJump(endLabel, indent + 1, 'game');
            });
            (node.detections || []).forEach((detector) => {
                const point = toBoardPoint(detector.x, detector.y);
                gameNode.detections.push({
                    'step': detector.step, 'negate': Boolean(detector.negate), 'x': point ? point[0] : null, 'y': point ? point[1] : null,
                    'cell_text': detector.cell_text, 'target': detector.target,
                });
            });
            (node.step_detections || []).forEach((detector) => {
                gameNode.step_detections.push({ 'step': detector.step, 'target': detector.target });
            });
            this.emitLabel(endLabel, indent, 'game_end');
            this.nodes.push({ 'type': 'game_end', 'indent': indent });
            // 记录对局块内的语句，供 stringify 还原时放回「对局」块内
            const bodyStart = this.nodes.length;
            this.compileList(node.body, ctx);
            gameNode.body_nodes = this.nodes.slice(bodyStart);
            // 对局块内的「检测落子」条件改为即时触发：玩家第 N 手落下（或未落在该点）时
            // 立即暂停本局并跳转到该条件的标签；链尾 ELSE 在同手未命中时同样立即跳转
            let condChain = [];
            gameNode.body_nodes.forEach((bodyNode) => {
                if (bodyNode && bodyNode.type === 'cond') { condChain.push(bodyNode); return; }
                collectMoveCondTriggers(condChain.splice(0), gameNode.detections);
            });
            collectMoveCondTriggers(condChain, gameNode.detections);
            return;
        }
        if (node.type === 'def') {
            this.nodes.push({ 'type': 'def', 'name': node.name, 'indent': indent });
            ctx.defDepth += 1;
            this.compileList(node.body, ctx);
            ctx.defDepth -= 1;
            this.nodes.push({ 'type': 'def_end', 'name': node.name, 'indent': indent });
            return;
        }
        if (node.type === 'label') {
            if (node.name) {
                this.emitLabel(node.name, indent, null);
                this.nodes[this.nodes.length - 1].color = node.color || null;
                this.nodes[this.nodes.length - 1].block = Boolean(node.body);
                this.nodes[this.nodes.length - 1].manual = Boolean(node.manual);
            }
            if (node.body) {
                this.compileList(node.body, ctx);
                this.nodes.push({ 'type': 'label_end', 'indent': indent });
            }
            return;
        }
        if (node.type === 'declare' || node.type === 'assign') {
            this.nodes.push({ 'type': node.type, 'name': node.name, 'op': node.op, 'value_raw': node.value_raw, 'indent': indent });
            return;
        }
        if (node.type === 'break' || node.type === 'continue') {
            const loop = ctx.loopStack[ctx.loopStack.length - 1];
            if (!loop || ctx.defDepth > loop.defDepth) {
                this.error(node.lineStart, `「${node.type === 'break' ? '跳出' : '继续'}」必须直接位于循环体内。`);
                return;
            }
            this.nodes.push({ 'type': node.type, 'target': loop[node.type], 'indent': indent });
            return;
        }
        if (node.type === 'mark') {
            if (node.kind === 'circle') node.cell = parseCell(node.target);
            this.nodes.push(Object.assign({}, node, { 'indent': indent, 'cell': node.cell || null }));
            return;
        }
        // 其余语句与旧 DSL 节点同名同构
        this.nodes.push(Object.assign({}, node, { 'indent': indent }));
    }
}

const parseJQBJ = (text) => new JQBJParser(text).parse();

const validateJQBJTree = (tree) => {
    const errors = [];
    const vars = new Map();
    const loops = [];
    let defDepth = 0;

    const lineOf = (node) => `第 ${Number(node && node.lineStart != null ? node.lineStart : 0) + 1} 行：`;
    const typeOfValue = (raw) => jqbjValueType(raw, vars);
    const checkInterp = (text, node) => {
        String(text == null ? '' : text).replace(/\$\{([^}]+)\}/g, (whole, name) => {
            if (!vars.has(String(name).trim())) errors.push(`${lineOf(node)}引用了未声明的变量：${String(name).trim()}`);
            return whole;
        });
    };
    const collectBareVars = (expr, names = []) => {
        if (!expr) return names;
        if (expr.type === 'var') {
            if (!vars.has(expr.name)) names.push(expr.name);
            return names;
        }
        if (expr.type === 'not' || expr.type === 'unary') return collectBareVars(expr.expr, names);
        if (expr.type === 'binary' || expr.type === 'compare' || expr.type === 'logic') {
            collectBareVars(expr.left, names);
            collectBareVars(expr.right, names);
        }
        return names;
    };
    const checkExprType = (expr, expected, node) => {
        if (!expr) return 'unknown';
        if (expr.type === 'literal') {
            if (expr.valueType === 'string') checkInterp(jqbjUnquote(expr.value), node);
            return expr.valueType;
        }
        if (expr.type === 'var') {
            if (vars.has(expr.name)) return vars.get(expr.name);
            // 比较/算术中的裸词沿用旧版语义：未声明时按字符串常量处理；布尔上下文仍然报错
            if (expected === 'any' || expected === 'string') return 'string';
            errors.push(`${lineOf(node)}条件引用了未声明的变量：${expr.name}`);
            return 'string';
        }
        if (expr.type === 'not') {
            const type = checkExprType(expr.expr, 'boolean', node);
            if (type !== 'boolean') errors.push(`${lineOf(node)}「非」需要布尔值，当前为 ${type}。`);
            return 'boolean';
        }
        if (expr.type === 'unary') {
            const type = checkExprType(expr.expr, 'number', node);
            if (type !== 'number') errors.push(`${lineOf(node)}负号只能用于数字，当前为 ${type}。`);
            return 'number';
        }
        if (expr.type === 'binary') {
            const left = checkExprType(expr.left, 'number', node);
            const right = checkExprType(expr.right, 'number', node);
            if (left !== 'number' || right !== 'number') errors.push(`${lineOf(node)}运算符 ${expr.op} 两侧必须是数字（当前 ${left} 与 ${right}）。`);
            if ((expr.op === '/' || expr.op === '%') && expr.right && expr.right.type === 'literal' && expr.right.valueType === 'number' && expr.right.value === 0) {
                errors.push(`${lineOf(node)}不能除以 0。`);
            }
            return 'number';
        }
        if (expr.type === 'compare') {
            const left = checkExprType(expr.left, 'any', node);
            const right = checkExprType(expr.right, 'any', node);
            if (left !== right) {
                const missing = [...new Set([...collectBareVars(expr.left), ...collectBareVars(expr.right)])];
                if (missing.length) missing.forEach((name) => errors.push(`${lineOf(node)}条件引用了未声明的变量：${name}`));
                else errors.push(`${lineOf(node)}比较两侧类型不一致（${left} 与 ${right}）。`);
            }
            if ((expr.op === '>' || expr.op === '<' || expr.op === '>=' || expr.op === '<=') && left !== 'number' && left !== 'string') {
                errors.push(`${lineOf(node)}布尔值不能使用 ${expr.op} 比较。`);
            }
            return 'boolean';
        }
        if (expr.type === 'logic') {
            const left = checkExprType(expr.left, 'boolean', node);
            const right = checkExprType(expr.right, 'boolean', node);
            if (left !== 'boolean' || right !== 'boolean') errors.push(`${lineOf(node)}「${expr.op}」两侧必须是布尔条件（当前 ${left} 与 ${right}）。`);
            return 'boolean';
        }
        return 'unknown';
    };
    const checkCondition = (cond, node) => {
        if (!cond || !cond.ast) return;
        const type = checkExprType(cond.ast, 'boolean', node);
        if (type !== 'boolean') errors.push(`${lineOf(node)}条件的结果必须是布尔值。`);
    };
    const checkAssignValue = (name, op, raw, node) => {
        const base = vars.get(name);
        const right = typeOfValue(raw);
        if (op === '=') {
            if (base !== right) errors.push(`${lineOf(node)}变量 ${name} 的类型固定为 ${base}，不能赋值为 ${right}。`);
        } else if (op === '&=') {
            if (base !== 'string') errors.push(`${lineOf(node)}只有字符串变量可以使用 &=：${name}`);
            if (right !== 'string') errors.push(`${lineOf(node)}变量 ${name} 只能拼接字符串。`);
        } else {
            if (base !== 'number') errors.push(`${lineOf(node)}只有数字变量可以使用 ${op}：${name}`);
            if (right !== 'number') errors.push(`${lineOf(node)}变量 ${name} 只能与数字进行 ${op} 运算。`);
            if (op === '/=' || op === '%=') {
                const value = jqbjUnquote(raw);
                if (/^-?\d+(?:\.\d+)?$/.test(value) && Number(value) === 0) errors.push(`${lineOf(node)}不能除以 0。`);
            }
        }
    };

    const walk = (list) => {
        (list || []).forEach((node) => {
            if (!node) return;
            if (node.type === 'say') { checkInterp(node.text, node); return; }
            if (node.type === 'menu') {
                checkInterp(node.prompt, node);
                node.options.forEach((option) => { checkInterp(option.text, option); walk(option.body); });
                return;
            }
            if (node.type === 'choice') {
                checkInterp(node.prompt, node);
                node.options.forEach((option) => checkInterp(option.text, option));
                return;
            }
            if (node.type === 'if') {
                node.branches.forEach((branch) => { checkCondition(branch.cond, node); walk(branch.body); });
                return;
            }
            if (node.type === 'repeat') {
                const raw = String(node.count_raw || '').trim();
                if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
                    if (Number(raw) < 0) errors.push(`${lineOf(node)}重复次数不能为负数。`);
                } else if (JQBJ_NAME_RE.test(raw)) {
                    if (!vars.has(raw)) errors.push(`${lineOf(node)}重复次数引用了未声明的变量：${raw}`);
                    else if (vars.get(raw) !== 'number') errors.push(`${lineOf(node)}重复次数变量 ${raw} 必须是数字。`);
                } else {
                    errors.push(`${lineOf(node)}重复次数格式无效：${raw}`);
                }
                loops.push({ 'defDepth': defDepth });
                walk(node.body);
                loops.pop();
                return;
            }
            if (node.type === 'while' || node.type === 'until') {
                checkCondition(node.cond, node);
                loops.push({ 'defDepth': defDepth });
                walk(node.body);
                loops.pop();
                return;
            }
            if (node.type === 'declare') {
                if (!JQBJ_NAME_RE.test(node.name)) return;
                if (vars.has(node.name)) { errors.push(`${lineOf(node)}变量已存在：${node.name}`); return; }
                const op = node.op;
                if (op === '=') {
                    vars.set(node.name, typeOfValue(node.value_raw));
                } else {
                    const base = op === '&=' ? 'string' : 'number';
                    vars.set(node.name, base);
                    // 复合赋值本身相当于“声明初始值 + 立即运算”
                    const scratch = new Map(vars);
                    checkAssignValue(node.name, op, node.value_raw, node);
                    vars.clear();
                    scratch.forEach((value, key) => vars.set(key, value));
                }
                checkInterp(jqbjUnquote(node.value_raw), node);
                return;
            }
            if (node.type === 'assign') {
                if (!vars.has(node.name)) { errors.push(`${lineOf(node)}未声明的变量：${node.name}`); return; }
                checkAssignValue(node.name, node.op, node.value_raw, node);
                checkInterp(jqbjUnquote(node.value_raw), node);
                return;
            }
            if (node.type === 'break' || node.type === 'continue') {
                const loop = loops[loops.length - 1];
                if (!loop || defDepth > loop.defDepth) errors.push(`${lineOf(node)}「${node.type === 'break' ? '跳出' : '继续'}」必须直接位于循环体内（封装块内不可用）。`);
                return;
            }
            if (node.type === 'def') {
                if (!node.name) errors.push(`${lineOf(node)}定义块缺少名称。`);
                defDepth += 1;
                walk(node.body);
                defDepth -= 1;
                return;
            }
            if (node.type === 'label') {
                if (node.color && !LABEL_COLOR_RE.test(node.color)) errors.push(`${lineOf(node)}标签“${node.name}”的颜色无效：${node.color}（应形如 #6f42c1）。`);
                walk(node.body);
                return;
            }
            if (node.type === 'game') {
                const seen = new Set();
                node.branches.forEach((branch) => {
                    if (seen.has(branch.outcome)) errors.push(`${lineOf(node)}对局“${node.title}”重复配置了「如果${JQBJ_OUTCOME_TEXT[branch.outcome]}」。`);
                    seen.add(branch.outcome);
                    walk(branch.body);
                });
                (node.detections || []).forEach((detector) => {
                    if (!detector.target) errors.push(`${lineOf(node)}对局“${node.title}”的「检测」缺少跳转标签。`);
                });
                (node.step_detections || []).forEach((detector) => {
                    if (!detector.target) errors.push(`${lineOf(node)}对局“${node.title}”的「检测步数」缺少跳转标签。`);
                });
                walk(node.body);
            }
        });
    };

    walk(tree);
    return errors;
};


class StoryScript {
    /**
     * @description: 解析剧本 DSL
     * @param {string} text
     * @return {{nodes: object[], labels: object, errors: string[]}}
     */
    static parse(text) {
        const source = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
        // 含 JQBJ 专属语法时走新解析器；纯旧剧本仍走原解析器，保证历史剧本零差异
        if (source.split('\n').some((line) => JQBJ_DETECT.test(line.trim()))) return parseJQBJ(source);
        const nodes = [];
        const labels = {};
        const errors = [];
        const rawLines = source.split('\n');
        // 行首缩进（2 空格 = 1 级，Tab 按 2 空格计）：既用于编辑器排版，也用于结构化菜单块的边界判定
        const lines = rawLines.map((line, lineIndex) => {
            const expanded = line.replace(/\t/g, '  ');
            return {
                'text': expanded.trim(),
                'indent': Math.min(8, Math.floor((expanded.length - expanded.trimStart().length) / 2)),
                'lineIndex': lineIndex,
            };
        });
        let menuSeq = 0;
        // 当前解析位置所处的「对局」块深度：条件「检测落子」只允许写在对局块内
        let gameDepth = 0;
        // 旧分组框转标签时使用：预收集已有标签名，避免命名冲突
        const legacyLabelNames = new Set();
        lines.forEach((line) => {
            const matched = /^:([^\s]+)$/.exec(line.text);
            if (matched) legacyLabelNames.add(matched[1]);
        });
        let legacyBoxSeq = 0;

        // 选择提示可携带角色表情：? [角色|表情] 提示
        const parseChoiceHeader = (body) => {
            const face = body.match(/^\[([^\]]*)\]\s*(.*)$/);
            if (!face) return { 'speaker': '', 'expression': '', 'prompt': body };
            const raw = face[1].trim();
            const split = raw.indexOf('|');
            return {
                'speaker': split < 0 ? raw : raw.slice(0, split).trim(),
                'expression': split < 0 ? '' : raw.slice(split + 1).trim(),
                'prompt': face[2].trim(),
            };
        };

        // 查找与结构化菜单配对的「结束选择」；只认同级缩进的结束标记，避免吞掉父级菜单或后续剧情
        const findMenuEnd = (from, to, indent) => {
            for (let index = from; index < to; index += 1) {
                const line = lines[index];
                if (!line.text || line.indent > indent) continue;
                // 只认与菜单标题同缩进的结束标记；更低缩进的是父级菜单的结束，不能误配
                if (line.text === '结束选择') {
                    if (line.indent === indent) return index;
                    continue;
                }
                if (line.text === '结束定义' || line.text === '结束框' || line.text === '框结束' || line.text === '结束标签' || GAME_END_KEYWORDS.includes(line.text)) return -1;
            }
            return -1;
        };

        const findDefEnd = (from, to, indent) => {
            for (let index = from; index < to; index += 1) {
                const line = lines[index];
                if (line.indent === indent && line.text === '结束定义') return index;
            }
            return -1;
        };

        // 结构化菜单块：? 提示 / - 选项（缩进内容即该选项剧情）/ 结束选择
        // 每个选项编译为「自动标签 + 内容 + 跳到块尾」，旧式「- 文本 -> 标签」写法保持原样。
        const parseMenuBlock = (start, end) => {
            const line = lines[start];
            const header = parseChoiceHeader(line.text.slice(1).trim());
            const seq = menuSeq;
            menuSeq += 1;
            const choice = {
                'type': 'choice',
                'block': true,
                'speaker': header.speaker,
                'expression': header.expression,
                'prompt': header.prompt,
                'options': [],
            };
            choice.indent = line.indent;
            nodes.push(choice);

            // 只把块内最外层缩进的「-」行当作选项；嵌套菜单的选项缩进更深，不会被误认
            let optionIndent = -1;
            for (let index = start + 1; index < end; index += 1) {
                const item = lines[index];
                if (!/^-\s*/.test(item.text)) continue;
                if (optionIndent < 0 || item.indent < optionIndent) optionIndent = item.indent;
            }
            const optionLines = [];
            if (optionIndent >= 0) {
                for (let index = start + 1; index < end; index += 1) {
                    if (lines[index].indent === optionIndent && /^-\s*/.test(lines[index].text)) optionLines.push(index);
                }
            }
            if (!optionLines.length) errors.push(`第 ${line.lineIndex + 1} 行菜单块内没有任何选项。`);

            optionLines.forEach((optionLine, position) => {
                const segmentEnd = position + 1 < optionLines.length ? optionLines[position + 1] : end;
                const optionLineInfo = lines[optionLine];
                const raw = optionLineInfo.text.replace(/^-\s*/, '').trim();
                const arrow = /^(.+?)\s*->\s*(.+)$/.exec(raw);
                const option = { 'text': arrow ? arrow[1].trim() : raw, 'target': '', 'explicit': Boolean(arrow) };
                choice.options.push(option);
                if (!option.text) errors.push(`第 ${optionLineInfo.lineIndex + 1} 行菜单选项文字为空。`);
                if (arrow) {
                    option.target = arrow[2].trim();
                    if (segmentEnd > optionLine + 1) {
                        errors.push(`第 ${optionLineInfo.lineIndex + 1} 行菜单选项既写了“-> 标签”又带缩进内容，二者只能选一种。`);
                        parseRange(optionLine + 1, segmentEnd);
                    }
                    return;
                }
                option.target = `__menu_${seq}_${position}`;
                labels[option.target] = nodes.length;
                const labelNode = { 'type': 'label', 'name': option.target, 'auto': 'menu', 'menu': seq, 'option': position };
                labelNode.indent = optionIndent < 0 ? line.indent + 1 : optionIndent;
                nodes.push(labelNode);
                const before = nodes.length;
                parseRange(optionLine + 1, segmentEnd);
                option.body_nodes = nodes.slice(before);
                const jumpNode = { 'type': 'jump', 'target': `__menu_end_${seq}`, 'auto': 'menu', 'menu': seq };
                jumpNode.indent = optionIndent < 0 ? line.indent + 1 : optionIndent;
                nodes.push(jumpNode);
            });

            const endNode = { 'type': 'choice_end', 'auto': 'menu', 'menu': seq };
            endNode.indent = line.indent;
            nodes.push(endNode);
            labels[`__menu_end_${seq}`] = nodes.length;
            const endLabel = { 'type': 'label', 'name': `__menu_end_${seq}`, 'auto': 'menu_end', 'menu': seq };
            endLabel.indent = line.indent;
            nodes.push(endLabel);
            return end + 1;
        };

        // 封装块：定义 名称 / 内容 / 结束定义
        // 播放时遇到定义行整块跳过，由「调用 名称」进入；块内执行到「结束定义」（或「返回」）时回到调用点。
        const parseDefBlock = (start, end) => {
            const line = lines[start];
            const name = line.text.slice(2).trim();
            if (!name) errors.push(`第 ${line.lineIndex + 1} 行封装块缺少名称。`);
            const defNode = { 'type': 'def', 'name': name };
            defNode.indent = line.indent;
            nodes.push(defNode);
            parseRange(start + 1, end);
            const endNode = { 'type': 'def_end', 'name': name };
            endNode.indent = line.indent;
            nodes.push(endNode);
            return end + 1;
        };

        const parseRange = (from, to) => {
            let pending = null;
            let index = from;
            while (index < to) {
                const line = lines[index];
                const text_ = line.text;
                const indent = line.indent;
                const lineIndex = line.lineIndex;
                if (!text_ || text_.startsWith('#')) { index += 1; continue; }

                // 统一写入行首缩进，供编辑器回填时还原手动缩进
                const push = (node) => { node.indent = indent; nodes.push(node); return node; };

                // 选项行：- 文本 -> 标签（旧式选择）
                const option = text_.match(/^-\s*(.+?)\s*->\s*(.+)$/);
                if (option && pending && pending.type === 'choice') {
                    pending.options.push({ 'text': option[1].trim(), 'target': option[2].trim() });
                    index += 1;
                    continue;
                }

                // 剧情级设置：对话框不透明度=60（可写在任意位置，播放时跳过；不影响后续对局配置）
                const setting = text_.match(/^([^\s=]+)\s*=\s*(.*)$/);
                if (setting && STORY_SETTING_KEYS.includes(setting[1])) {
                    const value = parseDialogueOpacity(setting[2]);
                    if (value === null) errors.push(`第 ${lineIndex + 1} 行对话框不透明度无效：${setting[2]}（应为 0-100 的整数）`);
                    push({ 'type': 'setting', 'key': 'opacity', 'value': value === null ? DEFAULT_DIALOGUE_OPACITY : value, 'raw': setting[2].trim() });
                    index += 1;
                    continue;
                }

                // 对局配置行：键=值
                const config = text_.match(/^([^\s=]+)\s*=\s*(.*)$/);
                if (config && pending && pending.type === 'game' && GAME_KEYS.includes(config[1])) {
                    pending.config_raw[config[1]] = config[2].trim();
                    index += 1;
                    continue;
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
                    index += 1;
                    continue;
                }

                // 条件分支：% IF / ELIF 条件 -> 标签 / % ELSE -> 标签
                if (text_.startsWith('%')) {
                    const body = text_.slice(1).trim();
                    const arrow = body.indexOf('->');
                    if (arrow < 0) { errors.push(`第 ${lineIndex + 1} 行条件分支缺少“-> 标签”：${text_}`); index += 1; continue; }
                    const head = body.slice(0, arrow).trim();
                    const parsedTarget = parseCondTarget(body.slice(arrow + 2));
                    const target = parsedTarget.target;
                    if (!target) errors.push(`第 ${lineIndex + 1} 行条件分支的目标不能为空。`);
                    if (/^else$/i.test(head)) {
                        push(Object.assign({ 'type': 'cond', 'kind': 'else', 'condition': null, 'target': target }, condTargetProps(parsedTarget)));
                        pending = null;
                        index += 1;
                        continue;
                    }
                    const kind = /^elif\b/i.test(head) ? 'elif' : 'if';
                    const parsedCondition = parseCondHead(head.replace(/^(?:if|elif)\b\s*/i, ''));
                    if (parsedCondition.error) { errors.push(`第 ${lineIndex + 1} 行${parsedCondition.error}`); index += 1; continue; }
                    // 条件「检测落子」只允许写在「对局」块内
                    if (parsedCondition.data.condition === 'move' && !gameDepth) {
                        errors.push(`第 ${lineIndex + 1} 行条件「检测落子」必须位于「对局」块内，对局框外不可使用。`);
                        index += 1;
                        continue;
                    }
                    push(Object.assign({ 'type': 'cond', 'kind': kind, 'target': target }, condTargetProps(parsedTarget), parsedCondition.data));
                    pending = null;
                    index += 1;
                    continue;
                }

                // 结构化菜单块优先于旧式选择节点
                if (text_.startsWith('?')) {
                    const end = findMenuEnd(index + 1, to, indent);
                    if (end >= 0) {
                        index = parseMenuBlock(index, end);
                        pending = null;
                        continue;
                    }
                }

                // 封装块
                if (/^定义(?:\s|$)/.test(text_)) {
                    const end = findDefEnd(index + 1, to, indent);
                    if (end < 0) {
                        errors.push(`第 ${lineIndex + 1} 行封装块缺少「结束定义」。`);
                        index += 1;
                        pending = null;
                        continue;
                    }
                    index = parseDefBlock(index, end);
                    pending = null;
                    continue;
                }

                if (text_ === '结束选择' || text_ === '结束定义') {
                    errors.push(`第 ${lineIndex + 1} 行「${text_}」没有对应的开始标记。`);
                    index += 1;
                    continue;
                }

                // 调用封装块 / 提前返回
                if (/^调用(?:\s|$)/.test(text_)) {
                    const target = text_.slice(2).trim();
                    push({ 'type': 'call', 'target': target });
                    pending = null;
                    index += 1;
                    continue;
                }
                if (text_ === '返回') {
                    push({ 'type': 'return' });
                    pending = null;
                    index += 1;
                    continue;
                }

                if (text_.startsWith('?')) {
                    // 旧式选择节点可携带角色表情：? [角色|表情] 提示
                    const header = parseChoiceHeader(text_.slice(1).trim());
                    pending = push({ 'type': 'choice', 'speaker': header.speaker, 'expression': header.expression, 'prompt': header.prompt, 'options': [] });
                    index += 1;
                    continue;
                }

                if (text_.startsWith('*')) {
                    pending = push({ 'type': 'game', 'title': text_.slice(1).trim(), 'config_raw': {} });
                    gameDepth += 1;
                    index += 1;
                    continue;
                }

                // 对局块结束标记：结束此对局（仅作分块边界，运行时按普通节点跳过）
                if (GAME_END_KEYWORDS.includes(text_)) {
                    push({ 'type': 'game_end' });
                    pending = null;
                    gameDepth = Math.max(0, gameDepth - 1);
                    index += 1;
                    continue;
                }

                // 旧分组框：框 标题 色=#6f42c1 / 结束框
                // 兼容旧剧本：读取时自动转换为带颜色的标签块，播放时按普通标签跳过。
                if (text_ === '结束框' || text_ === '框结束') {
                    push({ 'type': 'label_end' });
                    pending = null;
                    index += 1;
                    continue;
                }
                if (/^框(?:\s|$)/.test(text_)) {
                    const { 'color': boxColor } = jqbjLabelParts(text_.slice(1));
                    // 旧框按出现顺序命名为 1、2、3…（忽略原框标题）
                    legacyBoxSeq += 1;
                    let name = String(legacyBoxSeq);
                    let suffix = 1;
                    while (legacyLabelNames.has(name)) name = `${legacyBoxSeq}_${suffix += 1}`;
                    legacyLabelNames.add(name);
                    labels[name] = nodes.length;
                    push({ 'type': 'label', 'name': name, 'color': boxColor || null, 'block': true });
                    pending = null;
                    index += 1;
                    continue;
                }

                // 标注：@ 箭头 锚点 / @ 圈 5,5 / @ 清除（可选 色=#ff3b30）
                if (text_.startsWith('@')) {
                    const tokens = text_.slice(1).trim().split(/\s+/).filter(Boolean);
                    const kind = MARK_KIND_MAP[tokens[0]] || null;
                    if (!kind) {
                        errors.push(`第 ${lineIndex + 1} 行标注类型无效：${text_}`);
                        index += 1;
                        continue;
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
                    index += 1;
                    continue;
                }

                if (text_.startsWith(':')) {
                    const name = text_.slice(1).trim();
                    labels[name] = nodes.length;
                    push({ 'type': 'label', 'name': name });
                    pending = null;
                    index += 1;
                    continue;
                }

                if (text_.startsWith('->')) {
                    push({ 'type': 'jump', 'target': text_.slice(2).trim() });
                    pending = null;
                    index += 1;
                    continue;
                }

                if (END_TARGETS.includes(text_)) {
                    push({ 'type': 'end' });
                    pending = null;
                    index += 1;
                    continue;
                }

                // 继续对局：步数对话播完后回到当前对局
                if (RESUME_KEYWORDS.includes(text_)) {
                    push({ 'type': 'resume' });
                    pending = null;
                    index += 1;
                    continue;
                }

                errors.push(`第 ${lineIndex + 1} 行无法识别：${text_}`);
                index += 1;
            }
        };

        parseRange(0, lines.length);

        // 旧语法：把对局块内的「检测落子」条件抽成即时触发（与 JQBJ 解析器保持一致）
        const oldGameStack = [];
        let oldCondChain = [];
        const flushOldCondChain = () => {
            const game = oldGameStack[oldGameStack.length - 1];
            if (game && oldCondChain.length) {
                if (!Array.isArray(game.detections)) game.detections = [];
                collectMoveCondTriggers(oldCondChain, game.detections);
            }
            oldCondChain = [];
        };
        nodes.forEach((node) => {
            if (node.type === 'game') { flushOldCondChain(); oldGameStack.push(node); return; }
            if (node.type === 'game_end') { flushOldCondChain(); oldGameStack.pop(); return; }
            if (node.type === 'cond' && oldGameStack.length) { oldCondChain.push(node); return; }
            flushOldCondChain();
        });
        flushOldCondChain();

        nodes.forEach((node) => {
            if (node.type === 'game') {
                node.config = normalizeGameConfig(node.config_raw);
                node.config.detections = Array.isArray(node.detections) ? node.detections : [];
                node.config.step_detections = Array.isArray(node.step_detections) ? node.step_detections : [];
                delete node.config_raw;
                delete node.detections;
                delete node.step_detections;
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
        const { nodes, labels, errors, tree } = StoryScript.parse(text);
        const result = [...errors];
        if (tree) result.push(...validateJQBJTree(tree));

        const hasTarget = (name) => Object.prototype.hasOwnProperty.call(labels, name) || END_TARGETS.includes(name);
        const defNames = new Set();
        nodes.forEach((node) => {
            if (node.type === 'def' && node.name) defNames.add(node.name);
        });

        nodes.forEach((node, index) => {
            if (node.type === 'choice') {
                if (!node.options.length) result.push(`第 ${index + 1} 个节点的选项为空。`);
                node.options.forEach((item) => {
                    if (!item.text) result.push(`第 ${index + 1} 个节点存在空选项文字。`);
                    if (!hasTarget(item.target)) result.push(`选项“${item.text}”指向了不存在的标签：${item.target}`);
                });
            } else if (node.type === 'call') {
                if (!node.target) result.push(`第 ${index + 1} 次调用缺少封装块名称。`);
                else if (!defNames.has(node.target)) result.push(`调用了不存在的封装块：${node.target}`);
            } else if (node.type === 'def') {
                if (!node.name) result.push(`第 ${index + 1} 个封装块缺少名称。`);
            } else if (node.type === 'jump') {
                if (!hasTarget(node.target)) result.push(`跳转指向了不存在的标签：${node.target}`);
            } else if (node.type === 'call_label') {
                if (!node.target) result.push(`第 ${index + 1} 次调用标签缺少目标标签。`);
                else if (!hasTarget(node.target)) result.push(`调用了不存在的标签：${node.target}`);
            } else if (node.type === 'cond') {
                if (node.action === 'resume') {
                    // 继续对局无需目标
                } else if (!node.target) {
                    result.push(`第 ${index + 1} 个条件分支缺少目标标签或封装块。`);
                } else if (node.call) {
                    if (!defNames.has(node.target)) result.push(`条件分支调用了不存在的封装块：${node.target}`);
                } else if (node.call_label) {
                    if (!hasTarget(node.target)) result.push(`条件分支调用了不存在的标签：${node.target}`);
                } else if (!hasTarget(node.target)) result.push(`条件分支指向了不存在的标签：${node.target}`);
            } else if (node.type === 'game') {
                const config = node.config;
                if (config.self_text && config.self === null) result.push(`对局“${node.title}”的“我方”不是黑/白：${config.self_text}`);
                if (config.first_text && config.first === null) result.push(`对局“${node.title}”的“先手”不是黑/白：${config.first_text}`);
                ['win', 'lose', 'draw'].forEach((key) => {
                    if (config[key] && !hasTarget(config[key])) result.push(`对局“${node.title}”的“${key}”指向了不存在的标签：${config[key]}`);
                });
                if (config.points_text && config.points.length === 0) result.push(`对局“${node.title}”的刷草点格式无效：${config.points_text}`);
                if (config.schedule_text && config.schedule.length === 0) result.push(`对局“${node.title}”的刷草计划格式无效：${config.schedule_text}（应形如 3:5,5;6,5|9:3,3）`);
                if (config.end_text && !config.end_kind) result.push(`对局“${node.title}”的“结束对局”格式无效：${config.end_text}（应为 胜负 或 步数:12）`);
                if (config.post_text && !config.post) result.push(`对局“${node.title}”的“结束后”格式无效：${config.post_text}（应为 结果 或 继续）`);
                if (config.dialogues_text && !config.dialogues.length) result.push(`对局“${node.title}”的“步数对话”触发格式无效：${config.dialogues_text}（应形如 3:标签|落子5,5:标签|拿起:标签|AI拿起:标签）`);
                (config.dialogues || []).forEach((item) => {
                    if (item.type === 'cell' && (item.x == null || item.y == null)) result.push(`对局“${node.title}”的对话触发坐标无效：${item.cell_text || ''}（应形如 5,5，取值 1-9）`);
                    if (!hasTarget(item.target)) result.push(`对局“${node.title}”的对话触发指向了不存在的标签：${item.target}`);
                });
                (config.detections || []).forEach((item) => {
                    // 由对局块内条件行抽出的即时触发，坐标/标签沿用条件本身，这里不重复校验
                    if (item.from_cond) return;
                    if (item.x == null || item.y == null) result.push(`对局“${node.title}”的检测落子坐标无效：${item.cell_text || ''}（应形如 5,5，取值 1-9）`);
                    if (!hasTarget(item.target)) result.push(`对局“${node.title}”的检测落子指向了不存在的标签：${item.target}`);
                });
                (config.step_detections || []).forEach((item) => {
                    if (!(item.step >= 0)) result.push(`对局“${node.title}”的检测步数必须是 0 或更大的整数。`);
                    if (!hasTarget(item.target)) result.push(`对局“${node.title}”的检测步数指向了不存在的标签：${item.target}`);
                });
            } else if (node.type === 'mark') {
                if (node.kind === 'arrow') {
                    const anchor = String(node.target || '').trim();
                    if (!anchor) result.push(`第 ${index + 1} 个标注的箭头缺少锚点。`);
                    else if (!anchor.startsWith('#') && !MARK_ANCHORS.includes(anchor)) result.push(`箭头锚点未知：${anchor}（可用 ${MARK_ANCHORS.join(' / ')} 或 #元素id）`);
                } else if (node.kind === 'circle') {
                    if (!node.cell) result.push(`第 ${index + 1} 个标注的圈坐标无效：${node.target}（应形如 5,5，取值 1-9，先横后竖）`);
                }
            } else if (node.type === 'setting') {
                if (node.key === 'opacity' && parseDialogueOpacity(node.raw) === null) result.push(`第 ${index + 1} 个设置的对话框不透明度无效：${node.raw}（应为 0-100 的整数）`);
            }
        });

        // 标签：颜色必须合法；标签块（带「结束标签」）必须成对出现，单独标签保持旧写法兼容
        const labelStack = [];
        nodes.forEach((node, index) => {
            if (node.type === 'label') {
                if (node.color && !LABEL_COLOR_RE.test(node.color)) result.push(`第 ${index + 1} 个标签的颜色无效：${node.color}（应形如 #6f42c1）`);
                if (node.block) labelStack.push(index);
            } else if (node.type === 'label_end') {
                if (!labelStack.length) result.push(`第 ${index + 1} 个「结束标签」没有对应的「标签」。`);
                else labelStack.pop();
            }
        });
        if (labelStack.length) result.push(`第 ${labelStack[labelStack.length - 1] + 1} 个标签块缺少「结束标签」。`);

        // 封装块与结构化菜单块：必须成对出现，「返回」只能在封装块内使用
        const defStack = [];
        const menuStack = [];
        const defSeen = new Set();
        let defDepth = 0;
        nodes.forEach((node, index) => {
            if (node.type === 'def') {
                if (defStack.length) result.push(`第 ${index + 1} 个「定义」不能嵌套在另一个封装块内。`);
                if (node.name) {
                    if (defSeen.has(node.name)) result.push(`封装块名称重复：${node.name}`);
                    defSeen.add(node.name);
                }
                defStack.push(index);
                defDepth += 1;
            } else if (node.type === 'def_end') {
                if (!defStack.length) result.push(`第 ${index + 1} 个「结束定义」没有对应的「定义」。`);
                else defStack.pop();
                defDepth = Math.max(0, defDepth - 1);
            } else if (node.type === 'choice' && node.block) {
                menuStack.push(index);
            } else if (node.type === 'choice_end') {
                if (!menuStack.length) result.push(`第 ${index + 1} 个「结束选择」没有对应的菜单块。`);
                else menuStack.pop();
            } else if (node.type === 'return' && !defDepth) {
                result.push(`第 ${index + 1} 个「返回」必须位于封装块内。`);
            }
        });
        if (defStack.length) result.push(`第 ${defStack[defStack.length - 1] + 1} 个「定义」缺少「结束定义」。`);
        if (menuStack.length) result.push(`第 ${menuStack[menuStack.length - 1] + 1} 个菜单块缺少「结束选择」。`);

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
        const emitted = new Set();
        // 标签块结束标记按配对标签的缩进输出，兼容旧分组框不规则缩进
        const labelIndents = [];
        let indentFloor = 0;
        const padAt = (indent) => '  '.repeat(Math.max(indentFloor, 0, Math.min(10, Math.trunc(Number(indent) || 0))));
        const pad = (node) => padAt(node.indent);
        const faceText = (node) => (node.speaker ? (node.expression ? `[${node.speaker}|${node.expression}] ` : `[${node.speaker}] `) : '');
        function emitList(list) { (list || []).forEach(emitNode); }
        function emitNode(node) {
            // 自动生成的标签/跳转与结构化选项内容由各自的容器负责输出，避免重复
            if (!node || node.auto || emitted.has(node)) return;
            emitted.add(node);
            const lead = pad(node);
            if (node.type === 'say') lines.push(lead + (node.expression ? `[${node.speaker}|${node.expression}] ${node.text}` : `[${node.speaker}] ${node.text}`));
            else if (node.type === 'choice') {
                const face = faceText(node);
                lines.push(lead + `? ${face}${node.prompt}`);
                if (!node.block) {
                    (node.options || []).forEach((item) => lines.push(lead + `- ${item.text} -> ${item.target}`));
                    return;
                }
                const level = Math.max(indentFloor, 0, Math.min(10, Math.trunc(Number(node.indent) || 0)));
                const optionLead = '  '.repeat(Math.min(10, level + 1));
                (node.options || []).forEach((item) => {
                    if (item.explicit) {
                        lines.push(`${optionLead}- ${item.text} -> ${item.target}`);
                        return;
                    }
                    lines.push(`${optionLead}- ${item.text}`);
                    const prevFloor = indentFloor;
                    indentFloor = Math.max(indentFloor, Math.min(10, level + 1));
                    emitList(item.body_nodes);
                    indentFloor = prevFloor;
                });
                lines.push(lead + '结束选择');
            } else if (node.type === 'choice_end') return;
            else if (node.type === 'def') lines.push(lead + `定义 ${node.name}`);
            else if (node.type === 'def_end') lines.push(lead + '结束定义');
            else if (node.type === 'call') lines.push(lead + `调用 ${node.target}`);
            else if (node.type === 'return') lines.push(lead + '返回');
            else if (node.type === 'game') {
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
                (config.detections || []).forEach((item) => {
                    // 条件行抽出的即时触发由下方的对局块内语句还原，避免重复输出
                    if (item.from_cond) return;
                    lines.push(`${configLead}检测 ${item.negate ? '不在 ' : ''}${Math.max(1, Math.trunc(Number(item.step) || 1))} ${item.cell_text || ''} -> ${item.target}`);
                });
                (config.step_detections || []).forEach((item) => {
                    const step = Number.isFinite(Math.trunc(Number(item.step))) ? Math.max(0, Math.trunc(Number(item.step))) : 1;
                    lines.push(`${configLead}检测步数 ${step} -> ${item.target}`);
                });
                // 对局块内的语句（含「检测落子」条件）必须还原在「对局」块内，否则会因作用域校验失败
                if (Array.isArray(node.body_nodes) && node.body_nodes.length) emitList(node.body_nodes);
            } else if (node.type === 'label') {
                // 纯跳转标记沿用旧写法 :名称；带颜色/标签块才输出新「标签 … 结束标签」语法
                if (node.color || node.block || node.manual) {
                    lines.push(lead + `标签 ${node.name}${node.color ? ` 色=${node.color}` : ''}${node.manual ? ' 不顺序播放' : ''}`);
                    if (node.block) labelIndents.push(Math.max(indentFloor, Math.min(10, Math.trunc(Number(node.indent) || 0))));
                } else lines.push(lead + `:${node.name}`);
            } else if (node.type === 'label_end') {
                const level = labelIndents.length ? labelIndents.pop() : Math.max(indentFloor, Math.min(10, Math.trunc(Number(node.indent) || 0)));
                lines.push('  '.repeat(level) + '结束标签');
            }
            else if (node.type === 'call_label') lines.push(lead + `调用标签 ${node.target}`);
            else if (node.type === 'jump') lines.push(lead + `-> ${node.target}`);
            else if (node.type === 'cond') {
                const target = node.call ? `调用 ${node.target}` : node.call_label ? `调用标签 ${node.target}` : node.action === 'resume' ? '继续对局' : node.target;
                if (node.kind === 'else') lines.push(lead + `% ELSE -> ${target}`);
                else lines.push(lead + `% ${node.kind === 'elif' ? 'ELIF' : 'IF'} ${condToText(node)} -> ${target}`);
            } else if (node.type === 'end') lines.push(lead + '结束');
            else if (node.type === 'resume') lines.push(lead + '继续对局');
            else if (node.type === 'game_end') lines.push(lead + '结束此对局');
            else if (node.type === 'setting') {
                lines.push(lead + `${STORY_SETTING_KEYS[0]}=${node.value == null ? DEFAULT_DIALOGUE_OPACITY : node.value}`);
            }
            else if (node.type === 'mark') {
                const tail = node.color ? ` 色=${node.color}` : '';
                if (node.kind === 'clear') lines.push(lead + '@ 清除');
                else if (node.kind === 'arrow') lines.push(lead + `@ 箭头 ${node.target || ''}${tail}`.trimEnd());
                else if (node.kind === 'circle') { const cell = node.cell || [4, 4]; const point = fromBoardPoint(cell[0], cell[1]); lines.push(lead + `@ 圈 ${point[0]},${point[1]}${tail}`); }
            }
        }
        emitList(nodes);
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
        // 玩家落子位置（按玩家自己的落子顺序），供「检测落子 / 第几步落子」条件判定
        this.player_moves = [];
        // 最近一次用户选择的选项 {index, text}，供「选项」条件判定
        this.last_choice = null;
        // JQBJ 变量表：name -> {type, value}；类型由首次声明固定
        this.vars = Object.create(null);
        // 重复循环的运行状态：loop_id -> {i, count}
        this.loop_state = Object.create(null);
        // 封装块调用栈：保存每次「调用」之后的返回位置
        this.call_stack = [];
        // 标签调用栈：保存每次「调用标签」之后的返回位置，遇到「结束标签」时返回
        this.label_calls = [];
        this.defs = {};
        this.def_ranges = {};
        // 条件链命中记录：同一缩进的 IF / ELIF 命中后，后续 ELIF / ELSE 不再执行
        this.cond_hits = new Set();
        // 标签节点 -> 对应「结束标签」节点位置，用于「不顺序播放」标签的整块跳过
        this.label_ends = {};
        this.collect_defs();
        this.settle();
    }

    /**
     * @description: 收集封装块入口与结束位置，供调用/跳过使用
     * @return {void}
     */
    collect_defs() {
        const stack = [];
        const labelStack = [];
        this.nodes.forEach((node, index) => {
            if (!node) return;
            if (node.type === 'def') stack.push({ 'name': node.name, 'start': index });
            else if (node.type === 'def_end' && stack.length) {
                const entry = stack.pop();
                this.def_ranges[entry.start] = index;
                if (!Object.prototype.hasOwnProperty.call(this.defs, entry.name)) this.defs[entry.name] = { 'start': entry.start, 'end': index };
            }
            if (node.type === 'label' && node.block) labelStack.push(index);
            else if (node.type === 'label_end' && labelStack.length) this.label_ends[labelStack.pop()] = index;
        });
    }

    /**
     * @description: 跳过标签、未调用的封装块、调用/返回等无展示节点
     * @return {object}
     */
    settle() {
        let guard = 0;
        while (this.index < this.nodes.length) {
            if (guard++ > 200000) break;
            const node = this.nodes[this.index];
            if (!node) break;
            if (node.type === 'label') {
                // 「不顺序播放」的标签只在被跳转/调用时进入，顺序播放时整块跳过
                if (node.manual) {
                    const blockEnd = this.label_ends[this.index];
                    this.index = typeof blockEnd === 'number' ? blockEnd + 1 : this.index + 1;
                    continue;
                }
                this.index++;
                continue;
            }
            if (node.type === 'label_end') {
                if (this.label_calls.length) { this.index = this.label_calls.pop(); continue; }
                this.index++;
                continue;
            }
            // 剧情级设置（如对话框不透明度）只在播放前读取，不参与剧情推进
            if (node.type === 'setting') { this.index++; continue; }
            if (node.type === 'declare') { this.declare_var(node); this.index++; continue; }
            if (node.type === 'assign') { this.assign_var(node); this.index++; continue; }
            if (node.type === 'if') {
                if (this.eval_condition(node.cond) && this.enter_label(node.target)) continue;
                this.index++;
                continue;
            }
            if (node.type === 'while') {
                this.enter_label(this.eval_condition(node.cond) ? node.body : node.end);
                continue;
            }
            if (node.type === 'until') {
                this.enter_label(this.eval_condition(node.cond) ? node.end : node.body);
                continue;
            }
            if (node.type === 'repeat') {
                const count = Math.max(0, Math.min(10000, Math.floor(Number(this.value_of(node.count_raw)) || 0)));
                this.loop_state[node.loop_id] = { 'i': 0, 'count': count };
                if (count <= 0) this.enter_label(node.end);
                else this.index++;
                continue;
            }
            if (node.type === 'repeat_end') {
                const state = this.loop_state[node.loop_id];
                if (!state) { this.index++; continue; }
                state.i += 1;
                if (state.i < state.count) this.enter_label(node.body);
                else { delete this.loop_state[node.loop_id]; this.index++; }
                continue;
            }
            if (node.type === 'break' || node.type === 'continue') {
                if (!this.enter_label(node.target)) this.index++;
                continue;
            }
            if (node.type === 'def') {
                const end = this.def_ranges[this.index];
                this.index = typeof end === 'number' ? end + 1 : this.index + 1;
                continue;
            }
            if (node.type === 'def_end') {
                if (this.call_stack.length) { this.index = this.call_stack.pop(); continue; }
                this.index++;
                continue;
            }
            if (node.type === 'choice_end') { this.index++; continue; }
            if (node.type === 'call') {
                const def = this.defs[node.target];
                if (!def || this.call_stack.length >= 64) { this.index++; continue; }
                this.call_stack.push(this.index + 1);
                this.index = def.start + 1;
                continue;
            }
            if (node.type === 'call_label') {
                if (this.label_calls.length >= 64 || !Object.prototype.hasOwnProperty.call(this.labels, node.target)) { this.index++; continue; }
                this.label_calls.push(this.index + 1);
                this.enter_label(node.target);
                continue;
            }
            if (node.type === 'return') {
                if (this.call_stack.length) { this.index = this.call_stack.pop(); continue; }
                this.index++;
                continue;
            }
            // 结构化菜单自动生成的“跳到块尾”由状态机直接执行，不暴露给播放页
            if (node.type === 'jump' && node.auto) {
                if (this.enter_label(node.target)) continue;
                this.index++;
                continue;
            }
            break;
        }
        return this.current();
    }

    skip_labels() {
        while (this.index < this.nodes.length && this.nodes[this.index].type === 'label') this.index++;
    }

    /**
     * @description: 进入标签体（跳过标签节点本身）；「不顺序播放」的标签被跳转/调用时仍会正常播放
     * @param {string} name
     * @return {boolean} 标签是否存在
     */
    enter_label(name) {
        if (!Object.prototype.hasOwnProperty.call(this.labels, name)) return false;
        this.index = this.labels[name] + 1;
        return true;
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
        this.settle();
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
            this.enter_label(name);
            this.settle();
        }
        return this.current();
    }

    /**
     * @description: 找到当前条件节点所属条件链的起始位置（同缩进、连续的 IF/ELIF/ELSE）
     * @param {number} index 条件节点位置
     * @return {number} 条件链起始位置
     */
    cond_chain_start(index) {
        const node = this.nodes[index];
        if (!node) return index;
        let start = index;
        while (start > 0) {
            const prev = this.nodes[start - 1];
            if (!prev || prev.type !== 'cond' || prev.indent !== node.indent) break;
            start -= 1;
        }
        return start;
    }

    /**
     * @description: 进入封装块，执行到「结束定义 / 返回」时回到本行下一行
     * @param {string} name 封装块名称
     * @return {boolean} 封装块是否存在
     */
    enter_def(name) {
        const def = this.defs[name];
        if (!def || this.call_stack.length >= 64) return false;
        this.call_stack.push(this.index + 1);
        this.index = def.start + 1;
        return true;
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
        this.last_choice = { 'index': option_index, 'text': this.interpolate(option.text) };
        return this.goto(option.target);
    }

    /**
     * @description: 记录一次落子（供「检测落子 / 第几步落子」条件与检测触发使用）
     * @param {'player' | 'ai'} source 落子方
     * @param {number} x 棋盘横坐标（0-8）
     * @param {number} y 棋盘纵坐标（0-8，左下原点）
     * @return {void}
     */
    record_move(source, x, y) {
        if (source !== 'player') return;
        this.player_moves.push([x, y]);
    }

    /**
     * @description: 判断条件分支是否命中
     * @param {object} node 条件节点
     * @return {boolean}
     */
    cond_matches(node) {
        if (!node) return false;
        const condition = node.condition;
        if (condition === 'move') {
            const move = this.player_moves[Math.max(0, Number(node.step || 1) - 1)];
            // 条件里的坐标是作者坐标（1-9，先横后竖），落子记录是棋盘坐标（0-8，左上原点）
            const point = toBoardPoint(node.x, node.y);
            if (!Array.isArray(move) || !point) return false;
            const at = move[0] === point[0] && move[1] === point[1];
            // 「不在」：该手已落下且没有落在指定交叉点时命中
            return node.negate ? !at : at;
        }
        if (condition === 'step') {
            return this.player_moves.length >= Math.max(1, Number(node.step || 1));
        }
        if (condition === 'option') {
            if (!this.last_choice) return false;
            const wanted = String(node.option == null ? '' : node.option).trim();
            if (!wanted) return false;
            if (/^\d+$/.test(wanted)) return this.last_choice.index + 1 === Number(wanted);
            return String(this.last_choice.text == null ? '' : this.last_choice.text).trim() === wanted;
        }
        return this.last_outcome === condition;
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
     * @description: 条件分支（% IF / % ELIF / % ELSE）判定：命中则跳转，未命中则前进到下一个节点
     * @param {object} node
     * @return {object}
     */
    step_cond(node) {
        if (!node) return this.current();
        // 对局块内的「检测落子」条件已改为对局中即时触发，流程推进到此处时直接跳过
        if (node.consumed) return this.advance();
        const chainStart = this.cond_chain_start(this.index);
        // 新的 IF 开启一条条件链，清掉上一轮的命中记录
        if (node.kind === 'if') this.cond_hits.delete(chainStart);
        // 同缩进的前序 IF / ELIF 已命中时，ELIF / ELSE 不再执行
        else if (this.cond_hits.has(chainStart)) return this.advance();
        if (node.kind === 'else' || this.cond_matches(node)) {
            this.cond_hits.add(chainStart);
            // 目标为封装块：像「调用」一样进入，播完回到本行下一行
            if (node.call) {
                if (!this.enter_def(node.target)) return this.advance();
                this.settle();
                return this.current();
            }
            // 目标为标签：像「调用标签」一样进入，播到「结束标签」回到本行下一行
            if (node.call_label) {
                if (this.label_calls.length >= 64 || !Object.prototype.hasOwnProperty.call(this.labels, node.target)) return this.advance();
                this.label_calls.push(this.index + 1);
                this.enter_label(node.target);
                this.settle();
                return this.current();
            }
            // 目标为继续对局：停到其后的「继续对局」节点，由播放页回到棋盘
            if (node.action === 'resume') {
                for (let index = this.index + 1; index < this.nodes.length; index += 1) {
                    const next = this.nodes[index];
                    if (next && next.type === 'resume') {
                        this.index = index;
                        this.settle();
                        return this.current();
                    }
                }
                return this.advance();
            }
            return this.goto(node.target);
        }
        return this.advance();
    }

    /**
     * @description: 变量插值：把台词/选项文案里的 ${变量名} 替换为当前值
     * @param {string} text
     * @return {string}
     */
    interpolate(text) {
        return String(text == null ? '' : text).replace(/\$\{([^}]+)\}/g, (whole, name) => {
            const key = String(name).trim();
            return Object.prototype.hasOwnProperty.call(this.vars, key) ? this.format_value(this.vars[key].value) : whole;
        });
    }

    format_value(value) {
        if (typeof value === 'boolean') return value ? '真' : '假';
        return String(value == null ? '' : value);
    }

    /** 解析 JQBJ 值：真/假、引号字符串、数字、已声明变量，其余按裸字符串处理 */
    value_of(raw) {
        const text = String(raw == null ? '' : raw).trim();
        if (text === '真') return true;
        if (text === '假') return false;
        if (/^"(?:[^"\\]|\\.)*"$/.test(text) || /^'(?:[^'\\]|\\.)*'$/.test(text)) return this.interpolate(jqbjUnquote(text));
        if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
        const name = text;
        if (JQBJ_NAME_RE.test(name) && Object.prototype.hasOwnProperty.call(this.vars, name)) return this.vars[name].value;
        return this.interpolate(text);
    }

    type_of_value(raw) {
        const text = String(raw == null ? '' : raw).trim();
        if (text === '真' || text === '假') return 'boolean';
        if (/^"(?:[^"\\]|\\.)*"$/.test(text) || /^'(?:[^'\\]|\\.)*'$/.test(text)) return 'string';
        if (/^-?\d+(?:\.\d+)?$/.test(text)) return 'number';
        if (JQBJ_NAME_RE.test(text) && Object.prototype.hasOwnProperty.call(this.vars, text)) return this.vars[text].type;
        return 'string';
    }

    declare_var(node) {
        const value = this.value_of(node.value_raw);
        const type = node.op === '=' ? this.type_of_value(node.value_raw) : (node.op === '&=' ? 'string' : 'number');
        const initial = node.op === '=' ? value : (type === 'number' ? 0 : '');
        this.vars[node.name] = { 'type': type, 'value': initial };
        if (node.op !== '=') this.apply_op(node.name, node.op, value);
    }

    assign_var(node) {
        if (!Object.prototype.hasOwnProperty.call(this.vars, node.name)) return;
        if (node.op === '=') {
            this.vars[node.name].value = this.value_of(node.value_raw);
            return;
        }
        this.apply_op(node.name, node.op, this.value_of(node.value_raw));
    }

    apply_op(name, op, value) {
        const entry = this.vars[name];
        if (!entry) return;
        if (op === '&=') { entry.value = String(entry.value) + String(value); return; }
        const left = Number(entry.value);
        const right = Number(value);
        if (!Number.isFinite(left) || !Number.isFinite(right)) return;
        if (op === '+=') entry.value = left + right;
        else if (op === '-=') entry.value = left - right;
        else if (op === '*=') entry.value = left * right;
        else if (op === '/=') entry.value = right === 0 ? left : left / right;
        else if (op === '%=') entry.value = right === 0 ? left : left % right;
    }

    eval_condition(cond) {
        if (!cond || !cond.ast) return false;
        return this.eval_expr(cond.ast) === true;
    }

    /** 求值 v0.4 条件表达式；未声明的裸词按字符串常量处理，兼容旧剧本 */
    eval_expr(expr) {
        if (!expr) return false;
        if (expr.type === 'literal') {
            if (expr.valueType === 'string') return this.interpolate(jqbjUnquote(expr.value));
            return expr.value;
        }
        if (expr.type === 'var') {
            if (Object.prototype.hasOwnProperty.call(this.vars, expr.name)) return this.vars[expr.name].value;
            return this.interpolate(expr.name);
        }
        if (expr.type === 'not') return !(this.eval_expr(expr.expr) === true);
        if (expr.type === 'unary') {
            const value = Number(this.eval_expr(expr.expr));
            return Number.isFinite(value) ? -value : NaN;
        }
        if (expr.type === 'logic') {
            const left = this.eval_expr(expr.left) === true;
            if (expr.op === '与') return left && this.eval_expr(expr.right) === true;
            return left || this.eval_expr(expr.right) === true;
        }
        if (expr.type === 'binary') {
            const left = Number(this.eval_expr(expr.left));
            const right = Number(this.eval_expr(expr.right));
            if (!Number.isFinite(left) || !Number.isFinite(right)) return NaN;
            if (expr.op === '+') return left + right;
            if (expr.op === '-') return left - right;
            if (expr.op === '*') return left * right;
            if (expr.op === '/') return right === 0 ? NaN : left / right;
            if (expr.op === '%') return right === 0 ? NaN : left % right;
            return NaN;
        }
        if (expr.type === 'compare') return this.compare_values(expr.op, this.eval_expr(expr.left), this.eval_expr(expr.right));
        return false;
    }

    compare_values(op, left, right) {
        if (op === '==') return typeof left === typeof right ? left === right : String(left) === String(right);
        if (op === '!=') return typeof left === typeof right ? left !== right : String(left) !== String(right);
        let a = left;
        let b = right;
        if (typeof left !== 'number') a = String(left);
        if (typeof right !== 'number') b = String(right);
        if (op === '>') return a > b;
        if (op === '<') return a < b;
        if (op === '>=') return a >= b;
        if (op === '<=') return a <= b;
        return false;
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
    '@ 圈 5,5',
    '[导员ZERO] 来。试着在这洁白的棋盘上第一次落子吧？',
    '? 准备好后开始第一场实战',
    '- 开始 -> 实战',
    '- 再讲讲 -> 教程开始',
    ':实战',
    '* 对局 第一场实战',
    '  刷草点=5,5;6,5;7,4;4,4;6,4',
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
    '@ 圈 5,5',
    ':进阶实战',
    '* 对局 进阶实战',
    '  刷草点=5,5;3,5;7,5;5,7;5,3',
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

globalThis.StoryExports = { StoryScript, StoryRuntime, DEFAULT_CATALOG, BOARD_SIZE, MARK_ANCHORS, COND_TEXT, COND_MAP, JQBJ_VERSION, parseDialogues, dialoguesToText, toBoardPoint, fromBoardPoint };

export { StoryScript, StoryRuntime, DEFAULT_CATALOG, MARK_ANCHORS, COND_TEXT, COND_MAP, JQBJ_VERSION, parseDialogues, dialoguesToText, toBoardPoint, fromBoardPoint };
