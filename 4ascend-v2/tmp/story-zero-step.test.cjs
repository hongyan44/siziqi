// 检测步数=0 回归：进入对局后暂停并显示棋盘，只有点击棋盘才跳转；
// 结束上一段对话的那次点击不得被当成「继续」信号。
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'html', 'docs', 'story-play.html'), 'utf8');

// 1) 不应存在文档级的 0 步点击监听（否则任意一次点击都会触发跳转）
assert.ok(!/document\.addEventListener\('click', \(\) => \{\s*if \(!stepZeroReady/.test(source), '不应存在文档级的检测步数 0 点击监听');
assert.ok(!source.includes('无需落子，点击屏幕任意位置立即跳转'), '不应保留“点击屏幕任意位置立即跳转”的实现');

// 2) 棋盘指针按下仍是 0 步跳转入口
assert.ok(/if \(stepZeroReady && !running && hasPendingZeroStep\(\)\)/.test(source), '点击棋盘应触发 0 步跳转');
assert.ok(/runStepDetections\(0\)/.test(source), '0 步跳转应调用 runStepDetections(0)');

// 3) 对话框点击不冒泡到文档层，避免结束对话的点击被其它文档监听消费
assert.ok(/dialoguePanel\.addEventListener\('click', \(event\) => \{\s*event\.stopPropagation\(\);/.test(source), '对话框点击应阻止冒泡');

// 4) 暂停提示与回到棋盘后的回合提示恢复
assert.ok(source.includes('点击棋盘继续剧情。'), '应提示点击棋盘继续剧情');
assert.ok(/if \(!gameOver && state\) setStatus\(/.test(source), '回到棋盘后应恢复回合提示');

// 5) 「结束对局=步数:0」仍然让位给未触发的 0 步跳转
assert.ok(/if \(hasPendingZeroStep\(\)\) return;/.test(source), '结束对局点击应让位给 0 步跳转');

console.log('PASS: 检测步数 0 暂停与点击棋盘继续');
