/*
 * 打印残局截图的网格线候选（按列/行统计"浅灰"像素数）。
 * 运行： node tmp/scan-grid.cjs <png路径>
 */
const fs = require('node:fs');
const zlib = require('node:zlib');

function decodePng(file) {
    const buf = fs.readFileSync(file);
    let off = 8, w = 0, h = 0, colorType = 0;
    const idat = [];
    while (off < buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); colorType = data[9]; }
        else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        off += 12 + len;
    }
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = w * channels;
    const out = Buffer.alloc(h * stride);
    let pos = 0;
    for (let y = 0; y < h; y++) {
        const filter = raw[pos++];
        const line = raw.subarray(pos, pos + stride); pos += stride;
        const cur = out.subarray(y * stride, (y + 1) * stride);
        const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? cur[i - channels] : 0;
            const b = prev ? prev[i] : 0;
            const c = (prev && i >= channels) ? prev[i - channels] : 0;
            let v = line[i];
            if (filter === 1) v += a;
            else if (filter === 2) v += b;
            else if (filter === 3) v += (a + b) >> 1;
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
            }
            cur[i] = v & 0xff;
        }
    }
    return { w, h, channels, data: out };
}

const img = decodePng(process.argv[2]);
const at = (x, y) => { const i = (y * img.w + x) * img.channels; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
const grayish = ([r, g, b]) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    return (mx - mn) < 22 && l < 250 && l > 120;
};
console.log(`尺寸 ${img.w}x${img.h}`);
const colCount = new Array(img.w).fill(0);
const rowCount = new Array(img.h).fill(0);
for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (grayish(at(x, y))) { colCount[x]++; rowCount[y]++; }
const run = (arr, thr) => {
    const hits = [];
    for (let i = 0; i < arr.length; i++) if (arr[i] >= thr) hits.push([i, arr[i]]);
    // 合并连续区间，取区间内最大值位置
    const groups = [];
    let cur = null;
    for (const [i, v] of hits) {
        if (cur && i - cur.end <= 4) { cur.end = i; if (v > cur.max) { cur.max = v; cur.pos = i; } }
        else { if (cur) groups.push(cur); cur = { start: i, end: i, max: v, pos: i }; }
    }
    if (cur) groups.push(cur);
    return groups.map((g) => `${g.pos}(${g.max})`).join(' ');
};
const thrC = img.h * 0.35, thrR = img.w * 0.35;
console.log('列(竖线):', run(colCount, thrC));
console.log('行(横线):', run(rowCount, thrR));
