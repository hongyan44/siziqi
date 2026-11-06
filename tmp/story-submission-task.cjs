/*
 * 静态回归：剧情投稿权限 + 等级 2+ 每日任务
 * 运行：node tmp/story-submission-task.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const assert = (ok, message) => { if (!ok) throw new Error(message); };

const task = read('4ascend-online/src/manager/Task.cpp');
assert(/STORY_DEF\s*=\s*\{"t1",\s*"story".*700,\s*700\}/.test(task), '剧情投稿任务应为 t1/story，奖励 700 棋币 + 700 经验');
assert(/bool story_accessible\(/.test(task) && /level\s*>=\s*2/.test(task), '剧情任务需按权限等级 ≥ 2 判定可见');
assert(/filter_story\(uuid, records\)/.test(task), '读取任务时必须过滤低等级账号的剧情任务');
assert(/name == "story_submit"/.test(task) && /"t1"/.test(task), 'story_submit 事件应推进 t1');
assert(/matched->kind == "story"[\s\S]{0,80}invalid_task/.test(task), '剧情投稿任务不可刷新');
assert(/story_accessible\(uuid\)[\s\S]{0,160}STORY_DEF/.test(task), '等级 ≥ 2 应自动补发剧情任务');

const manager = read('4ascend-online/src/manager/Story.cpp');
assert(/CREATE TABLE IF NOT EXISTS story_submission/.test(manager), '应创建 story_submission 表');
assert(/bool add_submission\(/.test(manager) && /bool set_submission_status\(/.test(manager), '应提供投稿写入与审核状态更新');

const http = read('4ascend-online/src/api/http/Story.cpp');
assert(/level\s*>=\s*2/.test(http) && /bool can_edit\(/.test(http), '等级 ≥ 2 才可使用编辑器接口');
assert(/action == "delete" \|\| action == "delete_expression"[\s\S]{0,80}level < 4/.test(http), '等级 2/3 禁止删除角色/表情');
assert(/submission_submit/.test(http) && /submission_query/.test(http) && /submission_review/.test(http), '应提供投稿提交/查询/审核接口');
assert(/level != 4[\s\S]{0,140}create_character_submission/.test(http), '等级 2/3 的角色操作应转为投稿');
assert(/json_dump\(payload\)/.test(http) && /apply_level_submission/.test(http), '投稿需可序列化并在审核通过后应用到剧本目录');
assert(/story_submit"/.test(http) && /Manager::Task::event/.test(http), '剧情投稿成功后应推进每日任务');

const story = read('4ascend-v2/html/docs/story.html');
assert(/const isEditor = \(\) => Boolean\(storyAdmin && Number\(storyAdmin\.level\) >= 2\)/.test(story), '剧情页应按等级 ≥ 2 开放编辑器');
assert(/if \(isEditor\(\)\)[\s\S]{0,240}textContent = '编辑'/.test(story), '等级 ≥ 2 显示编辑按钮');
assert(/if \(isAdmin\(\)\)[\s\S]{0,240}textContent = '删除'/.test(story), '只有等级 4 显示删除按钮');
assert(/http_story_submission_submit\(window\.get_token\(\), 'level'/.test(story), '等级 2/3 保存应提交投稿');
assert(/story_review_panel/.test(story) && /http_story_submission_review/.test(story), '等级 4 应有投稿审核面板');

const chars = read('4ascend-v2/html/docs/story-characters.html');
assert(/const isEditor = \(\) => Boolean\(admin && Number\(admin\.level\) >= 2\)/.test(chars), '角色管理器应按等级 ≥ 2 开放');
assert(/result\.submitted[\s\S]{0,80}已提交投稿/.test(chars), '等级 2/3 的角色操作应提示已提交投稿');
assert(/isAdmin\(\) \? .*delete-char/.test(chars) && /delete-expression/.test(chars) && /if \(!isAdmin\(\)\) return/.test(chars), '等级 2/3 不得删除角色或表情');

const index = read('4ascend-v2/js/main/index.cjs');
assert(/kind !== 'story'/.test(index), '剧情投稿任务不应提供刷新按钮');
assert(/['"]story['"],\s*['"]剧情投稿任务['"]/.test(index), '任务面板应展示剧情投稿分组');

console.log('story-submission-task: PASS');
