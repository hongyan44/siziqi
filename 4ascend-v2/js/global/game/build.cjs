/*
 * @Author: CsVeryLoveXieWenLi
 * @Description: 浏览器导出
 * @Copyright (c) 2026 by CsVeryLoveXieWenLi, All Rights Reserved.
 */
const { Canvas } = require('./canvas.cjs');
const { Client } = require('./client.cjs');
const { Message } = require('./message.cjs');
const { Timer } = require('./timer.cjs');
const { Sound } = require('./sound.cjs');
const { Effect } = require('./effect.cjs');
const { AscendFx } = require('./ascendfx.cjs');
const { Skins } = require('./skin.cjs');
const { MusicPlaylist } = require('../../ref/music.cjs');
// const { Seed } = require('./seed.cjs');


window.GameExports = { Canvas, Client, Message, Timer, Sound, Effect, AscendFx, Skins };