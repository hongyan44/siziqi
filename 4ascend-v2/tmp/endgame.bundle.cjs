var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// js/global/utils/basezalgo.cjs
var basezalgo_exports = {};
__export(basezalgo_exports, {
  BaseZalgo: () => BaseZalgo
});
var BaseZalgo;
var init_basezalgo = __esm({
  "js/global/utils/basezalgo.cjs"() {
    BaseZalgo = class {
      static {
        this.MARKS = Array.from({ "length": 64 }, (_, i) => String.fromCharCode(768 + i));
        this.ANCHOR = "|";
      }
      /**
       * @description: 编码函数
       * @param {Uint8Array} data
       * @return {string}
       */
      static encode(data) {
        let bin = "";
        for (let b of data) bin += b.toString(2).padStart(8, "0");
        let result = "";
        for (let i = 0; i < bin.length; i += 6) {
          let chunk = bin.substring(i, i + 6).padEnd(6, "0");
          let index = parseInt(chunk, 2);
          if (i / 6 % 8 === 0) result += this.ANCHOR;
          result += this.MARKS[index];
        }
        return result;
      }
      /**
       * @description: 解码函数
       * @param {string} str
       * @return {Uint8Array}
       */
      static decode(str) {
        let bin = "";
        for (let char of str) {
          let index = this.MARKS.indexOf(char);
          if (index !== -1) bin += index.toString(2).padStart(6, "0");
        }
        let bytes = [];
        for (let i = 0; i < bin.length; i += 8) {
          let chunk = bin.substring(i, i + 8);
          if (chunk.length === 8) bytes.push(parseInt(chunk, 2));
        }
        return new Uint8Array(bytes);
      }
    };
  }
});

// js/global/fascend/rand.cjs
var rand_exports = {};
__export(rand_exports, {
  RandAIC: () => RandAIC,
  RandOther: () => RandOther,
  RandUnity: () => RandUnity
});
var RandAIC, RandUnity, RandOther;
var init_rand = __esm({
  "js/global/fascend/rand.cjs"() {
    RandAIC = class {
      /**
       * @description: AIC Xor128
       * @param {number} seed
       * @return {Rand}
       */
      constructor(seed) {
        this.seed = this.parse(seed);
        this.states = [0, 0, 0, 0];
        this.states[0] = this.seed;
        this.states[1] = this.parse(this.seed + 123456789);
        this.states[2] = this.parse(this.seed + 362436069);
        this.states[3] = this.parse(this.seed + 521288629);
        for (let i = 0; i < 132; i++) this.next();
      }
      /**
       * @description: 截断
       * @param {number} n
       * @return {number}
       */
      parse(n) {
        return n >>> 0;
      }
      /**
       * @description: uint32
       * @return {number}
       */
      next() {
        const num = this.parse(this.states[0] ^ this.parse(this.states[0] << 11));
        this.states[0] = this.states[1];
        this.states[1] = this.states[2];
        this.states[2] = this.states[3];
        this.states[3] = this.parse(this.states[3] ^ this.parse(this.states[3] >>> 19) ^ this.parse(num ^ this.parse(num >>> 8)));
        return this.states[3];
      }
      /**
       * @description: [0, max)
       * @param {number} n 
       */
      xor(n) {
        return this.next() % n;
      }
    };
    RandUnity = class {
      /**
       * @description: Unity Xor128
       * @param {number} seed
       * @return {Rand}
       */
      constructor(seed) {
        this.seed = this.parse(seed);
        this.states = [0, 0, 0, 0];
        this.states[0] = this.seed;
        this.states[1] = this.parse(Math.imul(this.states[0], 1812433253) + 1);
        this.states[2] = this.parse(Math.imul(this.states[1], 1812433253) + 1);
        this.states[3] = this.parse(Math.imul(this.states[2], 1812433253) + 1);
      }
      /**
       * @description: 截断
       * @param {number} n
       * @return {number}
       */
      parse(n) {
        return n >>> 0;
      }
      /**
       * @description: uint32
       * @return {number}
       */
      next() {
        const num = this.parse(this.states[0] ^ this.parse(this.states[0] << 11));
        this.states[0] = this.states[1];
        this.states[1] = this.states[2];
        this.states[2] = this.states[3];
        this.states[3] = this.parse(this.states[3] ^ this.parse(this.states[3] >>> 19) ^ this.parse(num ^ this.parse(num >>> 8)));
        return this.states[3];
      }
      /**
       * @description: 区间
       * @param {number} min
       * @param {number} max
       * @return {number}
       */
      ins(min, max) {
        let dif;
        if (min < max) {
          dif = max - min;
          let t = this.next() % dif;
          t += min;
          return t;
        } else if (min > max) {
          dif = min - max;
          let t = this.next() % dif;
          t = min - t;
          return t;
        } else {
          return min;
        }
      }
      /**
       * @description: 乱序数组
       * @param {Array} array
       * @return {void}
       */
      shuffle(array) {
        const length = array.length;
        const num = (length - 1) * 23;
        for (let ptr = 0; ptr < num; ptr++) {
          const num2 = this.ins(0, length);
          const num3 = this.ins(0, length);
          const num4 = num2;
          const num5 = num3;
          const a1 = array[num3];
          const a2 = array[num2];
          array[num4] = a1;
          array[num5] = a2;
        }
      }
    };
    RandOther = class {
      /**
       * @description: SFC32
       * @param {number} seed
       * @return {number}
       */
      constructor(seed) {
        this.seed = seed | 0;
        this.a = seed | 0;
        this.b = seed ^ 3735928559 | 0;
        this.c = seed ^ 1431655765 | 0;
        this.d = 1;
        for (let i = 0; i < 128; i++) this.next();
      }
      /**
       * @description: 下一个随机数
       * @return {number}
       */
      next() {
        this.a |= 0;
        this.b |= 0;
        this.c |= 0;
        this.d |= 0;
        let t = (this.a + this.b | 0) + this.d | 0;
        this.d = this.d + 1 | 0;
        this.a = this.b ^ this.b >>> 9;
        this.b = this.c + (this.c << 3) | 0;
        this.c = this.c << 21 | this.c >>> 11;
        this.c = this.c + t | 0;
        return t >>> 0;
      }
      /**
       * @description: 随机浮点数
       * @return {number}
       */
      float() {
        return this.next() / 4294967296;
      }
      /**
       * @description: 拒绝采样随机
       * @param {number} max
       * @return {number}
       */
      xor(max) {
        const limit = (-max >>> 0) % max;
        while (true) {
          const r = this.next();
          if (r >= limit) return r % max;
        }
      }
    };
  }
});

// js/global/endgame.cjs
var { BaseZalgo: BaseZalgo2 } = (init_basezalgo(), __toCommonJS(basezalgo_exports));
var { RandAIC: RandAIC2, RandUnity: RandUnity2 } = (init_rand(), __toCommonJS(rand_exports));
var BOARD_SIZE = 9;
var BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
var ARCHIVE_VERSION = 5;
var AI_PRESET_ARCHIVE_VERSION = 5;
var GUIDE_ARCHIVE_VERSION = 4;
var PLANT_ARCHIVE_VERSION = 3;
var SNAPSHOT_ARCHIVE_VERSION = 2;
var LEGACY_ARCHIVE_VERSION = 1;
var SUPPORTED_ARCHIVE_VERSIONS = [AI_PRESET_ARCHIVE_VERSION, GUIDE_ARCHIVE_VERSION, PLANT_ARCHIVE_VERSION, SNAPSHOT_ARCHIVE_VERSION, LEGACY_ARCHIVE_VERSION];
var MAGIC = [69, 71, 75];
var FALLBACK_AI = "4ascend-zero";
var BitWriter = class {
  constructor() {
    this.bytes = [];
    this.offset = 0;
  }
  write(value, length) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 0 || number >= 2 ** length) {
      throw new RangeError(`\u65E0\u6CD5\u5C06 ${value} \u5199\u5165 ${length} \u4F4D`);
    }
    for (let bit = length - 1; bit >= 0; bit--) {
      const byteIndex = Math.floor(this.offset / 8);
      const bitIndex = 7 - this.offset % 8;
      if (this.bytes[byteIndex] === void 0) this.bytes[byteIndex] = 0;
      if (number >> bit & 1) this.bytes[byteIndex] |= 1 << bitIndex;
      this.offset++;
    }
  }
  align() {
    while (this.offset % 8) this.write(0, 1);
  }
  toUint8Array() {
    return Uint8Array.from(this.bytes);
  }
};
var BitReader = class {
  constructor(data) {
    this.data = data;
    this.offset = 0;
  }
  read(length) {
    if (length < 0 || this.offset + length > this.data.length * 8) throw new Error("\u6B8B\u5C40\u6570\u636E\u957F\u5EA6\u4E0D\u8DB3");
    let value = 0;
    for (let i = 0; i < length; i++) {
      const byteIndex = Math.floor(this.offset / 8);
      const bitIndex = 7 - this.offset % 8;
      value = value * 2 + (this.data[byteIndex] >> bitIndex & 1);
      this.offset++;
    }
    return value;
  }
  align() {
    this.offset += (8 - this.offset % 8) % 8;
  }
};
var crc16 = (data) => {
  let crc = 65535;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 32768 ? (crc << 1 ^ 4129) & 65535 : crc << 1 & 65535;
  }
  return crc;
};
var normalize_move = (move) => {
  if (!Array.isArray(move) || move.length < 2) return null;
  const x = Number(move[0]);
  const y = Number(move[1]);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return null;
  return [x, y];
};
var normalize_moves = (moves, name) => {
  if (!Array.isArray(moves)) throw new TypeError(`${name} \u5FC5\u987B\u662F\u6570\u7EC4`);
  if (moves.length > 255) throw new RangeError(`${name} \u4E0D\u80FD\u8D85\u8FC7 255 \u624B`);
  return moves.map(normalize_move).map((move, index) => {
    if (!move) throw new RangeError(`${name}[${index}] \u4E0D\u662F\u5408\u6CD5\u5750\u6807`);
    return move;
  });
};
var MAX_PLANT_SCHEDULE = 255;
var normalize_plant_schedule = (schedule) => {
  if (schedule === void 0 || schedule === null) return [];
  if (!Array.isArray(schedule)) throw new TypeError("\u5237\u8349\u8BA1\u5212\u5FC5\u987B\u662F\u6570\u7EC4");
  if (schedule.length > MAX_PLANT_SCHEDULE) throw new RangeError(`\u5237\u8349\u8BA1\u5212\u4E0D\u80FD\u8D85\u8FC7 ${MAX_PLANT_SCHEDULE} \u6761`);
  return schedule.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new TypeError(`\u5237\u8349\u8BA1\u5212[${index}] \u65E0\u6548`);
    const turn = bounded_integer(entry.turn, 0, 65535, 1, `\u5237\u8349\u8BA1\u5212[${index}] \u56DE\u5408`);
    if (!Array.isArray(entry.cells)) throw new TypeError(`\u5237\u8349\u8BA1\u5212[${index}] \u7684\u5237\u8349\u70B9\u5FC5\u987B\u662F\u6570\u7EC4`);
    if (entry.cells.length > BOARD_CELLS) throw new RangeError(`\u5237\u8349\u8BA1\u5212[${index}] \u7684\u5237\u8349\u70B9\u4E0D\u80FD\u8D85\u8FC7 ${BOARD_CELLS} \u4E2A`);
    return {
      turn,
      cells: entry.cells.map((cell, cellIndex) => {
        const move = normalize_move(cell);
        if (!move) throw new RangeError(`\u5237\u8349\u8BA1\u5212[${index}] \u7684\u5237\u8349\u70B9 ${cellIndex} \u4E0D\u662F\u5408\u6CD5\u5750\u6807`);
        return move;
      })
    };
  });
};
var STONE_NAMES = ["none", "black", "white", "black-ascend", "white-ascend", "black-used", "white-used"];
var stone_code = (stone) => {
  if (Number.isInteger(stone) && stone >= 0 && stone < STONE_NAMES.length) return stone;
  const code = STONE_NAMES.indexOf(stone);
  return code < 0 ? 0 : code;
};
var code_stone = (code) => STONE_NAMES[code] || "none";
var bounded_integer = (value, minimum, maximum, fallback, name) => {
  const parsed = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  if (parsed < minimum || parsed > maximum) throw new RangeError(`${name} \u5FC5\u987B\u662F ${minimum} \u5230 ${maximum} \u7684\u6574\u6570`);
  return parsed;
};
var mode_code = (mode) => mode === "blight" ? 1 : mode === "night" ? 2 : 0;
var code_mode = (code) => code === 1 ? "blight" : code === 2 ? "night" : "normal";
var normalize_rng = (input, RandomClass, fallbackSeed) => {
  const source = input && !Array.isArray(input) ? input : { "states": input };
  const seed = bounded_integer(source && source.seed, 0, 4294967295, fallbackSeed >>> 0, "\u968F\u673A\u79CD\u5B50") >>> 0;
  const fallback = new RandomClass(seed);
  const states = source && Array.isArray(source.states) && source.states.length === 4 ? source.states.map((value) => bounded_integer(value, 0, 4294967295, 0, "\u968F\u673A\u72B6\u6001") >>> 0) : [...fallback.states];
  return { seed, states };
};
var normalize_cells = (data, snapshot) => {
  if (Array.isArray(snapshot.stones) && snapshot.stones.length === BOARD_CELLS && Array.isArray(snapshot.plants) && snapshot.plants.length === BOARD_CELLS) {
    return snapshot.stones.map((stone, index) => ({ "stone": stone_code(stone), "plant": Number(snapshot.plants[index]) || 0 }));
  }
  if (Array.isArray(data.cells) && data.cells.length === BOARD_CELLS) {
    return data.cells.map((cell) => ({ "stone": stone_code(cell && cell.stone), "plant": Number(cell && cell.plant) || 0 }));
  }
  throw new TypeError("\u6B8B\u5C40\u76D8\u9762\u5FC5\u987B\u662F 81 \u683C cells \u6216\u5B8C\u6574 snapshot");
};
var normalize_history = (history) => (history || []).slice(-7).map((entry, index) => {
  if (!entry || entry.length !== BOARD_CELLS) throw new RangeError(`\u5386\u53F2\u76D8\u9762 ${index} \u5FC5\u987B\u662F 81 \u683C`);
  return Array.from(entry, (stone) => bounded_integer(stone, 0, 2, 0, "\u5386\u53F2\u68CB\u5B50"));
});
var normalize_turns = (turns) => (turns || []).slice(-255).map((move, index) => {
  const normalized = normalize_move(move);
  if (!normalized) throw new RangeError(`\u843D\u5B50\u5386\u53F2 ${index} \u4E0D\u662F\u5408\u6CD5\u5750\u6807`);
  return normalized;
});
var EndgameArchive = class {
  /**
   * V5 stores a complete turn-boundary snapshot: transient stone/state
   * codes, both RNG streams, model history, move history, the authored
   * solution line, the author-defined scheduled-plant plan, the
   * author-defined ordered guide-move markers, and the author-defined
   * AI-preset move sequence.
   * V1~V4 decoding remains supported for published puzzles.
   */
  static save(data) {
    if (!data || typeof data !== "object") throw new TypeError("\u6B8B\u5C40\u6570\u636E\u65E0\u6548");
    const snapshot = data.snapshot || {};
    const cells = normalize_cells(data, snapshot);
    const blackBook = normalize_moves(data.blackBook || data.black_book || [], "\u9ED1\u65B9\u6B63\u7740");
    const whiteTurns = normalize_moves(data.whiteTurns || data.white_turns || [], "\u767D\u65B9\u9884\u6848");
    if (blackBook.length !== whiteTurns.length) throw new RangeError("\u9ED1\u65B9\u6B63\u7740\u4E0E\u767D\u65B9\u9884\u6848\u624B\u6570\u5FC5\u987B\u4E00\u81F4");
    const plantSchedule = normalize_plant_schedule(data.plantSchedule || data.plant_schedule);
    const guideMoves = normalize_moves(data.guideMoves || data.guide_moves || [], "\u5F15\u5BFC\u843D\u5B50\u70B9");
    const aiPreset = normalize_moves(data.aiPreset || data.ai_preset || [], "AI\u9884\u8BBE");
    const hp = data.hp || {};
    const snapshotHp = Array.isArray(snapshot.hp) ? snapshot.hp : [];
    const blackHp = bounded_integer(hp.black ?? snapshotHp[0], 0, 127, 6, "\u9ED1\u65B9 HP");
    const whiteHp = bounded_integer(hp.white ?? snapshotHp[1], 0, 127, 6, "\u767D\u65B9 HP");
    const gameMode = snapshot.mode || data.game_mode || code_mode(Number(data.mode_code) || 0);
    const firstPlayer = snapshot.firstPlayer === void 0 ? data.first === "white" ? 1 : 0 : snapshot.firstPlayer === 1 ? 1 : 0;
    const turnPlayer = snapshot.turnPlayer === 1 ? 1 : 0;
    const naturalPlant = snapshot.naturalPlant === void 0 ? Boolean(data.natural_plant) : Boolean(snapshot.naturalPlant);
    const flags = (data.player === "white" ? 1 : 0) | (firstPlayer ? 2 : 0) | (naturalPlant ? 4 : 0) | (mode_code(gameMode) & 3) << 3 | (turnPlayer ? 32 : 0);
    const fallbackLevel = bounded_integer(data.fallback?.level, 0, 255, 2, "\u666E\u901A AI \u96BE\u5EA6");
    const turnCount = bounded_integer(snapshot.turnCount, 0, 65535, 0, "\u56DE\u5408\u6570");
    const turnPos = Array.isArray(snapshot.turnPos) ? snapshot.turnPos : [0, 0];
    const turnX = bounded_integer(turnPos[0], 0, 8, 0, "\u6700\u540E\u843D\u5B50 X");
    const turnY = bounded_integer(turnPos[1], 0, 8, 0, "\u6700\u540E\u843D\u5B50 Y");
    const ascendStatus = bounded_integer(snapshot.ascendStatus, 0, 2, 0, "ASCEND \u72B6\u6001");
    const overStatus = bounded_integer(snapshot.overStatus, 0, 2, 0, "\u8D85\u8F7D\u72B6\u6001");
    const unascendCharge = bounded_integer(snapshot.unascendCharge, 0, 255, 25, "\u53CD\u5347\u53D8\u84C4\u529B");
    const fastCharge = Array.isArray(snapshot.fastUnascendCharge) ? snapshot.fastUnascendCharge : [9, 9];
    const fastBlack = bounded_integer(fastCharge[0], 0, 255, 9, "\u9ED1\u65B9\u5FEB\u901F\u84C4\u529B");
    const fastWhite = bounded_integer(fastCharge[1], 0, 255, 9, "\u767D\u65B9\u5FEB\u901F\u84C4\u529B");
    const growCount = bounded_integer(snapshot.growCount, 0, 255, 11, "\u690D\u7269\u751F\u6210\u5012\u8BA1\u65F6");
    const pendingDamage = Array.isArray(snapshot.pendingDamage) ? snapshot.pendingDamage : null;
    const pendingBlack = bounded_integer(pendingDamage && pendingDamage[0], 0, 255, 0, "\u9ED1\u65B9\u5F85\u7ED3\u7B97\u4F24\u5BB3");
    const pendingWhite = bounded_integer(pendingDamage && pendingDamage[1], 0, 255, 0, "\u767D\u65B9\u5F85\u7ED3\u7B97\u4F24\u5BB3");
    const randAic = normalize_rng(snapshot.randAic || data.randAic, RandAIC2, 1246972721);
    const randUnity = normalize_rng(snapshot.randUnity || data.randUnity, RandUnity2, 1246972722);
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
    writer.write(turnX, 4);
    writer.write(turnY, 4);
    writer.write(ascendStatus, 2);
    writer.write(overStatus, 2);
    writer.write(snapshot.justUnascend ? 1 : 0, 1);
    writer.write(pendingDamage ? 1 : 0, 1);
    writer.write(snapshot.alwaysOverload ? 1 : 0, 1);
    writer.write(0, 1);
    writer.write(unascendCharge, 8);
    writer.write(fastBlack, 8);
    writer.write(fastWhite, 8);
    writer.write(growCount, 8);
    writer.write(pendingBlack, 8);
    writer.write(pendingWhite, 8);
    [randAic, randUnity].forEach((random) => {
      writer.write(random.seed, 32);
      random.states.forEach((state) => writer.write(state, 32));
    });
    cells.forEach((item, index) => {
      const stone = bounded_integer(item.stone, 0, 6, 0, `\u76D8\u9762\u7B2C ${index + 1} \u683C\u68CB\u5B50`);
      const plant = bounded_integer(item.plant, 0, 2, 0, `\u76D8\u9762\u7B2C ${index + 1} \u683C\u8349\u6570`);
      writer.write(stone, 3);
      writer.write(plant, 2);
    });
    writer.write(history.length, 3);
    history.forEach((board) => board.forEach((stone) => writer.write(stone, 2)));
    writer.write(turns.length, 8);
    turns.forEach((move) => {
      writer.write(move[0], 4);
      writer.write(move[1], 4);
    });
    writer.write(blackBook.length, 8);
    blackBook.forEach((blackMove, index) => {
      const whiteMove = whiteTurns[index];
      writer.write(blackMove[0], 4);
      writer.write(blackMove[1], 4);
      writer.write(whiteMove[0], 4);
      writer.write(whiteMove[1], 4);
    });
    writer.write(plantSchedule.length, 8);
    plantSchedule.forEach((entry) => {
      writer.write(entry.turn, 16);
      writer.write(entry.cells.length, 8);
      entry.cells.forEach((cell) => {
        writer.write(cell[0], 4);
        writer.write(cell[1], 4);
      });
    });
    writer.write(guideMoves.length, 8);
    guideMoves.forEach((move) => {
      writer.write(move[0], 4);
      writer.write(move[1], 4);
    });
    writer.write(aiPreset.length, 8);
    aiPreset.forEach((move) => {
      writer.write(move[0], 4);
      writer.write(move[1], 4);
    });
    writer.align();
    const body = writer.toUint8Array();
    const result = new Uint8Array(body.length + 2);
    result.set(body);
    const checksum = crc16(body);
    result[body.length] = checksum >> 8;
    result[body.length + 1] = checksum & 255;
    return result;
  }
  static load(input) {
    const data = input instanceof Uint8Array ? input : new Uint8Array(input || []);
    if (data.length < 46) throw new Error("\u6B8B\u5C40\u4E8C\u8FDB\u5236\u6570\u636E\u8FC7\u77ED");
    const reader = new BitReader(data);
    const magic = [reader.read(8), reader.read(8), reader.read(8)];
    if (magic.some((byte, index) => byte !== MAGIC[index])) throw new Error("\u4E0D\u662F\u6709\u6548\u7684\u6B8B\u5C40\u5173\u5361\u6570\u636E");
    const version = reader.read(8);
    if (!SUPPORTED_ARCHIVE_VERSIONS.includes(version)) {
      throw new Error(`\u4E0D\u652F\u6301\u7684\u6B8B\u5C40\u5173\u5361\u7248\u672C: ${version}`);
    }
    const flags = reader.read(8);
    const fallbackLevel = reader.read(8);
    const blackHp = reader.read(7);
    const whiteHp = reader.read(7);
    const gameMode = code_mode(flags >> 3 & 3);
    let snapshot;
    let cells;
    if (version === LEGACY_ARCHIVE_VERSION) {
      cells = Array.from({ length: BOARD_CELLS }, () => {
        const stone = reader.read(2);
        const plant = reader.read(2);
        if (stone > 2) throw new Error("\u6B8B\u5C40\u76D8\u9762\u5305\u542B\u672A\u77E5\u68CB\u5B50\u7C7B\u578B");
        return { stone: code_stone(stone), plant };
      });
      const randAic = normalize_rng(null, RandAIC2, 1246972721);
      const randUnity = normalize_rng(null, RandUnity2, 1246972722);
      snapshot = {
        "version": 2,
        "mode": gameMode,
        "width": 9,
        "height": 9,
        "stones": cells.map((cell) => stone_code(cell.stone)),
        "plants": cells.map((cell) => cell.plant),
        "turns": [],
        "turnPlayer": 0,
        "firstPlayer": flags & 2 ? 1 : 0,
        "turnCount": 0,
        "turnPos": [0, 0],
        "ascendStatus": 0,
        "hp": [blackHp, whiteHp],
        "pendingDamage": null,
        "unascendCharge": 25,
        "fastUnascendCharge": [9, 9],
        "growCount": 11,
        "justUnascend": false,
        "overStatus": 0,
        "history": [],
        randAic,
        randUnity,
        "naturalPlant": Boolean(flags & 4),
        "alwaysOverload": gameMode === "night"
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
        "seed": reader.read(32) >>> 0,
        "states": [reader.read(32) >>> 0, reader.read(32) >>> 0, reader.read(32) >>> 0, reader.read(32) >>> 0]
      });
      const randAic = readRandom();
      const randUnity = readRandom();
      cells = Array.from({ length: BOARD_CELLS }, () => {
        const stone = reader.read(3);
        const plant = reader.read(2);
        if (stone > 6 || plant > 2) throw new Error("\u6B8B\u5C40\u76D8\u9762\u5305\u542B\u672A\u77E5\u68CB\u5B50\u6216\u690D\u7269\u7C7B\u578B");
        return { stone: code_stone(stone), plant };
      });
      const historyCount = reader.read(3);
      const history = Array.from(
        { length: historyCount },
        () => Array.from({ length: BOARD_CELLS }, () => reader.read(2))
      );
      if (history.some((board) => board.some((stone) => stone > 2))) throw new Error("\u6B8B\u5C40\u5386\u53F2\u76D8\u9762\u5305\u542B\u672A\u77E5\u68CB\u5B50\u7C7B\u578B");
      const turnLength = reader.read(8);
      const turns = Array.from({ length: turnLength }, () => [reader.read(4), reader.read(4)]);
      snapshot = {
        "version": 2,
        "mode": gameMode,
        "width": 9,
        "height": 9,
        "stones": cells.map((cell) => stone_code(cell.stone)),
        "plants": cells.map((cell) => cell.plant),
        turns,
        "turnPlayer": flags & 32 ? 1 : 0,
        "firstPlayer": flags & 2 ? 1 : 0,
        turnCount,
        turnPos,
        ascendStatus,
        "hp": [blackHp, whiteHp],
        "pendingDamage": hasPendingDamage ? pending : null,
        unascendCharge,
        fastUnascendCharge,
        growCount,
        justUnascend,
        overStatus,
        history,
        randAic,
        randUnity,
        "naturalPlant": Boolean(flags & 4),
        alwaysOverload
      };
    }
    const pairCount = reader.read(8);
    const blackBook = [];
    const whiteTurns = [];
    for (let i = 0; i < pairCount; i++) {
      blackBook.push([reader.read(4), reader.read(4)]);
      whiteTurns.push([reader.read(4), reader.read(4)]);
    }
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
    const guideMoves = [];
    if (version >= GUIDE_ARCHIVE_VERSION) {
      const guideCount = reader.read(8);
      for (let i = 0; i < guideCount; i++) guideMoves.push([reader.read(4), reader.read(4)]);
    }
    const aiPreset = [];
    if (version >= AI_PRESET_ARCHIVE_VERSION) {
      const aiCount = reader.read(8);
      for (let i = 0; i < aiCount; i++) aiPreset.push([reader.read(4), reader.read(4)]);
    }
    reader.align();
    const checksumOffset = reader.offset / 8;
    if (checksumOffset + 2 !== data.length) throw new Error("\u6B8B\u5C40\u6570\u636E\u5B58\u5728\u622A\u65AD\u6216\u591A\u4F59\u5B57\u8282");
    const actualChecksum = data[checksumOffset] << 8 | data[checksumOffset + 1];
    const expectedChecksum = crc16(data.subarray(0, checksumOffset));
    if (actualChecksum !== expectedChecksum) throw new Error("\u6B8B\u5C40\u6570\u636E\u6821\u9A8C\u5931\u8D25");
    return {
      format: `endgame-binary-v${version}`,
      version,
      mode: "endgame",
      game_mode: gameMode,
      player: flags & 1 ? "white" : "black",
      first: flags & 2 ? "white" : "black",
      natural_plant: Boolean(flags & 4),
      hp: { black: blackHp, white: whiteHp },
      cells,
      black_book: blackBook,
      white_turns: whiteTurns,
      plant_schedule: plantSchedule,
      guide_moves: guideMoves,
      ai_preset: aiPreset,
      snapshot,
      fallback: { mode: "normal", ai: FALLBACK_AI, level: fallbackLevel, trigger: "black-deviation" }
    };
  }
  static encode(data) {
    return BaseZalgo2.encode(this.save(data));
  }
  static decode(text) {
    if (typeof text !== "string" || text.length === 0) throw new TypeError("\u6B8B\u5C40\u7F16\u7801\u5FC5\u987B\u662F\u975E\u7A7A\u5B57\u7B26\u4E32");
    return this.load(BaseZalgo2.decode(text));
  }
};
var move_key = (move) => `${move[0]},${move[1]}`;
var create_branch = (black_book, white_turns, fallback_ai) => {
  const book = (black_book || []).map(normalize_move).filter(Boolean);
  const white = (white_turns || []).map(normalize_move).filter(Boolean);
  if (typeof fallback_ai !== "function") throw new TypeError("\u6B8B\u5C40\u5206\u652F\u9700\u8981\u666E\u901A\u6A21\u5F0F AI \u56DE\u8C03");
  let index = 0;
  let mode = "book";
  let deviation = null;
  const reset = () => {
    index = 0;
    mode = "book";
    deviation = null;
  };
  const snapshot = () => ({ mode, index, next_black: book[index] || null, next_white: white[index] || null, deviation });
  const fallback = async (black_move2, context, reason) => {
    mode = "normal-ai";
    deviation = deviation || { index, expected: book[index] || null, actual: black_move2 };
    const ai_move = normalize_move(await fallback_ai({ ...context, black_move: black_move2, reason, book_index: index }));
    if (!ai_move) throw new Error("\u666E\u901A\u6A21\u5F0F AI \u672A\u8FD4\u56DE\u5408\u6CD5\u5750\u6807");
    return { mode, matched: false, reason, black_move: black_move2, white_move: ai_move, source: "normal-ai", state: snapshot() };
  };
  const black_move = async (move, context = {}) => {
    const actual = normalize_move(move);
    if (!actual) throw new TypeError("\u9ED1\u65B9\u843D\u5B50\u5750\u6807\u65E0\u6548");
    if (mode === "normal-ai") return fallback(actual, context, "already-deviated");
    const expected = book[index];
    if (!expected) return fallback(actual, context, "book-finished");
    if (move_key(actual) !== move_key(expected)) return fallback(actual, context, "black-deviation");
    const white_move = white[index];
    if (!white_move) return fallback(actual, context, "white-plan-missing");
    index++;
    return { mode: "book", matched: true, reason: "black-book-match", black_move: actual, white_move, source: "book", state: snapshot() };
  };
  return { black_move, reset, snapshot };
};
var create_normal_ai_adapter = (think) => {
  if (typeof think !== "function") throw new TypeError("\u666E\u901A\u6A21\u5F0F AI \u601D\u8003\u51FD\u6570\u65E0\u6548");
  return async (context) => normalize_move(await think(context));
};
var create_guide = (moves) => {
  const list = (moves || []).map(normalize_move).filter(Boolean);
  let index = 0;
  let cancelled = false;
  const active = () => !cancelled && index < list.length;
  const exhausted = () => !cancelled && index >= list.length;
  const current = () => active() ? list[index] : null;
  const advance = (x, y) => {
    if (!active()) return { "active": false, "matched": false, "done": exhausted(), "cancelled": cancelled };
    const expected = list[index];
    const matched = expected[0] === x && expected[1] === y;
    if (matched) index++;
    else cancelled = true;
    return { "active": active(), "matched": matched, "done": exhausted(), "cancelled": cancelled };
  };
  const reset = () => {
    index = 0;
    cancelled = false;
  };
  return { active, current, advance, reset, "snapshot": () => ({ index, cancelled, total: list.length, current: current() }) };
};
var create_ai_preset = (moves) => {
  const list = (moves || []).map(normalize_move).filter(Boolean);
  let index = 0;
  const active = () => index < list.length;
  const next = () => active() ? list[index] : null;
  const advance = () => {
    if (active()) index++;
    return index;
  };
  const reset = () => {
    index = 0;
  };
  return { active, next, advance, reset, "snapshot": () => ({ index, total: list.length, current: next() }) };
};
window.EndgameExports = { EndgameArchive, create_branch, create_guide, create_ai_preset, create_normal_ai_adapter, normalize_move };
