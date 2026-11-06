/*
 * 剧情 AI 与防误触回归测试：
 * 1. 剧情使用纯 4zero MCTS（SIM=150），不调用残局战术链路；
 * 2. 剧情列表页提供 0/1/2 三档防误触设置，默认 2，并与播放页共享本机设置；
 * 3. 剧情播放页按等级执行双击确认，等级 1 仅保护会发动「打」的落子。
 * 运行： bun tmp/story-click-sim.test.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const ok = (name, condition) => { assert.ok(condition, name); console.log(`ok - ${name}`); };

// 1) Worker：新增 STORY_THINK，且其中不出现残局战术矫正调用
{
    const worker = read('js/worker/ai.cjs');
    const start = worker.indexOf('async STORY_THINK');
    assert.ok(start >= 0, 'worker 应提供 STORY_THINK');
    const block = worker.slice(start, worker.indexOf('async REPLAY_EVAL'));
    ok('剧情思考默认 150 次模拟', block.includes('simulations = 150') && block.includes('clampInteger(simulations, 150'));
    ok('剧情思考不叠加残局矫正', !block.includes('endgameTactics') && !block.includes('correctMove'));
    ok('剧情思考使用 zero 模型', block.includes("ensureInitialized('zero')"));
    ok('发布 worker 与源码一致', read('js/worker/ai.cjs') === read('root/js/worker/ai.min.js'));
}

// 2) 播放页：SIM=150 且调用 STORY_THINK，不再调用残局思考
{
    const page = read('html/docs/story-play.html');
    ok('播放页剧情 SIM 为 150', page.includes('const STORY_SIMULATIONS = 150;'));
    ok('播放页调用 STORY_THINK', page.includes('aiWorker.STORY_THINK(STORY_SIMULATIONS)'));
    ok('播放页不再使用残局思考', !page.includes('ENDGAME_THINK'));
    ok('播放页读取剧情防误触设置', page.includes("four-ascend-story-settings-v1"));
    ok('播放页默认等级为 2', page.includes('return 2;'));
    ok('等级 2 全部双击确认', page.includes('const needConfirm = clickLevel === 2 || isAttack;'));
    ok('等级 1 只保护「打」', page.includes('clickLevel === 1 && game && game.board')
        && page.includes('game.board.get_ascend(x, y, fromPlayer())'));
    ok('双击同一位置才落子', page.includes('pendingConfirm[0] === x && pendingConfirm[1] === y'));
    ok('待确认落点有紫色校验标记', page.includes("ui.draw_stone_validate(x, y, '#BF00FF')"));
    ok('落子后清理待确认', page.includes('const clearPendingConfirm = () =>') && page.includes('clearPendingConfirm();'));
}

// 3) 列表页：设置项与关卡列表并列，默认 2，可切换并持久化
{
    const page = read('html/docs/story.html');
    ok('设置与关卡列表并列', page.includes("col-12 col-lg-8") && page.includes("col-12 col-lg-4") && page.includes("剧情设置"));
    ok('提供 0/1/2 三档', page.includes("data-level='0'") && page.includes("data-level='1'") && page.includes("data-level='2'"));
    ok('设置默认 2', page.includes('const STORY_CLICK_DEFAULT = 2;'));
    ok('保存到本机设置', page.includes('localStorage.setItem(STORY_SETTINGS_KEY'));
    ok('与播放页共用设置键', page.includes("four-ascend-story-settings-v1"));
}

// 4) 残局码 AI 预设：剧情对局必须优先按作者预设落子，而不是直接交给 MCTS
{
    const page = read('html/docs/story-play.html');
    ok('播放页读取残局码 AI 预设', page.includes('archiveData.ai_preset') && page.includes('create_ai_preset'));
    ok('AI 预设优先于 MCTS', page.includes('if (aiPreset && aiPreset.active())')
        && page.indexOf('if (aiPreset && aiPreset.active())') < page.indexOf('move = await aiThink();'));
    ok('玩家执黑时白方按残局预案应手', page.includes('response.white_move && legal(response.white_move[0], response.white_move[1])'));
    ok('AI 执黑时按黑方正着预设落子', page.includes('selfPlayer === PLAYER_ENUM.WHITE ? makePreset(archiveData.black_book)'));
}

// 5) 发布产物已同步
{
    const play = read('root/pages/docs/story-play.html');
    const list = read('root/pages/docs/story.html');
    ok('发布播放页含 STORY_THINK', play.includes('STORY_THINK') && play.includes('four-ascend-story-settings-v1'));
    ok('发布播放页含残局码 AI 预设', play.includes('create_ai_preset') && play.includes('ai_preset'));
    ok('发布列表页含防误触设置', list.includes('story-click-option') && list.includes('four-ascend-story-settings-v1'));
}

// 6) 删除胜负结算浮层；仅当 结束对局=步数:0 时点击屏幕结束本局
{
    const page = read('html/docs/story-play.html');
    ok('播放页已移除胜负结算浮层', !page.includes('result_overlay') && !page.includes('result-overlay'));
    ok('对话仍在对话框内点击推进', page.includes("dialoguePanel.addEventListener('click', advanceDialogue)")
        && page.includes('点击继续 ▼'));
    ok('仅步数:0 判定为点击结束', page.includes('let endByClick = false;')
        && page.includes("endByClick = config.end_kind === 'steps' && endLimit === 0;"));
    ok('点击屏幕结束本局', page.includes("if (mode !== 'game' || gameOver || !endByClick) return;")
        && page.includes("if (endByClick) { clearPendingConfirm(); concludeGame(null); return; }"));
    ok('步数:0 不允许落子、不跑 AI', page.includes('if (endByClick) return;')
        && page.includes("if (endByClick) { setStatus('点击屏幕结束本局。', 'primary'); return; }"));
    ok('对局结束直接回到剧情，无结算等待', !page.includes('await sleep(1500)') && page.includes('runtime.finish_game(outcome);'));
    ok('解析层允许 0 步', read('js/global/story.cjs').includes("'end_steps': endSteps ? Math.max(0, Number(endSteps[1])) : 0,"));
    const list = read('html/docs/story.html');
    ok('编辑器允许 0 步', list.includes("min='0' max='999'") && list.includes('Math.max(0, Number(match[1]))') && list.includes('步数:0'));
    const published = read('root/pages/docs/story-play.html');
    ok('发布播放页同步移除结算浮层并含点击结束', !published.includes('result_overlay') && published.includes('点击屏幕结束本局'));
}

// 7) 对话框点击外部临时收起，再次点击从底部弹出（不打断剧情节点与打字进度）
{
    const page = read('html/docs/story-play.html');
    ok('对话框具备临时收起与底部滑出动效', page.includes('.dialogue-panel.is-hidden, .dialogue-panel.is-collapsed')
        && page.includes('.dialogue-panel.is-popping'));
    ok('点击外部收起、再次点击弹出', page.includes('const setDialogueCollapsed = (collapsed) =>')
        && page.includes('setDialogueCollapsed(true)') && page.includes('setDialogueCollapsed(false)'));
    ok('对话框内点击仍推进剧情', page.includes("if (target.closest('#dialogue')) return;"));
    ok('仅剧情推进阶段响应收起', page.includes("if (!dialogueActive || mode !== 'dialogue') return;"));
    ok('剧情推进时棋盘不拦截点击', page.includes('.story-board-wrap.is-dialogue #canvas_board { pointer-events: none; }'));
    ok('适配减弱动态效果偏好', page.includes('.dialogue-panel, .dialogue-dim { transition: none; }'));
    const published = read('root/pages/docs/story-play.html');
    ok('发布播放页同步收起/弹出样式', published.includes('is-collapsed') && published.includes('is-popping'));
}

console.log('all story click/sim checks passed');
