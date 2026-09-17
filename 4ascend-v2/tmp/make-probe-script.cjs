/**
 * Browser probe: step through every replay frame and summarise the turn-marker
 * layer (canvas_view_turn). Plant-refresh frames must still contain a marker.
 */
const fs = require('node:fs');
const path = require('node:path');

const script = String.raw`
(async () => {
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const turnCanvas = document.getElementById('canvas_view_turn');
    const boardCanvas = document.getElementById('canvas_board');
    const dpr = window.devicePixelRatio || 1;
    const size = boardCanvas.width / dpr;
    const pad = 0.062;
    const spacing = (size - size * pad * 2) / 8;
    const offset = size * pad;

    const summary = () => {
        const ctx = turnCanvas.getContext('2d');
        const { width, height } = turnCanvas;
        const data = ctx.getImageData(0, 0, width, height).data;
        let count = 0;
        let sx = 0;
        let sy = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (data[(y * width + x) * 4 + 3] > 0) { count++; sx += x; sy += y; }
            }
        }
        if (!count) return { count: 0, gx: null, gy: null };
        const px = sx / count / dpr;
        const py = sy / count / dpr;
        return {
            count,
            gx: Math.round(((px - offset) / spacing) * 100) / 100,
            gy: Math.round(((py - offset) / spacing) * 100) / 100
        };
    };

    const frames = [];
    const next = document.getElementById('button_history_next');
    const maxSteps = 120;

    for (let step = 0; step < maxSteps; step++) {
        next.click();
        await wait(30);
        const title = document.getElementById('game_msg').innerText;
        const turnText = document.getElementById('game_info_turn').innerText;
        const view = summary();
        frames.push({
            step,
            title,
            turnText,
            markerPixels: view.count,
            markerAt: view.gx === null ? null : [view.gx, view.gy]
        });
        if (document.getElementById('button_history_next').disabled) break;
    }

    return JSON.stringify({ size, spacing, offset, frames });
})();
`;

fs.writeFileSync(path.join(__dirname, 'probe-frames.b64'), Buffer.from(script, 'utf8').toString('base64'), 'utf8');
console.log('probe-frames.b64 written');
