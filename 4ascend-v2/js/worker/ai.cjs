/*
 * Browser AI worker.
 *
 * C++/WASM no longer owns a second rules implementation. The worker imports
 * the canonical JS rules bundle, forks it for MCTS, and calls an ONNX model
 * through ONNX Runtime Web.
 */
importScripts('/vendor/comlink/comlink.min.js');

// The historical bundle publishes on window. A Worker has the same global
// semantics once window is aliased to self; new builds use globalThis too.
self.window = self;
importScripts('/js/global/fascend.min.js');
importScripts('/vendor/onnxruntime-web/ort.wasm.min.js');
importScripts('/js/ai.min.js');


const {
    GameNormal,
    GameBlight,
    GameNight,
    Board,
    State,
    RandAIC,
    RandUnity,
    RulesRuntime,
    EndgameTactics,
    AiHandicap,
    PLAYER_ENUM,
    STONE_ENUM,
    PLANT_ENUM,
} = self.FAscendExports;
const { StateEncoder, OnnxEvaluator, MctsSearch } = self.FourZeroExports;
const endgameTactics = EndgameTactics.create({ RulesRuntime });
const aiHandicap = AiHandicap.create({ RulesRuntime });


/** 对手引擎 → ONNX 模型路径。 */
const MODEL_URLS = {
    'zero': '/model/4ascend-zero.onnx',
    'fish': '/model/4ascend-fish.onnx',
};

const engines = new Map();
let aiZero = null;
let lastSearch = null;
let endgameGame = null;
let lastEndgameSearch = null;
/** 当前对局难度选项（'1'简单 … '6'???）；仅影响取用，不影响选子。 */
let aiLevelOption = null;


const ensureInitialized = async (engine = 'zero') => {
    const key = MODEL_URLS[engine] ? engine : 'zero';
    let slot = engines.get(key);
    if (!slot) {
        slot = { 'evaluator': null, 'initialization': null };
        engines.set(key, slot);
    }
    if (slot.evaluator && slot.evaluator.session) return slot.evaluator;
    if (!slot.initialization) {
        slot.evaluator = slot.evaluator || new OnnxEvaluator(MODEL_URLS[key], self.FAscendExports);
        slot.initialization = slot.evaluator.initialize().catch((error) => {
            slot.initialization = null;
            throw error;
        });
    }
    await slot.initialization;
    return slot.evaluator;
};

const requireGame = () => {
    if (!aiZero) throw new Error('ZERO_RESET must be called before using the AI.');
    return aiZero;
};

const requireEndgameGame = () => {
    if (!endgameGame) throw new Error('ENDGAME_LOAD must be called before using the endgame solver.');
    return endgameGame;
};

const clampInteger = (value, fallback, minimum, maximum) => {
    const parsed = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
    return Math.max(minimum, Math.min(maximum, parsed));
};

const createGame = (seedAic, seedUnity, first, hp, plant, overload) => {
    const board = new Board(9, 9);
    const state = new State();
    state.turn_player = first === 1 ? PLAYER_ENUM.WHITE : PLAYER_ENUM.BLACK;
    state.hp = [hp, hp];
    const randAic = new RandAIC(seedAic >>> 0);
    const randUnity = new RandUnity(seedUnity >>> 0);
    let game;
    if (overload) game = new GameNight(board, state, randAic, randUnity);
    else if (plant) game = new GameNormal(board, state, randAic, randUnity);
    else game = new GameBlight(board, state, randAic, randUnity);
    RulesRuntime.initialize(game, state.turn_player);
    return game;
};

const setCell = (index, stone, plant) => {
    const game = requireGame();
    if (!Number.isInteger(index) || index < 0 || index >= 81) return false;
    const pos = game.board.data[index];
    pos.stone = stone === 1 ? STONE_ENUM.BLACK : stone === 2 ? STONE_ENUM.WHITE : STONE_ENUM.NONE;
    pos.plant = plant === 1 ? PLANT_ENUM.ONE : plant === 2 ? PLANT_ENUM.TWO : PLANT_ENUM.NONE;
    return true;
};

const hiddenRandomSearchGame = (game) => {
    if (!self.crypto || typeof self.crypto.getRandomValues !== 'function') {
        throw new Error('Secure randomness is required for hidden-seed MCTS.');
    }
    const entropy = self.crypto.getRandomValues(new Uint32Array(2));
    let seedAic = entropy[0] >>> 0;
    let seedUnity = entropy[1] >>> 0;
    // Enforce non-equality instead of relying on the already tiny collision
    // chance: ordinary levels must never receive the live match seeds.
    if (game.rand_aic && seedAic === game.rand_aic.seed) seedAic = (seedAic ^ 0x9e3779b9) >>> 0;
    if (game.rand_unity && seedUnity === game.rand_unity.seed) seedUnity = (seedUnity ^ 0x85ebca6b) >>> 0;

    const searchGame = RulesRuntime.fork(game);
    searchGame.rand_aic = new RandAIC(seedAic);
    searchGame.rand_unity = new RandUnity(seedUnity);
    return { searchGame, 'seeds': [seedAic, seedUnity] };
};


const resetMatchGame = (seedAic, seedUnity, first, hp, plant, overload = false, level = null) => {
    aiZero = createGame(seedAic, seedUnity, first, hp, plant, overload);
    aiLevelOption = level === null || level === undefined ? null : String(level);
    lastSearch = null;
    return true;
};

const applyMatchTurn = (action) => {
    const result = RulesRuntime.applyMove(requireGame(), Number(action));
    if (!result.legal) throw new Error(`Illegal move received by AI worker: ${action}`);
    return true;
};

/**
 * 在同一个对局状态下用指定引擎思考并落子。
 * @param {'zero'|'fish'} engine 对手引擎
 * @param {number} simulations 模拟次数
 * @param {boolean} synchronizeRandom 是否使用本局真实随机流（仅 ZERO 的 ??? 档）
 * @return {Promise<number>} 落子索引
 */
const thinkAndCommit = async (engine, simulations, synchronizeRandom = false) => {
    const evaluator = await ensureInitialized(engine);
    const game = requireGame();
    // synchronizeRandom=true 仅对应人机挑战 ???（opt=6）：MCTS 直接使用本局真实随机流。
    // 对局中不再叠加任何残局战术辅助（战术仅保留在残局挑战 / 残局思考链路）。
    const knownRandom = Boolean(synchronizeRandom);
    const hidden = knownRandom ? null : hiddenRandomSearchGame(game);
    const searchGame = knownRandom ? game : hidden.searchGame;
    const search = new MctsSearch(evaluator, RulesRuntime, {
        'cPuct': 2.0,
        'maximumMilliseconds': 45000,
    });
    lastSearch = await search.search(searchGame, simulations);
    lastSearch.randomMode = knownRandom ? 'known' : 'hidden';
    lastSearch.searchSeeds = hidden ? hidden.seeds : null;
    lastSearch.engine = engine;
    lastSearch.handicapOverride = false;

    let action = lastSearch.action;

    // 难度取用弱化：仅简单 / 普通生效，且只替换落点、不改变选子结果。
    const adjusted = aiHandicap.adjust(game, action, aiLevelOption);
    if (adjusted && adjusted.action !== action) {
        action = adjusted.action;
        lastSearch.action = action;
        lastSearch.handicapOverride = true;
        lastSearch.handicapLevel = adjusted.level;
        lastSearch.handicapReason = adjusted.reason;
        lastSearch.handicapOriginal = adjusted.original;
        lastSearch.handicapDetail = adjusted.detail || null;
    }

    const result = RulesRuntime.applyMove(game, action);
    if (!result.legal) throw new Error(`MCTS returned illegal action ${action}.`);
    return action;
};


/**
 * 回放评估：在落子前快照上运行 ONNX 推理 + MCTS，返回正着 / 本手 / 次优的 q 值。
 * @param {object} snapshot RulesRuntime 快照（实际落子之前的局面）
 * @param {number} simulations MCTS 模拟次数
 * @param {number|null} actualAction 实际落点（flat index）
 * @param {boolean} useTactics 是否叠加残局战术（斩杀 / 防自杀）矫正正着
 * @return {Promise<object>}
 */
const replayEvaluate = async (snapshot, simulations, actualAction, useTactics) => {
    const game = RulesRuntime.fromSnapshot(snapshot);
    const mover = game.state.turn_player;
    const fallback = useTactics ? 888 : 120;
    const requested = clampInteger(simulations, fallback, useTactics ? 64 : 16, 3000);

    // 正着优先采用残局战术矫正（斩杀 / 防自杀），无命中时回退 MCTS 首选。
    const tactical = useTactics ? endgameTactics.chooseMove(game) : null;
    const tacticalAction = tactical && Number.isInteger(tactical.action) ? tactical.action : null;

    const evaluator = await ensureInitialized('zero');
    const search = new MctsSearch(evaluator, RulesRuntime, {
        'cPuct': 2.0,
        'maximumMilliseconds': 45000,
    });
    const result = await search.search(game, requested);
    const top = Array.isArray(result.top) ? result.top : [];

    // 取某一落点对行棋方的价值；MCTS 未展开时用一次模型评估兜底。
    const valueOf = async (action) => {
        if (!Number.isInteger(action) || action < 0 || action >= 81) return null;
        const hit = top.find((edge) => edge.action === action);
        if (hit) return hit.q;

        const child = RulesRuntime.fork(game);
        const applied = RulesRuntime.applyMove(child, action);
        if (!applied.legal) return null;
        if (applied.winner) return applied.winner === mover ? 1 : -1;
        const prediction = await evaluator.evaluate(child);
        return Number.isFinite(prediction.value) ? -prediction.value : null;
    };

    const action = tacticalAction !== null ? tacticalAction : result.action;
    const rawActual = Number(actualAction);
    const actualIndex = Number.isInteger(rawActual) && rawActual >= 0 && rawActual < 81 ? rawActual : null;
    const bestQ = await valueOf(action);
    const actualQ = actualIndex === null ? null : await valueOf(actualIndex);
    const secondQ = top
        .filter((edge) => edge.action !== action && Number.isFinite(edge.q))
        .reduce((best, edge) => (best === null || edge.q > best ? edge.q : best), null);

    return {
        'action': action,
        'x': action % 9,
        'y': Math.floor(action / 9),
        'source': tacticalAction !== null ? (tactical.engine || 'endgame-tactics') : '4zero-mcts',
        'reason': tacticalAction !== null ? (tactical.reason || null) : null,
        'winRate': result.winRate,
        'mover': mover === PLAYER_ENUM.WHITE ? 1 : 0,
        'bestQ': bestQ,
        'actualQ': actualQ,
        'secondQ': secondQ,
        'simulations': result.simulations,
        'milliseconds': result.milliseconds || 0,
        'top': top.map((edge) => ({ 'action': edge.action, 'q': edge.q, 'visits': edge.visits })),
    };
};


Comlink.expose({
    async AI_INIT() {
        await ensureInitialized('zero');
        return {
            'backend': 'onnxruntime-web/wasm',
            'model': MODEL_URLS.zero,
            'rules': 'js/global/fascend',
        };
    },

    ZERO_RESET(seedAic, seedUnity, first, hp, plant, overload = false, level = null) {
        return resetMatchGame(seedAic, seedUnity, first, hp, plant, overload, level);
    },

    ZERO_TURN(action) {
        return applyMatchTurn(action);
    },

    ZERO_SET_CELL(index, stone, plant) {
        return setCell(Number(index), Number(stone), Number(plant));
    },

    ZERO_SET_TURN(player, turnCount = 0, blackHp = 6, whiteHp = 6) {
        const game = requireGame();
        game.state.turn_player = Number(player) === 1 ? PLAYER_ENUM.WHITE : PLAYER_ENUM.BLACK;
        game.state.turn_count = Math.max(0, Math.trunc(Number(turnCount) || 0));
        game.state.hp = [Number(blackHp), Number(whiteHp)];
        game.history_boards = [];
        return true;
    },

    async ZERO_THINK(simulations, synchronizeRandom = false) {
        return thinkAndCommit('zero', simulations, synchronizeRandom);
    },

    // 四子鱼（4zero 教师模型）复用同一套对局/搜索逻辑，只切换 ONNX 权重。
    FISH_RESET(seedAic, seedUnity, first, hp, plant, overload = false, level = null) {
        return resetMatchGame(seedAic, seedUnity, first, hp, plant, overload, level);
    },

    FISH_TURN(action) {
        return applyMatchTurn(action);
    },

    async FISH_THINK(simulations, synchronizeRandom = false) {
        return thinkAndCommit('fish', simulations, synchronizeRandom);
    },

    /** Load an exact, deterministic残局 position without replaying fake moves. */
    ENDGAME_LOAD(snapshot) {
        endgameGame = RulesRuntime.fromSnapshot(snapshot);
        // Endgame challenges keep authored plants but never refresh new ones.
        endgameGame.natural_plant = false;
        lastEndgameSearch = null;
        return RulesRuntime.snapshot(endgameGame);
    },

    // Explicit alias for callers that prefer RESET terminology.
    ENDGAME_RESET(snapshot) {
        endgameGame = RulesRuntime.fromSnapshot(snapshot);
        endgameGame.natural_plant = false;
        lastEndgameSearch = null;
        return RulesRuntime.snapshot(endgameGame);
    },

    /**
     * 残局思考：先走防自杀 / 斩杀遍历矫正；无命中时再回退 4zero MCTS。
     * 矫正逻辑不依赖落子历史，专门修复残局无 history 时的树算法失灵。
     */
    async ENDGAME_THINK(simulations = 888) {
        const game = requireEndgameGame();
        const requestedSimulations = clampInteger(simulations, 888, 1, 5000);

        // 底层战术：遍历全部合法点，强制斩杀 / 防自杀 / 堵点 / 构建 ASCEND。
        const tactical = endgameTactics.chooseMove(game);
        if (tactical && Number.isInteger(tactical.action)) {
            lastEndgameSearch = {
                'action': tactical.action,
                'engine': tactical.engine || 'endgame-tactics',
                'reason': tactical.reason,
                'detail': tactical.detail || null,
                'simulations': 0,
                'requestedSimulations': requestedSimulations,
                'randomMode': 'known',
                'searchSeeds': null,
                'corrected': true,
            };
            return lastEndgameSearch;
        }

        const evaluator = await ensureInitialized('zero');
        const search = new MctsSearch(evaluator, RulesRuntime, {
            'cPuct': 2.0,
            'maximumMilliseconds': 45000,
        });
        lastEndgameSearch = await search.search(game, requestedSimulations);
        lastEndgameSearch.engine = '4zero-mcts';
        lastEndgameSearch.requestedSimulations = requestedSimulations;
        lastEndgameSearch.randomMode = 'known';
        lastEndgameSearch.searchSeeds = null;
        lastEndgameSearch.corrected = false;

        // 若树算法落点与斩杀冲突，仍强制改为斩杀/防自杀点（二次保险）。
        const forced = endgameTactics.correctMove(game);
        if (forced && Number.isInteger(forced.action)
            && (forced.reason === 'kill'
                || forced.reason === 'anti-suicide-must-ascend'
                || forced.reason === 'anti-suicide-stronger-ascend'
                || forced.reason === 'anti-suicide-fallback')
            && forced.action !== lastEndgameSearch.action) {
            lastEndgameSearch.action = forced.action;
            lastEndgameSearch.engine = forced.engine || 'endgame-tactics';
            lastEndgameSearch.reason = forced.reason;
            lastEndgameSearch.detail = forced.detail || null;
            lastEndgameSearch.corrected = true;
            lastEndgameSearch.overriddenMcts = true;
        }
        return lastEndgameSearch;
    },

    /**
     * 剧情思考：纯 4zero MCTS（默认 150 次模拟），不叠加残局斩杀 / 防自杀矫正。
     * @param {number} simulations 模拟次数
     * @return {Promise<object>}
     */
    async STORY_THINK(simulations = 150) {
        const game = requireEndgameGame();
        const requestedSimulations = clampInteger(simulations, 150, 1, 5000);
        const evaluator = await ensureInitialized('zero');
        const search = new MctsSearch(evaluator, RulesRuntime, {
            'cPuct': 2.0,
            'maximumMilliseconds': 45000,
        });
        lastEndgameSearch = await search.search(game, requestedSimulations);
        lastEndgameSearch.engine = '4zero-mcts';
        lastEndgameSearch.requestedSimulations = requestedSimulations;
        lastEndgameSearch.randomMode = 'known';
        lastEndgameSearch.searchSeeds = null;
        lastEndgameSearch.corrected = false;
        return lastEndgameSearch;
    },

    /**
     * 回放复盘评估：套用残局 AI 链路（EndgameTactics + 4zero MCTS + ONNX），
     * 但使用独立棋局，不触碰残局挑战状态，并保留自然刷草。
     * @param {object} snapshot RulesRuntime 快照（实际落子之前的局面）
     * @param {number} simulations MCTS 模拟次数
     * @param {number|null} actualAction 实际落点（flat index），用于评估本手
     * @return {Promise<object>} 正着、胜率、正着/本手的 q 值
     */
    async REPLAY_EVAL(snapshot, simulations = 888, actualAction = null) {
        return replayEvaluate(snapshot, simulations, actualAction, true);
    },

    /**
     * 回放整场扫盘：纯 ZeroAI（不含残局战术），用于胜率折线与着手质量。
     * @param {object} snapshot RulesRuntime 快照（实际落子之前的局面）
     * @param {number} simulations MCTS 模拟次数
     * @param {number|null} actualAction 实际落点（flat index）
     * @return {Promise<object>}
     */
    async REPLAY_SWEEP(snapshot, simulations = 120, actualAction = null) {
        return replayEvaluate(snapshot, simulations, actualAction, false);
    },

    /** 调试：只跑战术遍历，不触发 ONNX / MCTS。 */
    ENDGAME_TACTICS_THINK() {
        const game = requireEndgameGame();
        const tactical = endgameTactics.chooseMove(game);
        lastEndgameSearch = tactical ? {
            'action': tactical.action,
            'engine': tactical.engine || 'endgame-tactics',
            'reason': tactical.reason,
            'detail': tactical.detail || null,
            'simulations': 0,
            'corrected': true,
        } : null;
        return lastEndgameSearch;
    },

    /** Commit either a player move, a book response, or a solver response. */
    ENDGAME_APPLY(action) {
        const game = requireEndgameGame();
        const result = RulesRuntime.applyMove(game, Number(action));
        const winner = result.winner === PLAYER_ENUM.BLACK ? 0 : result.winner === PLAYER_ENUM.WHITE ? 1 : null;
        return {
            'legal': result.legal,
            'action': result.action,
            winner,
            'snapshot': RulesRuntime.snapshot(game),
        };
    },

    ENDGAME_DEBUG_STATE() {
        return RulesRuntime.snapshot(requireEndgameGame());
    },

    ENDGAME_DEBUG_ENCODE() {
        return Array.from(new StateEncoder(self.FAscendExports).encode(requireEndgameGame()));
    },

    ENDGAME_DEBUG_SEARCH() {
        return lastEndgameSearch;
    },

    // Compatibility names remain so old configuration archives do not crash.
    // They use the new JS/ONNX engine rather than either legacy C++ module.
    HCE_RESET(first) {
        aiZero = createGame(1, 100, Number(first) ^ 1, 6, false, false);
        lastSearch = null;
        return true;
    },
    HCE_TURN(action) {
        const result = RulesRuntime.applyMove(requireGame(), Number(action));
        if (!result.legal) throw new Error(`Illegal move received by AI worker: ${action}`);
        return true;
    },
    async HCE_THINK(milliseconds) {
        const simulations = Math.max(16, Math.min(888, Math.trunc(Number(milliseconds) / 10) || 64));
        const evaluator = await ensureInitialized('zero');
        const search = new MctsSearch(evaluator, RulesRuntime, {
            'cPuct': 2.0,
            'maximumMilliseconds': Math.max(500, Math.trunc(Number(milliseconds) || 1000)),
        });
        const game = requireGame();
        const hidden = hiddenRandomSearchGame(game);
        lastSearch = await search.search(hidden.searchGame, simulations);
        lastSearch.randomMode = 'hidden';
        lastSearch.searchSeeds = hidden.seeds;
        RulesRuntime.applyMove(game, lastSearch.action);
        return lastSearch.action;
    },

    ZERO_DEBUG_STATE() {
        return RulesRuntime.snapshot(requireGame());
    },
    ZERO_DEBUG_ENCODE() {
        return Array.from(new StateEncoder(self.FAscendExports).encode(requireGame()));
    },
    ZERO_DEBUG_SEARCH() {
        return lastSearch;
    },
    /** 调试：当前生效的难度选项与取用弱化档位。 */
    ZERO_DEBUG_LEVEL() {
        return {
            'option': aiLevelOption,
            'level': AiHandicap.levelOf(aiLevelOption),
        };
    },
});
