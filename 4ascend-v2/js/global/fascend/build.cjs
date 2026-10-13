/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 浏览器导出
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const { Board } = require('./board.cjs');
const { ArchiveV0 } = require('./archive.cjs');
const { OVER_ENUM, ASCEND_ENUM, PLANT_ENUM, PLAYER_ENUM, STONE_ENUM } = require('./enum.cjs');
const { Pos } = require('./pos.cjs');
const { RandAIC, RandUnity, RandOther } = require('./rand.cjs');
const { State } = require('./state.cjs');
const { ATK, AIC, CsharpSort } = require('./utils.cjs');

const { GameNormal } = require('./game_normal.cjs');
const { GameBlight } = require('./game_blight.cjs');
const { GameNight } = require('./game_night.cjs');
const { GameStory } = require('./game_story.cjs');
const { RulesRuntime } = require('./runtime.cjs');
const { EndgameTactics } = require('./endgame_tactics.cjs');
const { AiHandicap } = require('./ai_handicap.cjs');


globalThis.FAscendExports = { GameNormal, GameBlight, GameNight, GameStory, RulesRuntime, EndgameTactics, AiHandicap, Board, ArchiveV0, OVER_ENUM, ASCEND_ENUM, PLANT_ENUM, PLAYER_ENUM, STONE_ENUM, Pos, RandAIC, RandUnity, RandOther, State };
