(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __pow = Math.pow;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
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
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // js/global/utils/basezalgo.cjs
  var basezalgo_exports = {};
  __export(basezalgo_exports, {
    BaseZalgo: () => BaseZalgo
  });
  var _BaseZalgo, BaseZalgo;
  var init_basezalgo = __esm({
    "js/global/utils/basezalgo.cjs"() {
      _BaseZalgo = class _BaseZalgo {
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
      _BaseZalgo.MARKS = Array.from({ "length": 64 }, (_, i) => String.fromCharCode(768 + i));
      _BaseZalgo.ANCHOR = "|";
      BaseZalgo = _BaseZalgo;
    }
  });

  // js/global/endgame.cjs
  var require_endgame = __commonJS({
    "js/global/endgame.cjs"(exports) {
      var { BaseZalgo: BaseZalgo2 } = (init_basezalgo(), __toCommonJS(basezalgo_exports));
      var BOARD_SIZE = 9;
      var BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
      var ARCHIVE_VERSION = 1;
      var MAGIC = [69, 71, 75];
      var FALLBACK_AI = "4ascend-zero";
      var BitWriter = class {
        constructor() {
          this.bytes = [];
          this.offset = 0;
        }
        write(value, length) {
          const number = Number(value);
          if (!Number.isInteger(number) || number < 0 || number >= __pow(2, length)) {
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
      var stone_code = (stone) => stone === "black" ? 1 : stone === "white" ? 2 : 0;
      var code_stone = (code) => code === 1 ? "black" : code === 2 ? "white" : "none";
      var EndgameArchive = class {
        /**
         * 二进制布局（高位优先）：
         * EGK(24) + version(8) + flags(8) + fallback level(8) + HP(7+7)
         * + 81 个棋盘格(每格 stone 2bit + plant 2bit)
         * + 配对数量(8) + N 组黑方正着/白方预案坐标(各 4bit x + 4bit y)
         * + 对齐 + CRC-16(16)。
         */
        static save(data) {
          var _a, _b;
          if (!data || !Array.isArray(data.cells) || data.cells.length !== BOARD_CELLS) throw new TypeError("\u6B8B\u5C40\u76D8\u9762\u5FC5\u987B\u662F 81 \u683C cells");
          const blackBook = normalize_moves(data.blackBook || data.black_book || [], "\u9ED1\u65B9\u6B63\u7740");
          const whiteTurns = normalize_moves(data.whiteTurns || data.white_turns || [], "\u767D\u65B9\u9884\u6848");
          if (blackBook.length !== whiteTurns.length) throw new RangeError("\u9ED1\u65B9\u6B63\u7740\u4E0E\u767D\u65B9\u9884\u6848\u624B\u6570\u5FC5\u987B\u4E00\u81F4");
          const hp = data.hp || {};
          const blackHp = Number(hp.black);
          const whiteHp = Number(hp.white);
          if (![blackHp, whiteHp].every((value) => Number.isInteger(value) && value >= 0 && value <= 127)) throw new RangeError("HP \u5FC5\u987B\u662F 0 \u5230 127 \u7684\u6574\u6570");
          const flags = (data.player === "white" ? 1 : 0) | (data.first === "white" ? 2 : 0) | (data.natural_plant ? 4 : 0) | ((Number(data.mode_code) || 0) & 3) << 3;
          const fallbackLevel = Number((_b = (_a = data.fallback) == null ? void 0 : _a.level) != null ? _b : 2);
          if (!Number.isInteger(fallbackLevel) || fallbackLevel < 0 || fallbackLevel > 255) throw new RangeError("\u666E\u901A AI \u96BE\u5EA6\u5FC5\u987B\u662F 0 \u5230 255 \u7684\u6574\u6570");
          const writer = new BitWriter();
          MAGIC.forEach((byte) => writer.write(byte, 8));
          writer.write(ARCHIVE_VERSION, 8);
          writer.write(flags, 8);
          writer.write(fallbackLevel, 8);
          writer.write(blackHp, 7);
          writer.write(whiteHp, 7);
          data.cells.forEach((item, index) => {
            const stone = stone_code(item == null ? void 0 : item.stone);
            const plant = Number((item == null ? void 0 : item.plant) || 0);
            if (!Number.isInteger(plant) || plant < 0 || plant > 2) throw new RangeError(`\u76D8\u9762\u7B2C ${index + 1} \u683C\u8349\u6570\u65E0\u6548`);
            writer.write(stone, 2);
            writer.write(plant, 2);
          });
          writer.write(blackBook.length, 8);
          blackBook.forEach((blackMove, index) => {
            const whiteMove = whiteTurns[index];
            writer.write(blackMove[0], 4);
            writer.write(blackMove[1], 4);
            writer.write(whiteMove[0], 4);
            writer.write(whiteMove[1], 4);
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
          if (data.length < 49) throw new Error("\u6B8B\u5C40\u4E8C\u8FDB\u5236\u6570\u636E\u8FC7\u77ED");
          const reader = new BitReader(data);
          const magic = [reader.read(8), reader.read(8), reader.read(8)];
          if (magic.some((byte, index) => byte !== MAGIC[index])) throw new Error("\u4E0D\u662F\u6709\u6548\u7684\u6B8B\u5C40\u5173\u5361\u6570\u636E");
          const version = reader.read(8);
          if (version !== ARCHIVE_VERSION) throw new Error(`\u4E0D\u652F\u6301\u7684\u6B8B\u5C40\u5173\u5361\u7248\u672C: ${version}`);
          const flags = reader.read(8);
          const fallbackLevel = reader.read(8);
          const blackHp = reader.read(7);
          const whiteHp = reader.read(7);
          const cells = Array.from({ length: BOARD_CELLS }, () => {
            const stone = reader.read(2);
            const plant = reader.read(2);
            if (stone > 2) throw new Error("\u6B8B\u5C40\u76D8\u9762\u5305\u542B\u672A\u77E5\u68CB\u5B50\u7C7B\u578B");
            return { stone: code_stone(stone), plant };
          });
          const pairCount = reader.read(8);
          const blackBook = [];
          const whiteTurns = [];
          for (let i = 0; i < pairCount; i++) {
            blackBook.push([reader.read(4), reader.read(4)]);
            whiteTurns.push([reader.read(4), reader.read(4)]);
          }
          reader.align();
          const checksumOffset = reader.offset / 8;
          if (checksumOffset + 2 !== data.length) throw new Error("\u6B8B\u5C40\u6570\u636E\u5B58\u5728\u622A\u65AD\u6216\u591A\u4F59\u5B57\u8282");
          const actualChecksum = data[checksumOffset] << 8 | data[checksumOffset + 1];
          const expectedChecksum = crc16(data.subarray(0, checksumOffset));
          if (actualChecksum !== expectedChecksum) throw new Error("\u6B8B\u5C40\u6570\u636E\u6821\u9A8C\u5931\u8D25");
          return {
            format: "endgame-binary-v1",
            version,
            mode: "endgame",
            player: flags & 1 ? "white" : "black",
            first: flags & 2 ? "white" : "black",
            natural_plant: Boolean(flags & 4),
            hp: { black: blackHp, white: whiteHp },
            cells,
            black_book: blackBook,
            white_turns: whiteTurns,
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
        const fallback = (black_move2, context, reason) => __async(null, null, function* () {
          mode = "normal-ai";
          deviation = deviation || { index, expected: book[index] || null, actual: black_move2 };
          const ai_move = normalize_move(yield fallback_ai(__spreadProps(__spreadValues({}, context), { black_move: black_move2, reason, book_index: index })));
          if (!ai_move) throw new Error("\u666E\u901A\u6A21\u5F0F AI \u672A\u8FD4\u56DE\u5408\u6CD5\u5750\u6807");
          return { mode, matched: false, reason, black_move: black_move2, white_move: ai_move, source: "normal-ai", state: snapshot() };
        });
        const black_move = (_0, ..._1) => __async(null, [_0, ..._1], function* (move, context = {}) {
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
        });
        return { black_move, reset, snapshot };
      };
      var create_normal_ai_adapter = (think) => {
        if (typeof think !== "function") throw new TypeError("\u666E\u901A\u6A21\u5F0F AI \u601D\u8003\u51FD\u6570\u65E0\u6548");
        return (context) => __async(null, null, function* () {
          return normalize_move(yield think(context));
        });
      };
      window.EndgameExports = { EndgameArchive, create_branch, create_normal_ai_adapter, normalize_move };
    }
  });
  require_endgame();
})();
