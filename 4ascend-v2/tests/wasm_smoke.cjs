const assert = require('node:assert/strict');
const path = require('node:path');
const create = require(path.resolve(process.argv[2] || 'root/wasm/ai/4ascend-zero.js'));
(async () => {
    const wasm = await create({ print: () => {} });
    for (const night of [false, true]) {
        const ai = new wasm.AI_ZERO(1, 100, 0, 6, true);
        ai.set_overload(night);
        for (let i = 0; i < 12; ++i) {
            const move = ai.think(16);
            assert(Number.isInteger(move) && move >= 0 && move < 81);
        }
        const rate = ai.winrate(8);
        assert(Number.isFinite(rate) && rate >= 0 && rate <= 1);
        ai.delete();
    }
    console.log('PASS: WASM loads the embedded model; 24 AI moves and finite winrates.');
})().catch(error => { console.error(error); process.exitCode = 1; });
