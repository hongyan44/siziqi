// 观战存档复原回归：对局双方用「回放码」继续中断的对局时，观战方不能把先后手重置回先手方，
// 否则后续每一手都会按相反的颜色渲染，出现观战黑白颠倒。
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const view = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'view.cjs'), 'utf8');
const online = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'online.cjs'), 'utf8');

// 1) 观战只在「非存档分支」和「存档回放前」各设置一次 turn_player
const matches = view.match(/state\.turn_player = first_color;/g) || [];
assert.strictEqual(matches.length, 2, 'view.cjs 不应在存档回放结束后再重置 turn_player');

// 2) 存档回放之后到信息展示之间不得出现重置
const archive_index = view.indexOf('await game_archive();');
assert.ok(archive_index > 0, 'view.cjs 应包含存档复原逻辑');
const info_index = view.indexOf('game_msg.innerText = `${my_icon}|${my_name}|是${my_label}`', archive_index);
assert.ok(info_index > archive_index, '应能定位存档回放后的代码段');
const tail = view.slice(archive_index, info_index);
assert.ok(!/state\.turn_player\s*=\s*first_color/.test(tail), '存档回放后不得重置 turn_player，否则观战黑白颠倒');

// 3) 对局双方（online.cjs）同样不在回放后重置，保证观战与玩家落子颜色一致
assert.ok(!/await game_archive\(\);[\s\S]{0,400}?state\.turn_player = first_color;/.test(online), 'online.cjs 不应在存档回放后重置 turn_player');
assert.ok(/await game_archive\(\);/.test(online), 'online.cjs 应包含存档复原逻辑');

console.log('PASS: 观战存档复原不再重置先后手（黑白不再颠倒）');
