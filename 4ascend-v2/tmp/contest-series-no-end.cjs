/*
 * 赛事系列赛「结束限制」移除回归。
 * 运行：node tmp/contest-series-no-end.cjs
 *
 * 需求：完全取消系列赛结束的限制——
 *   1) 系列赛达目标胜局后仍可继续开新对局（前端不再拦截开局）；
 *   2) 达目标后的对局仍会上报并计入小分（前端与后端均不再拦截上报）；
 *   3) 对局界面不再显示“系列赛已结束 / 不再接受新对局”等限制文案。
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const match_path = path.join(root, 'js', 'main', 'match-game.cjs');
const match_built = path.join(root, 'root', 'js', 'main', 'match-game.min.js');
const contest_path = path.join(root, '..', '4ascend-online', 'src', 'api', 'http', 'Contest.cpp');

let failed = 0;
const ok = (name, condition, extra = '') => {
    if (condition) { console.log(`  PASS  ${name}`); return; }
    failed += 1;
    console.log(`  FAIL  ${name}${extra ? ` -> ${extra}` : ''}`);
};

const match_src = fs.readFileSync(match_path, 'utf8');
const match_built_src = fs.existsSync(match_built) ? fs.readFileSync(match_built, 'utf8') : '';
const contest_src = fs.existsSync(contest_path) ? fs.readFileSync(contest_path, 'utf8') : '';

console.log('\n[1] 前端：不再因系列赛结束拦截开局');
ok('开局处理器不再拦截已完赛', !/contest_ctx\.completed[\s\S]{0,60}不能再次开局/.test(match_src));
ok('不再出现“不能再次开局”文案', !match_src.includes('不能再次开局'));
ok('不再出现“系列赛已结束”文案', !match_src.includes('系列赛已结束'));

console.log('\n[2] 前端：不再因系列赛结束拦截上报');
ok('handle_contest_end 无 completed 短路', !/if\s*\(\s*contest_ctx\.completed\s*\)\s*return;/.test(match_src));

console.log('\n[3] 前端：界面不再显示结束限制文案');
ok('对局条不再用 completed 分支渲染', !/round_text\s*=\s*contest_ctx\.completed/.test(match_src));
ok('渲染下一局为真实序号', /第 \$\{contest_ctx\.next_index\} 局/.test(match_src));

console.log('\n[4] 前端：上下文不再保留已无用的完成态字段');
ok('不再赋值 contest_ctx.completed', !/contest_ctx\.completed\s*=/.test(match_src));
ok('不再赋值 contest_ctx.winner_uuid', !/contest_ctx\.winner_uuid\s*=/.test(match_src));

console.log('\n[5] 后端：不再因系列赛结束拦截上报');
ok('无“系列赛已结束”上报拦截注释', !contest_src.includes('系列赛已结束：不再接受新对局上报'));
ok('无达标即 break 的上报拦截', !/json_i64\(wins, a_uuid, 0\) >= target \|\| json_i64\(wins, b_uuid, 0\) >= target/.test(contest_src));
ok('仍保留完成态计算（仅用于展示）', /const bool completed = wins_a >= target \|\| wins_b >= target;/.test(contest_src));

console.log('\n[6] 发布产物');
ok('match-game.min.js 存在', fs.existsSync(match_built));
ok('产物不含“不能再次开局”', !match_built_src.includes('不能再次开局'));
ok('产物不含“系列赛已结束”', !match_built_src.includes('系列赛已结束'));
ok('产物不早于源码（已重建）', fs.existsSync(match_built) && fs.statSync(match_built).mtimeMs >= fs.statSync(match_path).mtimeMs);
let syntax_ok = true, syntax_err = '';
try { new Function(match_built_src); } catch (error) { syntax_ok = false; syntax_err = error.message; }
ok('产物语法有效', syntax_ok, syntax_err);

console.log(failed === 0 ? '\ncontest-series-no-end: ALL PASS' : `\n失败 ${failed} 项`);
process.exit(failed === 0 ? 0 : 1);