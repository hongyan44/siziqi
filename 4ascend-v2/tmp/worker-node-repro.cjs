/*
 * 以 Node 驱动真实 worker 产物：验证取用弱化接线，并复现“AI 不落子”。
 */
const fs = require('node:fs');
const path = require('node:path');

const APP = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(APP, p), 'utf8');

// --- 浏览器 API 垫片 ---
globalThis.self = globalThis;
globalThis.window = globalThis;

const scripts = [];
/** 期望的落点（用于让确定性模型偏向某个点位）。 */
let preferredAction = -1;

globalThis.importScripts = (...urls) => {
    urls.forEach((url) => {
        // comlink 用下面的 expose 垫片替代；onnxruntime 用 ort 垫片替代。
        if (url.includes('comlink') || url.includes('onnxruntime')) return;
        // 页面上的绝对路径映射到发布目录 root/
        const rel = url.replace(/^\//, '').split('?')[0];
        const clean = path.join('root', rel);
        scripts.push(clean);
        new Function(read(clean))();
    });
};

// --- ONNX 运行时垫片：只替换模型推理，规则/搜索/取用逻辑全部用真实代码 ---
const CELLS = 81;
globalThis.ort = {
    'env': { 'wasm': {} },
    'Tensor': class Tensor {
        constructor(type, data, dims) {
            this.type = type;
            this.data = data;
            this.dims = dims;
        }
    },
    'InferenceSession': {
        async create() {
            return {
                'inputNames': ['state'],
                'outputNames': ['policy_logits', 'value'],
                async run() {
                    const logits = new Float32Array(CELLS).fill(0);
                    if (preferredAction >= 0 && preferredAction < CELLS) logits[preferredAction] = 12;
                    return { 'policy_logits': { 'data': logits }, 'value': { 'data': Float32Array.from([0]) } };
                },
                async release() {},
            };
        },
    },
};

let exposed = null;
globalThis.Comlink = {
    expose(api) {
        exposed = api;
    },
};

// --- 加载真实发布产物 ---
globalThis.importScripts('/js/global/fascend.min.js');
globalThis.importScripts('/js/ai.min.js');

console.log('载入脚本:', scripts.join(', '));
console.log('FAscendExports 含 AiHandicap:', !!globalThis.FAscendExports.AiHandicap);

// --- 评估真实 worker 源码 ---
new Function(read('root/js/worker/ai.min.js'))();
if (!exposed) throw new Error('worker 未通过 Comlink 暴露接口');

const xy = (x, y) => y * 9 + x;

(async () => {
    const results = [];
    const check = (name, cond, extra) => {
        results.push({ name, pass: !!cond, extra: extra === undefined ? null : extra });
    };

    await exposed.AI_INIT();

    // 1) 简单难度：引擎取占草点，且存在玩家打点 → 应改取堵点
    {
        await exposed.ZERO_RESET(1, 100, 0, 6, true, false, '1');
        const game = exposed.ZERO_DEBUG_STATE();
        check('简单难度档位已生效', JSON.stringify(exposed.ZERO_DEBUG_LEVEL()) === JSON.stringify({ option: '1', level: 'easy' }), exposed.ZERO_DEBUG_LEVEL());

        // 白方 3 连 + 左侧被封 → (4,4) 是玩家单独打点
        exposed.ZERO_SET_CELL(xy(1, 4), 2, 0);
        exposed.ZERO_SET_CELL(xy(2, 4), 2, 0);
        exposed.ZERO_SET_CELL(xy(3, 4), 2, 0);
        exposed.ZERO_SET_CELL(xy(0, 4), 1, 0);
        // 给引擎一个占草点 (7,7)
        exposed.ZERO_SET_CELL(xy(7, 7), 0, 1);
        exposed.ZERO_SET_TURN(0, 10, 6, 6);

        preferredAction = xy(7, 7); // 强制 MCTS 取占草点
        const action = await exposed.ZERO_THINK(60, false);
        const search = exposed.ZERO_DEBUG_SEARCH();
        check('简单：占草被改为堵点', action === xy(4, 4) && search.handicapOverride === true && search.handicapReason === 'easy-block-player-ascend',
            { action, reason: search.handicapReason, original: search.handicapOriginal });
    }

    // 2) 普通难度：引擎取卖血点 → 应改取自身打点
    // 注意 ZERO_SET_CELL 只能摆普通子，盘旋子必须由真实落子形成，故走 ZERO_TURN 序列。
    const buildSellBloodPosition = async (level) => {
        await exposed.ZERO_RESET(1, 100, 0, 6, true, false, level);
        // 白方 3 连（普通子），随后由白方自己补成 4 连形成打
        exposed.ZERO_SET_CELL(xy(1, 4), 2, 0);
        exposed.ZERO_SET_CELL(xy(2, 4), 2, 0);
        exposed.ZERO_SET_CELL(xy(3, 4), 2, 0);
        // 黑方 3 连（普通子），(6,5) 可成打
        exposed.ZERO_SET_CELL(xy(6, 6), 1, 0);
        exposed.ZERO_SET_CELL(xy(6, 7), 1, 0);
        exposed.ZERO_SET_CELL(xy(6, 8), 1, 0);
        exposed.ZERO_SET_TURN(0, 10, 6, 6); // 黑方先行
        await exposed.ZERO_TURN(xy(0, 0));  // 黑方走无关点
        await exposed.ZERO_TURN(xy(4, 4));  // 白方补 4 连 → 进入 ASCEND，白方 4 子盘旋
        // 此时轮到黑方，白方盘旋中：(4,4) 即卖血点
    };

    {
        await buildSellBloodPosition('2');
        check('普通难度档位已生效', JSON.stringify(exposed.ZERO_DEBUG_LEVEL()) === JSON.stringify({ option: '2', level: 'normal' }), exposed.ZERO_DEBUG_LEVEL());

        const before = exposed.ZERO_DEBUG_STATE();
        check('局面已进入对手 ASCEND', before.ascendStatus === 1, { ascendStatus: before.ascendStatus, turnPlayer: before.turnPlayer });

        preferredAction = xy(4, 4); // 强制 MCTS 取卖血点
        const action = await exposed.ZERO_THINK(60, false);
        const search = exposed.ZERO_DEBUG_SEARCH();
        check('普通：卖血被改为自身打点', search.handicapOverride === true && search.handicapReason === 'normal-no-sell-blood' && action !== xy(4, 4),
            { action, reason: search.handicapReason, original: search.handicapOriginal });
    }

    // 3) 熟练难度：不参与弱化
    {
        await buildSellBloodPosition('3');
        preferredAction = xy(4, 4);
        const action = await exposed.ZERO_THINK(60, false);
        const search = exposed.ZERO_DEBUG_SEARCH();
        check('熟练难度不参与弱化', action === xy(4, 4) && search.handicapOverride === false, { action });
    }

    // 4) 常规对局：连续落子不报错
    {
        await exposed.ZERO_RESET(1, 100, 0, 6, true, false, '1');
        let ok = true;
        let detail = null;
        try {
            for (let i = 0; i < 12; i++) {
                const a = await exposed.ZERO_THINK(20, false);
                if (!Number.isInteger(a)) {
                    ok = false;
                    detail = `第 ${i} 手返回非法 action=${a}`;
                    break;
                }
            }
        } catch (error) {
            ok = false;
            detail = String(error).slice(0, 200);
        }
        check('简单难度连续 12 手不崩溃', ok, detail);
    }

    const failed = results.filter((r) => !r.pass);
    console.log('\n=== 结果 ===');
    results.forEach((r) => {
        console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.extra === null ? '' : '  ' + JSON.stringify(r.extra)}`);
    });
    console.log(`\n失败数: ${failed.length}`);
    process.exit(failed.length === 0 ? 0 : 1);
})();
