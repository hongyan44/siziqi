/*
 * 残局描述（description）链路回归：
 * - 投稿编辑器可填写最多 50 字的描述，并随待审投稿一起提交
 * - 审核卡片可修改描述，保存/通过时传给 submission_update
 * - 关卡编辑器可新增/修改描述，准备页面展示描述（为空时隐藏）
 * - 每日挑战编辑器可新增/修改描述，准备弹窗展示描述
 * - http.cjs 各接口把 description 传给服务端
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const checks = [];
const assert = (name, ok) => {
    checks.push({ name, ok: Boolean(ok) });
    if (!ok) throw new Error(`FAILED: ${name}`);
};

const submit = read('html/endgame/submit.html');
assert('投稿页提供描述输入（maxlength=50）', /id='submit_description'[^>]*maxlength='50'/.test(submit));
assert('投稿页校验描述最多 50 字', /Array\.from\(description\)\.length > 50/.test(submit));
assert('待审投稿携带 description', /writePendingSubmission\(\{ target, level, title, description, code/.test(submit));
assert('审核卡片提供描述输入', /description\.label = '残局描述（可选）'/.test(submit));
assert('审核保存/通过传 description', /http_puzzle_submission_update\(token, item\.id, data\.target, data\.level, data\.title, data\.description, data\.code\)/.test(submit));

const challenge = read('html/endgame/challenge.html');
assert('对局验证投稿时携带 description', /http_puzzle_submit\(token, pending\.target, Number\(pending\.level\) \|\| 0, pending\.title, String\(pending\.description \|\| ''\), pending\.code\)/.test(challenge));

const levels = read('html/endgame/levels.html');
assert('关卡编辑提供描述输入（maxlength=50）', /id='input_description'[^>]*maxlength='50'/.test(levels));
assert('关卡编辑校验描述最多 50 字', /Array\.from\(description\)\.length > 50/.test(levels));
assert('关卡新增/更新传 description', /http_puzzle_update\(window\.get_token\(\), editingId, level, title, description, code\)/.test(levels) && /http_puzzle_add\(window\.get_token\(\), level, title, description, code\)/.test(levels));
assert('准备页面展示残局描述', /dialog_level_desc_wrap/.test(levels) && /record\.description/.test(levels));
assert('描述为空时隐藏区块', /classList\.toggle\('d-none', !description\)/.test(levels));

const index = read('html/endgame/index.html');
assert('每日挑战编辑提供描述输入（maxlength=50）', /id='input_daily_description'[^>]*maxlength='50'/.test(index));
assert('每日发布传 description 并校验', /http_puzzle_daily_update\(window\.get_token\(\), code, title, description\)/.test(index) && /String\(uploaded\.description \|\| ''\) !== description/.test(index));
assert('每日挑战准备弹窗展示描述', /challenge_daily_description/.test(index) && /dailyChallenge\.description/.test(index));
assert('每日挑战具备独立预备进入页', /id='dialog_daily_prep'/.test(index));
assert('选中每日挑战时拉出预备进入页', /dailyButton\.addEventListener\('click', openDailyPrep\)/.test(index));
assert('预备进入页展示描述 / 血量 / 盘面预览', /daily_prep_desc/.test(index) && /daily_prep_black_hp/.test(index) && /daily_prep_board/.test(index));
assert('预备进入页开始挑战进入每日模式', /challenge\.html\?mode=daily/.test(index));

const http = read('js/ref/http.cjs');
assert('add 接口带 description', /http_puzzle_add = async \(token, level, title, description, code\)/.test(http));
assert('update 接口带 description', /http_puzzle_update = async \(token, id, level, title, description, code\)/.test(http));
assert('submit 接口带 description', /http_puzzle_submit = async \(token, target, level, title, description, code\)/.test(http));
assert('submission_update 接口带 description', /http_puzzle_submission_update = async \(token, id, target, level, title, description, code\)/.test(http));
assert('daily_update 接口带 description', /http_puzzle_daily_update = async \(token, code, title = '每日挑战', description = ''\)/.test(http));

console.log(`DESCRIPTION_LINK_OK (${checks.length} checks)`);
