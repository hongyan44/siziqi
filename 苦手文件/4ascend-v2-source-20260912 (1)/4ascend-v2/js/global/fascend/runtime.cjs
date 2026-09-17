/*
 * Headless facade for the canonical browser rules.
 *
 * The page may continue to call the individual ed_* phases while it animates
 * them. Search code calls applyMove(), which executes exactly those same
 * phases without knowing anything about Canvas, sound, or timing.
 */
const { Board } = require('./board.cjs');
const { State } = require('./state.cjs');
const { GameNormal } = require('./game_normal.cjs');
const { GameBlight } = require('./game_blight.cjs');
const { GameNight } = require('./game_night.cjs');
const { RandAIC, RandUnity } = require('./rand.cjs');
const { STONE_ENUM, PLANT_ENUM, PLAYER_ENUM, ASCEND_ENUM, OVER_ENUM } = require('./enum.cjs');


const cloneArray = (value) => value.map((item) => Array.isArray(item) ? cloneArray(item) : item);

const cloneRandom = (source) => {
    const copy = Object.create(Object.getPrototypeOf(source));
    Object.keys(source).forEach((key) => {
        const value = source[key];
        copy[key] = Array.isArray(value) ? cloneArray(value) : value;
    });
    return copy;
};

const cloneState = (source) => {
    const copy = new State();
    Object.keys(source).forEach((key) => {
        const value = source[key];
        copy[key] = Array.isArray(value) ? cloneArray(value) : value;
    });
    return copy;
};

const cloneBoard = (source) => {
    const copy = new Board(source.w, source.h);
    source.data.forEach((pos, index) => {
        copy.data[index].stone = pos.stone;
        copy.data[index].plant = pos.plant;
    });
    copy.turns = cloneArray(source.turns);
    return copy;
};

const snapshotPos = (pos) => ({
    'x': pos.x,
    'y': pos.y,
    'stone': pos.stone,
    'plant': pos.plant,
});

const solidStoneCode = (stone) => {
    if (stone === STONE_ENUM.BLACK) return 1;
    if (stone === STONE_ENUM.WHITE) return 2;
    return 0;
};

const snapshotStoneCode = (stone) => {
    if (stone === STONE_ENUM.BLACK) return 1;
    if (stone === STONE_ENUM.WHITE) return 2;
    if (stone === STONE_ENUM.BLACK_ASCEND) return 3;
    if (stone === STONE_ENUM.WHITE_ASCEND) return 4;
    if (stone === STONE_ENUM.BLACK_USED) return 5;
    if (stone === STONE_ENUM.WHITE_USED) return 6;
    return 0;
};

const stoneFromCode = (code) => {
    const stones = [
        STONE_ENUM.NONE,
        STONE_ENUM.BLACK,
        STONE_ENUM.WHITE,
        STONE_ENUM.BLACK_ASCEND,
        STONE_ENUM.WHITE_ASCEND,
        STONE_ENUM.BLACK_USED,
        STONE_ENUM.WHITE_USED,
    ];
    if (!Number.isInteger(code) || !stones[code]) throw new RangeError(`Unknown stone code: ${code}`);
    return stones[code];
};

const plantCode = (plant) => {
    if (plant === PLANT_ENUM.ONE) return 1;
    if (plant === PLANT_ENUM.TWO) return 2;
    return 0;
};

const plantFromCode = (code) => {
    if (code === 0) return PLANT_ENUM.NONE;
    if (code === 1) return PLANT_ENUM.ONE;
    if (code === 2) return PLANT_ENUM.TWO;
    throw new RangeError(`Unknown plant code: ${code}`);
};

const playerCode = (player) => player === PLAYER_ENUM.WHITE ? 1 : 0;
const playerFromCode = (code) => Number(code) === 1 ? PLAYER_ENUM.WHITE : PLAYER_ENUM.BLACK;

const ascendCode = (status) => {
    if (status === ASCEND_ENUM.START) return 1;
    if (status === ASCEND_ENUM.END) return 2;
    return 0;
};

const ascendFromCode = (code) => {
    if (code === 1) return ASCEND_ENUM.START;
    if (code === 2) return ASCEND_ENUM.END;
    return ASCEND_ENUM.NONE;
};

const overCode = (status) => {
    if (status === OVER_ENUM.ENABLE) return 1;
    if (status === OVER_ENUM.EXECUTE) return 2;
    return 0;
};

const overFromCode = (code) => {
    if (code === 1) return OVER_ENUM.ENABLE;
    if (code === 2) return OVER_ENUM.EXECUTE;
    return OVER_ENUM.NONE;
};

const gameMode = (game) => {
    if (game instanceof GameNight) return 'night';
    if (game instanceof GameBlight) return 'blight';
    return 'normal';
};

const finiteInteger = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

const restoreRandom = (RandomClass, value, fallbackSeed) => {
    const source = value && !Array.isArray(value) ? value : { 'states': value };
    const seed = finiteInteger(source && source.seed, fallbackSeed) >>> 0;
    const random = new RandomClass(seed);
    if (source && Array.isArray(source.states) && source.states.length === 4) {
        random.states = source.states.map((state) => finiteInteger(state) >>> 0);
    }
    return random;
};

const randomSnapshot = (random) => ({
    'seed': random && Number.isFinite(random.seed) ? random.seed >>> 0 : 0,
    'states': random && Array.isArray(random.states) ? random.states.map((state) => state >>> 0) : [],
});

const cloneHistory = (history, cells) => (history || []).slice(-7).map((entry, historyIndex) => {
    if (!entry || entry.length !== cells) throw new RangeError(`History board ${historyIndex} must contain ${cells} cells.`);
    return Uint8Array.from(entry, (stone) => {
        const code = finiteInteger(stone);
        if (code < 0 || code > 2) throw new RangeError(`History board ${historyIndex} contains an invalid stone code.`);
        return code;
    });
});


class RulesRuntime {
    /**
     * Attach simulation metadata to an ordinary page game.
     * @param {GameNormal | GameBlight | GameNight} game
     * @param {PLAYER_ENUM} firstPlayer
     * @return {GameNormal | GameBlight | GameNight}
     */
    static initialize(game, firstPlayer = game.state.turn_player) {
        game.first_player = firstPlayer;
        if (!Array.isArray(game.history_boards)) game.history_boards = [];
        return game;
    }

    /**
     * Deep-copy a game, including both deterministic RNG streams.
     * Search can mutate the result without advancing the live match.
     * @param {GameNormal | GameBlight | GameNight} source
     * @return {GameNormal | GameBlight | GameNight}
     */
    static fork(source) {
        const board = cloneBoard(source.board);
        const state = cloneState(source.state);
        const game = new source.constructor(
            board,
            state,
            cloneRandom(source.rand_aic),
            cloneRandom(source.rand_unity)
        );
        game.first_player = source.first_player || source.state.turn_player;
        game.history_boards = (source.history_boards || []).map((entry) => Uint8Array.from(entry));
        if ('natural_plant' in source) game.natural_plant = source.natural_plant;
        if ('always_overload' in source) game.always_overload = source.always_overload;
        return game;
    }

    /**
     * Current solid board used by the model history planes.
     * ASCEND/USED markers intentionally become empty, matching training.
     * @param {GameNormal | GameBlight | GameNight} game
     * @return {Uint8Array}
     */
    static solidBoard(game) {
        return Uint8Array.from(game.board.data, (pos) => solidStoneCode(pos.stone));
    }

    /**
     * Restore a complete, serializable position. Unlike the old endgame
     * SET_CELL bridge, this includes transient ASCEND state, model history,
     * mode flags, and both deterministic RNG streams.
     * @param {object} snapshot
     * @return {GameNormal | GameBlight | GameNight}
     */
    static fromSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') throw new TypeError('A rules snapshot object is required.');
        const width = finiteInteger(snapshot.width, 9);
        const height = finiteInteger(snapshot.height, 9);
        if (width <= 0 || height <= 0 || width * height > 4096) throw new RangeError('Invalid snapshot board dimensions.');
        const cells = width * height;
        if (!Array.isArray(snapshot.stones) || snapshot.stones.length !== cells) {
            throw new RangeError(`Snapshot stones must contain ${cells} cells.`);
        }
        if (!Array.isArray(snapshot.plants) || snapshot.plants.length !== cells) {
            throw new RangeError(`Snapshot plants must contain ${cells} cells.`);
        }

        const board = new Board(width, height);
        board.data.forEach((pos, index) => {
            pos.stone = stoneFromCode(finiteInteger(snapshot.stones[index]));
            pos.plant = plantFromCode(finiteInteger(snapshot.plants[index]));
        });
        board.turns = Array.isArray(snapshot.turns) ? snapshot.turns.map((turn, index) => {
            if (!Array.isArray(turn) || turn.length < 2) throw new RangeError(`Invalid turn coordinate at index ${index}.`);
            const x = finiteInteger(turn[0], -1);
            const y = finiteInteger(turn[1], -1);
            if (!board.in_bounds(x, y)) throw new RangeError(`Turn coordinate ${index} is outside the board.`);
            return [x, y];
        }) : [];

        const state = new State();
        state.turn_player = playerFromCode(snapshot.turnPlayer);
        state.turn_count = Math.max(0, finiteInteger(snapshot.turnCount));
        const turnPos = Array.isArray(snapshot.turnPos) ? snapshot.turnPos : [0, 0];
        state.turn_pos = [finiteInteger(turnPos[0]), finiteInteger(turnPos[1])];
        state.ascend_status = ascendFromCode(finiteInteger(snapshot.ascendStatus));
        const hp = Array.isArray(snapshot.hp) ? snapshot.hp : [6, 6];
        state.hp = [finiteInteger(hp[0], 6), finiteInteger(hp[1], 6)];
        state.unascend_charge = Math.max(0, finiteInteger(snapshot.unascendCharge, 25));
        const fastCharge = Array.isArray(snapshot.fastUnascendCharge) ? snapshot.fastUnascendCharge : [9, 9];
        state.unascend_chargef = [
            Math.max(0, finiteInteger(fastCharge[0], 9)),
            Math.max(0, finiteInteger(fastCharge[1], 9)),
        ];
        state.grow_count = Math.max(0, finiteInteger(snapshot.growCount, 11));
        state.just_unascend = Boolean(snapshot.justUnascend);
        state.over_status = overFromCode(finiteInteger(snapshot.overStatus));
        state.pending_damage = Array.isArray(snapshot.pendingDamage)
            ? [finiteInteger(snapshot.pendingDamage[0]), finiteInteger(snapshot.pendingDamage[1])]
            : null;

        const randAic = restoreRandom(RandAIC, snapshot.randAic, 1);
        const randUnity = restoreRandom(RandUnity, snapshot.randUnity, 100);
        const mode = snapshot.mode === 'blight' || snapshot.mode === 'night' ? snapshot.mode : 'normal';
        let game;
        if (mode === 'night') game = new GameNight(board, state, randAic, randUnity);
        else if (mode === 'blight') game = new GameBlight(board, state, randAic, randUnity);
        else game = new GameNormal(board, state, randAic, randUnity);
        game.natural_plant = snapshot.naturalPlant === undefined ? mode === 'normal' : Boolean(snapshot.naturalPlant);
        if ('alwaysOverload' in snapshot) game.always_overload = Boolean(snapshot.alwaysOverload);
        game.first_player = playerFromCode(snapshot.firstPlayer);
        game.history_boards = cloneHistory(snapshot.history, cells);
        return RulesRuntime.initialize(game, game.first_player);
    }

    static loadSnapshot(snapshot) {
        return RulesRuntime.fromSnapshot(snapshot);
    }

    /**
     * Return legal flat indices using the canonical rule validator.
     * @param {GameNormal | GameBlight | GameNight} game
     * @return {number[]}
     */
    static legalMoves(game) {
        const stone = game.state.turn_player === PLAYER_ENUM.BLACK ? STONE_ENUM.BLACK : STONE_ENUM.WHITE;
        const result = [];
        game.board.data.forEach((pos, index) => {
            if (game.valid(pos.x, pos.y, stone)) result.push(index);
        });
        return result;
    }

    /**
     * Execute one complete move through the same phases used by the page.
     * Events are plain snapshots, so later rule mutations cannot change them.
     * @param {GameNormal | GameBlight | GameNight} game
     * @param {number} action flat 9x9 index
     * @param {{collectEvents?: boolean}} options
     * @return {{legal: boolean, action: number, winner: PLAYER_ENUM | void, events: object[]}}
     */
    static applyMove(game, action, options = {}) {
        RulesRuntime.initialize(game, game.first_player || game.state.turn_player);
        const collectEvents = Boolean(options.collectEvents);
        const x = action % game.board.w;
        const y = Math.floor(action / game.board.w);
        const events = [];

        if (!Number.isInteger(action) || action < 0 || action >= game.board.w * game.board.h) {
            return { 'legal': false, action, 'winner': undefined, events };
        }

        const history = game.history_boards;
        history.push(RulesRuntime.solidBoard(game));
        while (history.length > 7) history.shift();

        const player = game.state.turn_player;
        if (!game.ed_tr_1(x, y)) {
            history.pop();
            return { 'legal': false, action, 'winner': undefined, events };
        }
        if (collectEvents) events.push({ 'type': 'place', action, x, y, player });

        const ascend = game.ed_as_1();
        if (collectEvents && ascend) {
            events.push({ 'type': 'ascend', 'status': game.state.ascend_status, 'points': ascend.map(snapshotPos) });
        }

        const hpBefore = [...game.state.hp];
        const combat = game.ed_as_2(false);
        if (collectEvents && combat !== undefined) {
            events.push({ 'type': 'combat', 'rounds': combat, 'hpBefore': hpBefore, 'hpAfter': [...game.state.hp] });
        }

        game.ed_tr_2();
        const winner = game.ed_win();
        if (winner) {
            if (collectEvents) events.push({ 'type': 'gameOver', winner });
            return { 'legal': true, action, winner, events };
        }

        const plants = game.ed_pl_1();
        if (collectEvents && plants) {
            events.push({ 'type': 'plants', 'points': plants.map(snapshotPos) });
        }
        game.ed_as_3();

        return { 'legal': true, action, 'winner': undefined, events };
    }

    static winner(game) {
        return game.ed_win();
    }

    static isTerminal(game) {
        return Boolean(RulesRuntime.winner(game)) || RulesRuntime.legalMoves(game).length === 0;
    }

    /** Compact deterministic key for endgame transposition and model caches. */
    static stateKey(game) {
        const snapshot = RulesRuntime.snapshot(game);
        const encode = (values) => values.join('');
        const history = snapshot.history.map(encode).join('/');
        return [
            snapshot.mode,
            encode(snapshot.stones),
            encode(snapshot.plants),
            snapshot.turnPlayer,
            snapshot.firstPlayer,
            snapshot.turnCount,
            snapshot.turnPos.join(','),
            snapshot.ascendStatus,
            snapshot.hp.join(','),
            snapshot.pendingDamage ? snapshot.pendingDamage.join(',') : '-',
            snapshot.unascendCharge,
            snapshot.fastUnascendCharge.join(','),
            snapshot.growCount,
            Number(snapshot.justUnascend),
            snapshot.overStatus,
            Number(snapshot.naturalPlant),
            Number(snapshot.alwaysOverload),
            snapshot.randAic.states.join(','),
            snapshot.randUnity.states.join(','),
            history,
        ].join('|');
    }

    /** Serializable diagnostics used by tests and the endgame adapter. */
    static snapshot(game) {
        return {
            'version': 2,
            'mode': gameMode(game),
            'width': game.board.w,
            'height': game.board.h,
            'stones': game.board.data.map((pos) => snapshotStoneCode(pos.stone)),
            'plants': game.board.data.map((pos) => plantCode(pos.plant)),
            'turns': cloneArray(game.board.turns),
            'turnPlayer': playerCode(game.state.turn_player),
            'firstPlayer': playerCode(game.first_player || game.state.turn_player),
            'turnCount': game.state.turn_count,
            'turnPos': [...game.state.turn_pos],
            'ascendStatus': ascendCode(game.state.ascend_status),
            'hp': [...game.state.hp],
            'pendingDamage': Array.isArray(game.state.pending_damage) ? [...game.state.pending_damage] : null,
            'unascendCharge': game.state.unascend_charge,
            'fastUnascendCharge': [...game.state.unascend_chargef],
            'growCount': game.state.grow_count,
            'justUnascend': game.state.just_unascend,
            'overStatus': overCode(game.state.over_status),
            'history': (game.history_boards || []).map((entry) => Array.from(entry)),
            'randAic': randomSnapshot(game.rand_aic),
            'randUnity': randomSnapshot(game.rand_unity),
            'naturalPlant': 'natural_plant' in game ? Boolean(game.natural_plant) : false,
            'alwaysOverload': 'always_overload' in game ? Boolean(game.always_overload) : false,
        };
    }
}


export { RulesRuntime };
