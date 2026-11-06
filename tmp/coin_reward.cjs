// 棋币奖励回归测试（与服务端 Replay.cpp:coin_base 保持一致）
// 用法：bun coin_reward.cjs
// 规则：<1 分钟 0；1-5 分钟 1-7；5-10 分钟 8-10；10-15 分钟 11-14；>=15 分钟 15
// 败方拿基准，胜方翻倍，和棋双方按基准。

/**
 * @description: 对局时长 -> 棋币基准奖励
 * @param {number} seconds
 * @return {number}
 */
const coin_base = (seconds) => {
    if (seconds < 60) return 0;
    if (seconds < 300) return 1 + Math.trunc((seconds - 60) * 6 / 239);
    if (seconds < 600) return 8 + Math.trunc((seconds - 300) * 2 / 299);
    if (seconds < 900) return 11 + Math.trunc((seconds - 600) * 3 / 299);
    return 15;
};

/**
 * @description: 结算双方棋币
 * @param {number} seconds
 * @param {'A'|'B'|'none'} result A=黑胜 B=白胜 其他=和棋
 * @return {{black: number, white: number}}
 */
const settle = (seconds, result) => {
    const base = coin_base(seconds);
    const draw = result !== 'A' && result !== 'B';
    return {
        black: draw || result === 'A' ? (draw ? base : base * 2) : base,
        white: draw || result === 'B' ? (draw ? base : base * 2) : base,
    };
};

let failed = 0;

/**
 * @description: 断言
 * @param {string} label
 * @param {*} actual
 * @param {*} expect
 * @return {void}
 */
const eq = (label, actual, expect) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expect);
    if (!ok) failed += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` != ${JSON.stringify(expect)}`}`);
};

// 时长边界
eq('0s', coin_base(0), 0);
eq('59s', coin_base(59), 0);
eq('60s', coin_base(60), 1);
eq('299s', coin_base(299), 7);
eq('300s', coin_base(300), 8);
eq('599s', coin_base(599), 10);
eq('600s', coin_base(600), 11);
eq('899s', coin_base(899), 14);
eq('900s', coin_base(900), 15);
eq('3600s', coin_base(3600), 15);

// 区间内单调不减
let monotonic = true;
let prev = -1;
for (let s = 0; s <= 1200; s += 1) {
    const value = coin_base(s);
    if (value < prev) monotonic = false;
    prev = value;
}
eq('0-1200s 单调不减', monotonic, true);

// 胜负结算
eq('300s 黑胜', settle(300, 'A'), { black: 16, white: 8 });
eq('300s 白胜', settle(300, 'B'), { black: 8, white: 16 });
eq('300s 和棋', settle(300, 'none'), { black: 8, white: 8 });
eq('900s 黑胜', settle(900, 'A'), { black: 30, white: 15 });
eq('30s 白胜', settle(30, 'B'), { black: 0, white: 0 });

if (failed) {
    console.error(`\n${failed} 项失败`);
    process.exit(1);
}
console.log('\n全部通过');
