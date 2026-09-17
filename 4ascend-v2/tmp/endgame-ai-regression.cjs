const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const challenge = fs.readFileSync(path.resolve(__dirname, '../html/endgame/challenge.html'), 'utf8');
const canvas = fs.readFileSync(path.resolve(__dirname, '../js/global/game/canvas.cjs'), 'utf8');

// 残局挑战的 ASCEND 动画必须在对局结束时停止，并在重试前清空。
assert.match(canvas, /clear_animations\(\)\s*\{/);
assert.match(canvas, /this\.effect\.clear\(\)/);
assert.match(canvas, /this\.ascendfx\.reset\(\)/);
assert.match(canvas, /this\.canvas_ascendfx\.getContext\('2d'\)\.clearRect/);
assert.match(challenge, /const clearChallengeAnimations = \(\) =>/);
assert.match(challenge, /ui\.clear_animations\(\)/);
assert.match(challenge, /clearChallengeAnimations\(\);[\s\S]*showResult\(win, challengeElapsed, reason\)/);
assert.match(challenge, /stopTimer\(\);[\s\S]*clearChallengeAnimations\(\);[\s\S]*setStatus\('正着全部完成/);
assert.match(challenge, /startTimer\(\);[\s\S]*clearChallengeAnimations\(\);/);

console.log('PASS: endgame challenge clears ASCEND and place animations on game end and retry.');
