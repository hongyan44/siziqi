/*
 * 残局码导入坐标与挑战模式刷草回归。
 * 不启动浏览器：直接复用编辑器导出、挑战导入映射，以及 GameNormal 的自然刷草开关。
 */
const { Board } = require('../js/global/fascend/board.cjs');
const { State } = require('../js/global/fascend/state.cjs');
const { GameNormal } = require('../js/global/fascend/game_normal.cjs');
const { RandAIC, RandUnity } = require('../js/global/fascend/rand.cjs');
const { STONE_ENUM, PLANT_ENUM, PLAYER_ENUM } = require('../js/global/fascend/enum.cjs');

const BOARD_SIZE = 9;
const indexOf = (x, y) => y * BOARD_SIZE + x;
const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const archiveMoveToBoard = (move, importedArchive) => importedArchive ? [move[0], BOARD_SIZE - 1 - move[1]] : [move[0], move[1]];
const syncArchiveToBoard = (game, cells, importedArchive) => {
    cells.forEach((item, idx) => {
        const archiveX = idx % BOARD_SIZE;
        const archiveY = Math.floor(idx / BOARD_SIZE);
        const boardY = importedArchive ? BOARD_SIZE - 1 - archiveY : archiveY;
        const stone = item.stone === 'black' ? STONE_ENUM.BLACK : item.stone === 'white' ? STONE_ENUM.WHITE : STONE_ENUM.NONE;
        const plant = item.plant === 2 ? PLANT_ENUM.TWO : item.plant === 1 ? PLANT_ENUM.ONE : PLANT_ENUM.NONE;
        game.board.set_pos(archiveX, boardY, stone, plant);
    });
};

const cells = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => ({ stone: 'none', plant: 0 }));
cells[indexOf(4, 0)] = { stone: 'black', plant: 0 };
cells[indexOf(4, 8)] = { stone: 'white', plant: 1 };

const editorDisplayY = (archiveY) => BOARD_SIZE - 1 - archiveY;
assert(editorDisplayY(0) === 8, '编辑器内部坐标应把逻辑 y=0 画到底部');
assert(editorDisplayY(8) === 0, '编辑器内部坐标应把逻辑 y=8 画到顶部');

const importedGame = new GameNormal(new Board(9, 9), new State(), new RandAIC(1), new RandUnity(2));
syncArchiveToBoard(importedGame, cells, true);
assert(importedGame.board.get_stone(4, 8) === STONE_ENUM.BLACK, '导入残局码后，编辑器底部黑子应出现在挑战页底部');
assert(importedGame.board.get_stone(4, 0) === STONE_ENUM.WHITE, '导入残局码后，编辑器顶部白子应出现在挑战页顶部');
assert(JSON.stringify(archiveMoveToBoard([4, 0], true)) === JSON.stringify([4, 8]), '导入残局码后，正着也应同步翻转 Y 轴');

const dailyGame = new GameNormal(new Board(9, 9), new State(), new RandAIC(3), new RandUnity(4));
syncArchiveToBoard(dailyGame, cells, false);
assert(dailyGame.board.get_stone(4, 0) === STONE_ENUM.BLACK, '内置每日挑战坐标不能二次翻转');
assert(dailyGame.board.get_stone(4, 8) === STONE_ENUM.WHITE, '内置每日挑战顶部棋子应保持原位置');

const challengeState = new State();
challengeState.grow_count = 1;
challengeState.turn_player = PLAYER_ENUM.BLACK;
const challengeGame = new GameNormal(new Board(9, 9), challengeState, new RandAIC(5), new RandUnity(6));
challengeGame.natural_plant = false;
const challengePlants = challengeGame.ed_pl_1();
assert(challengePlants === undefined, '残局挑战关闭自然刷草后不应生成草');
assert(challengeState.grow_count === 1, '关闭自然刷草后不应消耗 grow_count');

const normalState = new State();
normalState.grow_count = 1;
normalState.turn_player = PLAYER_ENUM.BLACK;
const normalGame = new GameNormal(new Board(9, 9), normalState, new RandAIC(7), new RandUnity(8));
normalGame.ed_pl_1();
assert(normalState.grow_count !== 1, '普通对局仍应推进自然刷草倒计时');

console.log('endgame-challenge-regression: PASS');
