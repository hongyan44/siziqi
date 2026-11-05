/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 残局正着分支规则与二进制关卡存档
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const { BaseZalgo } = require('./utils/basezalgo.cjs');
const { RandAIC, RandUnity } = require('./fascend/rand.cjs');


const BOARD_SIZE = 9;
const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
// 当前写入版本；AI 预设自 V5 起追加，引导落子点自 V4 起追加，刷草计划自 V3 起追加。
const ARCHIVE_VERSION = 5;
const AI_PRESET_ARCHIVE_VERSION = 5;
const GUIDE_ARCHIVE_VERSION = 4;
const PLANT_ARCHIVE_VERSION = 3;
const SNAPSHOT_ARCHIVE_VERSION = 2;
const LEGACY_ARCHIVE_VERSION = 1;
const SUPPORTED_ARCHIVE_VERSIONS = [AI_PRESET_ARCHIVE_VERSION, GUIDE_ARCHIVE_VERSION, PLANT_ARCHIVE_VERSION, SNAPSHOT_ARCHIVE_VERSION, LEGACY_ARCHIVE_VERSION];
const MAGIC = [0x45, 0x47, 0x4B]; // EGK: EndGame Keyframe
const FALLBACK_AI = '4ascend-zero';


class BitWriter {
    constructor() {
        this.bytes = [];
        this.offset = 0;
    }

    write(value, length) {
        const number = Number(value);
        if (!Number.isInteger(number) || number < 0 || number >= 2 ** length) {
            throw new RangeError(`无法将 ${value} 写入 ${length} 位`);
        }
        for (let bit = length - 1; bit >= 0; bit--) {
            const byteIndex = Math.floor(this.offset / 8);
            const bitIndex = 7 - (this.offset % 8);
            if (this.bytes[byteIndex] === undefined) this.bytes[byteIndex] = 0;
            if ((number >> bit) & 1) this.bytes[byteIndex] |= 1 << bitIndex;
            this.offset++;
        }
    }

    align() {
        while (this.offset % 8) this.write(0, 1);
    }

    toUint8Array() {
        return Uint8Array.from(this.bytes);
    }
}


class BitReader {
    constructor(data) {
        this.data = data;
        this.offset = 0;
    }

    read(length) {
        if (length < 0 || this.offset + length > this.data.length * 8) throw new Error('残局数据长度不足');
        let value = 0;
        for (let i = 0; i < length; i++) {
            const byteIndex = Math.floor(this.offset / 8);
            const bitIndex = 7 - (this.offset % 8);
            value = value * 2 + ((this.data[byteIndex] >> bitIndex) & 1);
            this.offset++;
        }
        return value;
    }

    align() {
        this.offset += (8 - (this.offset % 8)) % 8;
    }
}


const crc16 = (data) => {
    let crc = 0xFFFF;
    for (const byte of data) {
        crc ^= byte << 8;
        for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc;
};

const normalize_move = (move) => {
    if (!Array.isArray(move) || move.length < 2) return null;
    const x = Number(move[0]);
    const y = Number(move[1]);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return null;
    return [x, y];
};

const normalize_moves = (moves, name) => {
    if (!Array.isArray(moves)) throw new TypeError(`${name} 必须是数组`);
    if (moves.length > 255) throw new RangeError(`${name} 不能超过 255 手`);
    return moves.map(normalize_move).map((move, index) => {
        if (!move) throw new RangeError(`${name}[${index}] 不是合法坐标`);
        return move;
    });
};

const MAX_PLANT_SCHEDULE = 255;

/**
 * @description 归一化作者定义的定时刷草计划。
 * 每条计划为 { turn, cells }：turn 为触发回合（1 表示玩家第一次落子后），
 * cells 为编辑器坐标（左下原点）的刷草点数组。
 * @param {*} schedule
 * @return {{turn: number, cells: [number, number][]}[]}
 */
const normalize_plant_schedule = (schedule) => {
    if (schedule === undefined || schedule === null) return [];
    if (!Array.isArray(schedule)) throw new TypeError('刷草计划必须是数组');
    if (schedule.length > MAX_PLANT_SCHEDULE) throw new RangeError(`刷草计划不能超过 ${MAX_PLANT_SCHEDULE} 条`);
    return schedule.map((entry, index) => {
        if (!entry || typeof entry !== 'object') throw new TypeError(`刷草计划[${index}] 无效`);
        const turn = bounded_integer(entry.turn, 0, 65535, 1, `刷草计划[${index}] 回合`);
        if (!Array.isArray(entry.cells)) throw new TypeError(`刷草计划[${index}] 的刷草点必须是数组`);
        if (entry.cells.length > BOARD_CELLS) throw new RangeError(`刷草计划[${index}] 的刷草点不能超过 ${BOARD_CELLS} 个`);
        return {
            turn,
            cells: entry.cells.map((cell, cellIndex) => {
                const move = normalize_move(cell);
                if (!move) throw new RangeError(`刷草计划[${index}] 的刷草点 ${cellIndex} 不是合法坐标`);
                return move;
            }),
        };
    });
};

const STONE_NAMES = ['none', 'black', 'white', 'black-ascend', 'white-ascend', 'black-used', 'white-used'];
const stone_code = (stone) => {
    if (Number.isInteger(stone) && stone >= 0 && stone < STONE_NAMES.length) return stone;
    const code = STONE_NAMES.indexOf(stone);
    return code < 0 ? 0 : code;
};
const code_stone = (code) => STONE_NAMES[code] || 'none';

const bounded_integer = (value, minimum, maximum, fallback, name) => {
    const parsed = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
    if (parsed < minimum || parsed > maximum) throw new RangeError(`${name} 必须是 ${minimum} 到 ${maximum} 的整数`);
    return parsed;
};

const mode_code = (mode) => mode === 'blight' ? 1 : mode === 'night' ? 2 : 0;
const code_mode = (code) => code === 1 ? 'blight' : code === 2 ? 'night' : 'normal';

const normalize_rng = (input, RandomClass, fallbackSeed) => {
    const source = input && !Array.isArray(input) ? input : { 'states': input };
    const seed = bounded_integer(source && source.seed, 0, 0xFFFFFFFF, fallbackSeed >>> 0, '随机种子') >>> 0;
    const fallback = new RandomClass(seed);
    const states = source && Array.isArray(source.states) && source.states.length === 4
        ? source.states.map((value) => bounded_integer(value, 0, 0xFFFFFFFF, 0, '随机状态') >>> 0)
        : [...fallback.states];
    return { seed, states };
};

const normalize_cells = (data, snapshot) => {
    if (Array.isArray(snapshot.stones) && snapshot.stones.length === BOARD_CELLS
        && Array.isArray(snapshot.plants) && snapshot.plants.length === BOARD_CELLS) {
        return snapshot.stones.map((stone, index) => ({ 'stone': stone_code(stone), 'plant': Number(snapshot.plants[index]) || 0 }));
    }
    if (Array.isArray(data.cells) && data.cells.length === BOARD_CELLS) {
        return data.cells.map((cell) => ({ 'stone': stone_code(cell && cell.stone), 'plant': Number(cell && cell.plant) || 0 }));
    }
    throw new TypeError('残局盘面必须是 81 格 cells 或完整 snapshot');
};

const normalize_history = (history) => (history || []).slice(-7).map((entry, index) => {
    if (!entry || entry.length !== BOARD_CELLS) throw new RangeError(`历史盘面 ${index} 必须是 81 格`);
    return Array.from(entry, (stone) => bounded_integer(stone, 0, 2, 0, '历史棋子'));
});

const normalize_turns = (turns) => (turns || []).slice(-255).map((move, index) => {
    const normalized = normalize_move(move);
    if (!normalized) throw new RangeError(`落子历史 ${index} 不是合法坐标`);
    return normalized;
});


class EndgameArchive {
    /**
     * V5 stores a complete turn-boundary snapshot: transient stone/state
     * codes, both RNG streams, model history, move history, the authored
     * solution line, the author-defined scheduled-plant plan, the
     * author-defined ordered guide-move markers, and the author-defined
     * AI-preset move sequence.
     * V1~V4 decoding remains supported for published puzzles.
     */
    static save(data) {
        if (!data || typeof data !== 'object') throw new TypeError('残局数据无效');
        const snapshot = data.snapshot || {};
        const cells = normalize_cells(data, snapshot);
        const blackBook = normalize_moves(data.blackBook || data.black_book || [], '黑方正着');
        const whiteTurns = normalize_moves(data.whiteTurns || data.white_turns || [], '白方预案');
        if (blackBook.length !== whiteTurns.length) throw new RangeError('黑方正着与白方预案手数必须一致');
        const plantSchedule = normalize_plant_schedule(data.plantSchedule || data.plant_schedule);
        const guideMoves = normalize_moves(data.guideMoves || data.guide_moves || [], '引导落子点');
        // V5：作者定义的白方 AI 预设落子顺序；只要存在，白方 AI 就无条件按它落子。
        const aiPreset = normalize_moves(data.aiPreset || data.ai_preset || [], 'AI预设');

        const hp = data.hp || {};
        const snapshotHp = Array.isArray(snapshot.hp) ? snapshot.hp : [];
        const blackHp = bounded_integer(hp.black ?? snapshotHp[0], 0, 127, 6, '黑方 HP');
        const whiteHp = bounded_integer(hp.white ?? snapshotHp[1], 0, 127, 6, '白方 HP');
        const gameMode = snapshot.mode || data.game_mode || code_mode(Number(data.mode_code) || 0);
        const firstPlayer = snapshot.firstPlayer === undefined
            ? (data.first === 'white' ? 1 : 0)
            : (snapshot.firstPlayer === 1 ? 1 : 0);
        // 编辑器数据不带 snapshot 时，开局行棋方必须与先手方一致：
        // AI 先手（白方先手）会让白方从第 0 手开始，黑方随后仍是第 1 手。
        // 已保存的快照（含中途局面）仍以 snapshot.turnPlayer 为准。
        const turnPlayer = snapshot.turnPlayer === undefined
            ? firstPlayer
            : (snapshot.turnPlayer === 1 ? 1 : 0);
        const naturalPlant = snapshot.naturalPlant === undefined ? Boolean(data.natural_plant) : Boolean(snapshot.naturalPlant);

        const flags = (data.player === 'white' ? 1 : 0)
            | (firstPlayer ? 2 : 0)
            | (naturalPlant ? 4 : 0)
            | (mode_code(gameMode) & 3) << 3
            | (turnPlayer ? 32 : 0);
        const fallbackLevel = bounded_integer(data.fallback?.level, 0, 255, 2, '普通 AI 难度');
        const turnCount = bounded_integer(snapshot.turnCount, 0, 65535, 0, '回合数');
        const turnPos = Array.isArray(snapshot.turnPos) ? snapshot.turnPos : [0, 0];
        const turnX = bounded_integer(turnPos[0], 0, 8, 0, '最后落子 X');
        const turnY = bounded_integer(turnPos[1], 0, 8, 0, '最后落子 Y');
        const ascendStatus = bounded_integer(snapshot.ascendStatus, 0, 2, 0, 'ASCEND 状态');
        const overStatus = bounded_integer(snapshot.overStatus, 0, 2, 0, '超载状态');
        const unascendCharge = bounded_integer(snapshot.unascendCharge, 0, 255, 25, '反升变蓄力');
        const fastCharge = Array.isArray(snapshot.fastUnascendCharge) ? snapshot.fastUnascendCharge : [9, 9];
        const fastBlack = bounded_integer(fastCharge[0], 0, 255, 9, '黑方快速蓄力');
        const fastWhite = bounded_integer(fastCharge[1], 0, 255, 9, '白方快速蓄力');
        const growCount = bounded_integer(snapshot.growCount, 0, 255, 11, '植物生成倒计时');
        const pendingDamage = Array.isArray(snapshot.pendingDamage) ? snapshot.pendingDamage : null;
        const pendingBlack = bounded_integer(pendingDamage && pendingDamage[0], 0, 255, 0, '黑方待结算伤害');
        const pendingWhite = bounded_integer(pendingDamage && pendingDamage[1], 0, 255, 0, '白方待结算伤害');
        const randAic = normalize_rng(snapshot.randAic || data.randAic, RandAIC, 0x4A534B31);
        const randUnity = normalize_rng(snapshot.randUnity || data.randUnity, RandUnity, 0x4A534B32);
        const history = normalize_history(snapshot.history);
        const turns = normalize_turns(snapshot.turns);

        const writer = new BitWriter();
        MAGIC.forEach((byte) => writer.write(byte, 8));
        writer.write(ARCHIVE_VERSION, 8);
        writer.write(flags, 8);
        writer.write(fallbackLevel, 8);
        writer.write(blackHp, 7);
        writer.write(whiteHp, 7);
        writer.write(turnCount, 16);
        writer.write(turnX, 4); writer.write(turnY, 4);
        writer.write(ascendStatus, 2); writer.write(overStatus, 2);
        writer.write(snapshot.justUnascend ? 1 : 0, 1);
        writer.write(pendingDamage ? 1 : 0, 1);
        writer.write(snapshot.alwaysOverload ? 1 : 0, 1);
        writer.write(0, 1);
        writer.write(unascendCharge, 8);
        writer.write(fastBlack, 8); writer.write(fastWhite, 8);
        writer.write(growCount, 8);
        writer.write(pendingBlack, 8); writer.write(pendingWhite, 8);
        [randAic, randUnity].forEach((random) => {
            writer.write(random.seed, 32);
            random.states.forEach((state) => writer.write(state, 32));
        });

        cells.forEach((item, index) => {
            const stone = bounded_integer(item.stone, 0, 6, 0, `盘面第 ${index + 1} 格棋子`);
            const plant = bounded_integer(item.plant, 0, 2, 0, `盘面第 ${index + 1} 格草数`);
            writer.write(stone, 3);
            writer.write(plant, 2);
        });

        writer.write(history.length, 3);
        history.forEach((board) => board.forEach((stone) => writer.write(stone, 2)));
        writer.write(turns.length, 8);
        turns.forEach((move) => { writer.write(move[0], 4); writer.write(move[1], 4); });

        writer.write(blackBook.length, 8);
        blackBook.forEach((blackMove, index) => {
            const whiteMove = whiteTurns[index];
            writer.write(blackMove[0], 4); writer.write(blackMove[1], 4);
            writer.write(whiteMove[0], 4); writer.write(whiteMove[1], 4);
        });

        // V3 追加作者定义的定时刷草计划（V1/V2 无此段，读取时按版本区分）。
        writer.write(plantSchedule.length, 8);
        plantSchedule.forEach((entry) => {
            writer.write(entry.turn, 16);
            writer.write(entry.cells.length, 8);
            entry.cells.forEach((cell) => { writer.write(cell[0], 4); writer.write(cell[1], 4); });
        });

        // V4 追加作者定义的引导落子点顺序（V1/V2/V3 无此段，读取时按版本区分）。
        writer.write(guideMoves.length, 8);
        guideMoves.forEach((move) => { writer.write(move[0], 4); writer.write(move[1], 4); });

        // V5 追加作者定义的 AI 预设落子顺序（V1~V4 无此段，读取时按版本区分）。
        writer.write(aiPreset.length, 8);
        aiPreset.forEach((move) => { writer.write(move[0], 4); writer.write(move[1], 4); });

        writer.align();
        const body = writer.toUint8Array();
        const result = new Uint8Array(body.length + 2);
        result.set(body);
        const checksum = crc16(body);
        result[body.length] = checksum >> 8;
        result[body.length + 1] = checksum & 0xFF;
        return result;
    }

    static load(input) {
        const data = input instanceof Uint8Array ? input : new Uint8Array(input || []);
        if (data.length < 46) throw new Error('残局二进制数据过短');
        const reader = new BitReader(data);
        const magic = [reader.read(8), reader.read(8), reader.read(8)];
        if (magic.some((byte, index) => byte !== MAGIC[index])) throw new Error('不是有效的残局关卡数据');
        const version = reader.read(8);
        if (!SUPPORTED_ARCHIVE_VERSIONS.includes(version)) {
            throw new Error(`不支持的残局关卡版本: ${version}`);
        }
        const flags = reader.read(8);
        const fallbackLevel = reader.read(8);
        const blackHp = reader.read(7);
        const whiteHp = reader.read(7);
        const gameMode = code_mode((flags >> 3) & 3);
        let snapshot;
        let cells;
        if (version === LEGACY_ARCHIVE_VERSION) {
            cells = Array.from({ length: BOARD_CELLS }, () => {
                const stone = reader.read(2);
                const plant = reader.read(2);
                if (stone > 2) throw new Error('残局盘面包含未知棋子类型');
                return { stone: code_stone(stone), plant };
            });
            const randAic = normalize_rng(null, RandAIC, 0x4A534B31);
            const randUnity = normalize_rng(null, RandUnity, 0x4A534B32);
            snapshot = {
                'version': 2, 'mode': gameMode, 'width': 9, 'height': 9,
                'stones': cells.map((cell) => stone_code(cell.stone)),
                'plants': cells.map((cell) => cell.plant),
                'turns': [], 'turnPlayer': 0, 'firstPlayer': (flags & 2) ? 1 : 0,
                'turnCount': 0, 'turnPos': [0, 0], 'ascendStatus': 0,
                'hp': [blackHp, whiteHp], 'pendingDamage': null,
                'unascendCharge': 25, 'fastUnascendCharge': [9, 9],
                'growCount': 11, 'justUnascend': false, 'overStatus': 0,
                'history': [], randAic, randUnity,
                'naturalPlant': Boolean(flags & 4), 'alwaysOverload': gameMode === 'night',
            };
        } else {
            const turnCount = reader.read(16);
            const turnPos = [reader.read(4), reader.read(4)];
            const ascendStatus = reader.read(2);
            const overStatus = reader.read(2);
            const justUnascend = Boolean(reader.read(1));
            const hasPendingDamage = Boolean(reader.read(1));
            const alwaysOverload = Boolean(reader.read(1));
            reader.read(1);
            const unascendCharge = reader.read(8);
            const fastUnascendCharge = [reader.read(8), reader.read(8)];
            const growCount = reader.read(8);
            const pending = [reader.read(8), reader.read(8)];
            const readRandom = () => ({
                'seed': reader.read(32) >>> 0,
                'states': [reader.read(32) >>> 0, reader.read(32) >>> 0, reader.read(32) >>> 0, reader.read(32) >>> 0],
            });
            const randAic = readRandom();
            const randUnity = readRandom();
            cells = Array.from({ length: BOARD_CELLS }, () => {
                const stone = reader.read(3);
                const plant = reader.read(2);
                if (stone > 6 || plant > 2) throw new Error('残局盘面包含未知棋子或植物类型');
                return { stone: code_stone(stone), plant };
            });
            const historyCount = reader.read(3);
            const history = Array.from({ length: historyCount }, () =>
                Array.from({ length: BOARD_CELLS }, () => reader.read(2))
            );
            if (history.some((board) => board.some((stone) => stone > 2))) throw new Error('残局历史盘面包含未知棋子类型');
            const turnLength = reader.read(8);
            const turns = Array.from({ length: turnLength }, () => [reader.read(4), reader.read(4)]);
            snapshot = {
                'version': 2, 'mode': gameMode, 'width': 9, 'height': 9,
                'stones': cells.map((cell) => stone_code(cell.stone)),
                'plants': cells.map((cell) => cell.plant),
                turns, 'turnPlayer': (flags & 32) ? 1 : 0,
                'firstPlayer': (flags & 2) ? 1 : 0, turnCount, turnPos, ascendStatus,
                'hp': [blackHp, whiteHp], 'pendingDamage': hasPendingDamage ? pending : null,
                unascendCharge, fastUnascendCharge, growCount, justUnascend, overStatus,
                history, randAic, randUnity,
                'naturalPlant': Boolean(flags & 4), alwaysOverload,
            };
        }
        const pairCount = reader.read(8);
        const blackBook = [];
        const whiteTurns = [];
        for (let i = 0; i < pairCount; i++) {
            blackBook.push([reader.read(4), reader.read(4)]);
            whiteTurns.push([reader.read(4), reader.read(4)]);
        }
        // V3 起追加定时刷草计划；V1/V2 没有该段，保持向后兼容。
        const plantSchedule = [];
        if (version >= PLANT_ARCHIVE_VERSION) {
            const scheduleCount = reader.read(8);
            for (let i = 0; i < scheduleCount; i++) {
                const turn = reader.read(16);
                const cellCount = reader.read(8);
                const scheduleCells = [];
                for (let j = 0; j < cellCount; j++) scheduleCells.push([reader.read(4), reader.read(4)]);
                plantSchedule.push({ turn, cells: scheduleCells });
            }
        }
        // V4 起追加引导落子点顺序；V1/V2/V3 没有该段，保持向后兼容。
        const guideMoves = [];
        if (version >= GUIDE_ARCHIVE_VERSION) {
            const guideCount = reader.read(8);
            for (let i = 0; i < guideCount; i++) guideMoves.push([reader.read(4), reader.read(4)]);
        }
        // V5 起追加 AI 预设落子顺序；V1~V4 没有该段，保持向后兼容。
        const aiPreset = [];
        if (version >= AI_PRESET_ARCHIVE_VERSION) {
            const aiCount = reader.read(8);
            for (let i = 0; i < aiCount; i++) aiPreset.push([reader.read(4), reader.read(4)]);
        }
        reader.align();
        const checksumOffset = reader.offset / 8;
        if (checksumOffset + 2 !== data.length) throw new Error('残局数据存在截断或多余字节');
        const actualChecksum = (data[checksumOffset] << 8) | data[checksumOffset + 1];
        const expectedChecksum = crc16(data.subarray(0, checksumOffset));
        if (actualChecksum !== expectedChecksum) throw new Error('残局数据校验失败');

        return {
            format: `endgame-binary-v${version}`,
            version,
            mode: 'endgame',
            game_mode: gameMode,
            player: (flags & 1) ? 'white' : 'black',
            first: (flags & 2) ? 'white' : 'black',
            natural_plant: Boolean(flags & 4),
            hp: { black: blackHp, white: whiteHp },
            cells,
            black_book: blackBook,
            white_turns: whiteTurns,
            plant_schedule: plantSchedule,
            guide_moves: guideMoves,
            ai_preset: aiPreset,
            snapshot,
            fallback: { mode: 'normal', ai: FALLBACK_AI, level: fallbackLevel, trigger: 'black-deviation' },
        };
    }

    static encode(data) {
        return BaseZalgo.encode(this.save(data));
    }

    static decode(text) {
        if (typeof text !== 'string' || text.length === 0) throw new TypeError('残局编码必须是非空字符串');
        return this.load(BaseZalgo.decode(text));
    }
}


/**
 * @description 将坐标转成可比较的键
 * @param {[number, number]} move
 * @return {string}
 */
const move_key = (move) => `${move[0]},${move[1]}`;

/**
 * @description 创建残局正着分支控制器。
 * 黑方走中 black_book[i] 时，白方才使用 white_turns[i]；首次偏离后永久切换普通模式 AI。
 */
const create_branch = (black_book, white_turns, fallback_ai) => {
    const book = (black_book || []).map(normalize_move).filter(Boolean);
    const white = (white_turns || []).map(normalize_move).filter(Boolean);
    if (typeof fallback_ai !== 'function') throw new TypeError('残局分支需要普通模式 AI 回调');

    let index = 0;
    let mode = 'book';
    let deviation = null;
    const reset = () => { index = 0; mode = 'book'; deviation = null; };
    const snapshot = () => ({ mode, index, next_black: book[index] || null, next_white: white[index] || null, deviation });
    const fallback = async (black_move, context, reason) => {
        mode = 'normal-ai';
        deviation = deviation || { index, expected: book[index] || null, actual: black_move };
        const ai_move = normalize_move(await fallback_ai({ ...context, black_move, reason, book_index: index }));
        if (!ai_move) throw new Error('普通模式 AI 未返回合法坐标');
        return { mode, matched: false, reason, black_move, white_move: ai_move, source: 'normal-ai', state: snapshot() };
    };
    const black_move = async (move, context = {}) => {
        const actual = normalize_move(move);
        if (!actual) throw new TypeError('黑方落子坐标无效');
        if (mode === 'normal-ai') return fallback(actual, context, 'already-deviated');
        const expected = book[index];
        if (!expected) return fallback(actual, context, 'book-finished');
        if (move_key(actual) !== move_key(expected)) return fallback(actual, context, 'black-deviation');
        const white_move = white[index];
        if (!white_move) return fallback(actual, context, 'white-plan-missing');
        index++;
        return { mode: 'book', matched: true, reason: 'black-book-match', black_move: actual, white_move, source: 'book', state: snapshot() };
    };
    return { black_move, reset, snapshot };
};

const create_normal_ai_adapter = (think) => {
    if (typeof think !== 'function') throw new TypeError('普通模式 AI 思考函数无效');
    return async (context) => normalize_move(await think(context));
};


/**
 * @description 创建引导落子控制器。
 * 作者定义的引导点是玩家（黑方）的依序落子提示：玩家命中当前引导点则推进到下一个；
 * 一旦落在非当前引导点上，立即取消后续全部引导（不再提示）。
 * @param {[number, number][]} moves 引导落子点顺序（棋盘坐标）
 * @return {{active: () => boolean, current: () => [number, number] | null, advance: (x: number, y: number) => {active: boolean, matched: boolean, done: boolean, cancelled: boolean}, reset: () => void, snapshot: () => object}}
 */
const create_guide = (moves) => {
    const list = (moves || []).map(normalize_move).filter(Boolean);
    let index = 0;
    let cancelled = false;
    const active = () => !cancelled && index < list.length;
    const exhausted = () => !cancelled && index >= list.length;
    const current = () => (active() ? list[index] : null);
    const advance = (x, y) => {
        if (!active()) return { 'active': false, 'matched': false, 'done': exhausted(), 'cancelled': cancelled };
        const expected = list[index];
        const matched = expected[0] === x && expected[1] === y;
        if (matched) index++;
        else cancelled = true;
        return { 'active': active(), 'matched': matched, 'done': exhausted(), 'cancelled': cancelled };
    };
    const reset = () => { index = 0; cancelled = false; };
    return { active, current, advance, reset, 'snapshot': () => ({ index, cancelled, total: list.length, current: current() }) };
};

/**
 * @description 创建 AI 预设落子控制器。
 * 作者定义的 AI 预设是白方（AI）必须依序执行的落子队列：只要预设未走完，
 * 白方就无条件按预设落子（与黑方是否命中正着无关）；预设点若不可落子，
 * 该步由 AI 思考替代并消耗掉这一步，下一回合继续按预设的下一步走。
 * 预设走完后由页面回退到普通模式（正着分支 / 战术 AI）。
 * @param {[number, number][]} moves AI 预设落子点顺序（棋盘坐标）
 * @return {{active: () => boolean, next: () => [number, number] | null, advance: () => number, reset: () => void, snapshot: () => object}}
 */
const create_ai_preset = (moves) => {
    const list = (moves || []).map(normalize_move).filter(Boolean);
    let index = 0;
    const active = () => index < list.length;
    const next = () => (active() ? list[index] : null);
    // 无论该步是否可落子，都消耗当前这一步，保证预设顺序只推进不重复。
    const advance = () => { if (active()) index++; return index; };
    const reset = () => { index = 0; };
    return { active, next, advance, reset, 'snapshot': () => ({ index, total: list.length, current: next() }) };
};

window.EndgameExports = { EndgameArchive, create_branch, create_guide, create_ai_preset, create_normal_ai_adapter, normalize_move };
