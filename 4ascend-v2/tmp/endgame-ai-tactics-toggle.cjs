/*
 * 残局 AI 战术矫正开关回归测试。
 *
 * 验证 worker 的 ENDGAME_THINK(simulations, useTactics)：
 *  1. useTactics=true 时优先采用 chooseMove 的斩杀 / 防自杀矫正；
 *  2. useTactics=false 时完全不调用 chooseMove，也不做 correctMove 二次覆盖，仅返回 MCTS 落点；
 *  3. useTactics=true 且 chooseMove 未命中时，仍保留 correctMove 的二次保险。
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'worker', 'ai.cjs'), 'utf8');

const counters = { choose: 0, correct: 0, search: 0 };
const flags = { chooseHit: false };
let api = null;

class StubMctsSearch {
    async search(game, simulations) {
        counters.search += 1;
        return { action: 5, simulations, winRate: 0.5, top: [] };
    }
}

class StubEvaluator {
    constructor() { this.session = {}; }
    async initialize() {}
    async evaluate() { return { value: 0 }; }
}

const stubSelf = {
    FAscendExports: {
        GameNormal: class {},
        GameBlight: class {},
        GameNight: class {},
        Board: class {},
        State: class {},
        RandAIC: class {},
        RandUnity: class {},
        RulesRuntime: {
            initialize() {},
            applyMove() { return { legal: true }; },
            fork() {},
            fromSnapshot() { return {}; },
            snapshot() { return {}; },
        },
        EndgameTactics: {
            create() {
                return {
                    chooseMove() {
                        counters.choose += 1;
                        return flags.chooseHit
                            ? { action: 7, engine: 'endgame-tactics', reason: 'kill' }
                            : null;
                    },
                    correctMove() {
                        counters.correct += 1;
                        return { action: 8, engine: 'endgame-tactics', reason: 'kill' };
                    },
                };
            },
        },
        AiHandicap: {
            create() { return { adjust() { return null; } }; },
            levelOf() { return 0; },
        },
        PLAYER_ENUM: { WHITE: 1, BLACK: 0 },
        STONE_ENUM: {},
        PLANT_ENUM: {},
    },
    FourZeroExports: {
        StateEncoder: class {},
        OnnxEvaluator: StubEvaluator,
        MctsSearch: StubMctsSearch,
    },
};

new Function('self', 'importScripts', 'Comlink', source)(
    stubSelf,
    () => {},
    { expose(value) { api = value; } },
);

assert(api && typeof api.ENDGAME_THINK === 'function', 'worker 未暴露 ENDGAME_THINK');
api.ENDGAME_LOAD({});

const resetCounters = () => {
    counters.choose = 0;
    counters.correct = 0;
    counters.search = 0;
};

// 1. 开启矫正且战术命中：直接返回战术落点，不进入 MCTS。
flags.chooseHit = true;
resetCounters();
api.ENDGAME_THINK(10, true).then((result) => {
    assert.strictEqual(result.action, 7, '开启矫正时应采用战术命中点');
    assert.strictEqual(result.corrected, true, '战术命中时应标记 corrected');
    assert.strictEqual(counters.choose, 1, '开启矫正时应调用 chooseMove');
    assert.strictEqual(counters.correct, 0, '战术命中时不应再走 MCTS / 二次保险');
    assert.strictEqual(counters.search, 0, '战术命中时不应调用 MCTS');

    // 2. 关闭矫正：不调用任何战术，直接返回 MCTS 落点。
    resetCounters();
    return api.ENDGAME_THINK(10, false);
}).then((result) => {
    assert.strictEqual(result.action, 5, '关闭矫正时应返回 MCTS 落点');
    assert.strictEqual(result.corrected, false, '关闭矫正时不应标记 corrected');
    assert.strictEqual(counters.choose, 0, '关闭矫正时不应调用 chooseMove');
    assert.strictEqual(counters.correct, 0, '关闭矫正时不应调用 correctMove');
    assert.strictEqual(counters.search, 1, '关闭矫正时应只走 MCTS');

    // 3. 开启矫正但战术未命中：MCTS 后仍做二次保险覆盖。
    flags.chooseHit = false;
    resetCounters();
    return api.ENDGAME_THINK(10, true);
}).then((result) => {
    assert.strictEqual(result.action, 8, '战术未命中时二次保险应覆盖 MCTS 落点');
    assert.strictEqual(result.overriddenMcts, true, '二次覆盖应标记 overriddenMcts');
    assert.strictEqual(counters.choose, 1, '开启矫正时应调用 chooseMove');
    assert.strictEqual(counters.correct, 1, '开启矫正且未命中时应调用 correctMove');
    assert.strictEqual(counters.search, 1, '战术未命中时应进入 MCTS');
    console.log('endgame-ai-tactics-toggle: 全部断言通过');
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
