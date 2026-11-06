/*
 * 回放分析接线回归：确认整场扫盘走 ZeroAI SIM=120、正着分析走 888 SIM 残局 AI。
 */
const fs = require('node:fs');
const path = require('node:path');

const BASE = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(BASE, name), 'utf8');

let failed = 0;
const check = (name, condition) => {
    if (condition) {
        console.log(`PASS: ${name}`);
        return;
    }
    failed++;
    console.error(`FAIL: ${name}`);
};

const worker = read('js/worker/ai.cjs');
const replay = read('js/core/replay.cjs');
const page = read('html/local/replay.html');
const bundle = read('root/js/core/replay.min.js');

check('worker 暴露 REPLAY_SWEEP', /REPLAY_SWEEP\s*\(\s*snapshot,\s*simulations\s*=\s*120/.test(worker));
check('worker 保留 REPLAY_EVAL 默认 888', /REPLAY_EVAL\s*\(\s*snapshot,\s*simulations\s*=\s*888/.test(worker));
check('REPLAY_SWEEP 不带残局战术', /REPLAY_SWEEP[^}]*replayEvaluate\([^)]*false\)/.test(worker));
check('REPLAY_EVAL 带残局战术', /REPLAY_EVAL[^}]*replayEvaluate\([^)]*true\)/.test(worker));
check('扫盘模拟数常量为 120', /SWEEP_SIMULATIONS\s*=\s*120/.test(replay));
check('正着模拟数常量为 888', /BEST_SIMULATIONS\s*=\s*888/.test(replay));
check('扫盘调用 REPLAY_SWEEP', /REPLAY_SWEEP\(info_snapshot\[job\.index\], SWEEP_SIMULATIONS/.test(replay));
check('正着调用 REPLAY_EVAL', /REPLAY_EVAL\(info_snapshot\[job\.index\], BEST_SIMULATIONS/.test(replay));
check('正着按钮绑定', /button_analysis_best\.addEventListener/.test(replay));
check('页面提供正着分析按钮', /id='button_analysis_best'/.test(page));
check('开启分析后记录分析模式', /analysis_mode = true/.test(replay));
check('着手徽标跟随分析模式而非面板显隐', /if \(!analysis_mode \|\| !view\)/.test(replay));
check('关闭面板后保留正着分析队列', /filter\(\(item\) => item\.type === 'best'\)/.test(replay));
check('窗口尺寸变化补绘当前帧', /gl_resize_redraw = \(\) =>/.test(replay) && /resize_redraw/.test(replay));
check('扫盘结果可作为推荐正着', /analysis_sweep_best_of/.test(replay));
check('正着分析优先于扫盘推荐', /analysis_ai_best_of\(index\) \|\| analysis_sweep_best_of\(index\)/.test(replay));
check('扫盘推荐使用浅绿圈', /#86EFAC/i.test(replay));
check('手动正着分析保留浅蓝圈', /#7DD3FC/i.test(replay));
check('命中推荐正着显示黄色五角星', /matched \? '★'/.test(replay) && /#FBBF24/i.test(replay));
check('推荐圈与五角星同时保留', /draw_analysis_ai_move\(ptr\)/.test(replay));
check('复制按钮标注当前盘面残局码', /复制当前盘面残局码/.test(page));
check('构建产物包含 REPLAY_SWEEP', /REPLAY_SWEEP/.test(bundle));
check('构建产物包含浅绿推荐圈', /86EFAC/i.test(bundle));
check('构建产物包含五角星标注', /★/.test(bundle));
check('构建产物保留浅蓝标注', /7DD3FC/i.test(bundle));

if (failed) {
    console.error(`\n${failed} 项失败`);
    process.exit(1);
}
console.log('\nALL PASS: replay-sweep-wiring');
