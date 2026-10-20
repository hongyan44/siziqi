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


let evaluator = null;
let initialization = null;
let aiZero = null;
let lastSearch = null;
let endgameGame = null;
let lastEndgameSearch = null;
/** 当前对局难度选项（'1'简单 … '6'???）；仅影响取用，不影响选子。 */
let aiLevelOption = null;


const ensureInitialized = async () => {
    if (evaluator && evaluator.session) return;
    if (!initialization) {
        evaluator = evaluator || new OnnxEvaluator('/model/4ascend-zero.onnx', self.FAscendExports);
        initialization = evaluator.initialize().catch((error) => {
            initialization = null;
            throw error;
        });
    }
    await initialization;
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


Comlink.expose({
    async AI_INIT() {
        await ensureInitialized();
        return {
            'backend': 'onnxruntime-web/wasm',
            'model': '/model/4ascend-zero.onnx',
            'rules': 'js/global/fascend',
        };
    },

    ZERO_RESET(seedAic, seedUnity, first, hp, plant, overload = false, level = null) {
        aiZero = createGame(seedAic, seedUnity, first, hp, plant, overload);
        aiLevelOption = level === null || level === undefined ? null : String(level);
        lastSearch = null;
        return true;
    },

    ZERO_TURN(action) {
        const result = RulesRuntime.applyMove(requireGame(), Number(action));
        if (!result.legal) throw new Error(`Illegal move received by AI worker: ${action}`);
        return true;
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
        await ensureInitialized();
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

        await ensureInitialized();
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
        await ensureInitialized();
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
