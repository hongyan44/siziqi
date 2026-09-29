/*
 * 稳健读盘：圆盘采样 + 覆盖率判定。
 * 用法： node tmp/read-board.cjs <png> <X1> <X9> <Y1> <Y9> [discR]
 *   X1/X9 = display 列 1/9 的像素 x；Y1/Y9 = display 行 1/9 的像素 y（行 1 在最下）
 * 输出 display 坐标（左下角 = 1,1，先横后竖）。
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
const [X1, X9, Y1, Y9] = process.argv.slice(3, 7).map(Number);
const discR = Number(process.argv[7]) || 0;
const sx = (X9 - X1) / 8, sy = (Y1 - Y9) / 8;
const R = discR || Math.round(Math.min(sx, sy) * 0.34);

const px = (x, y) => {
    if (x < 0 || y < 0 || x >= img.w || y >= img.h) return [255, 255, 255];
    const i = (y * img.w + x) * img.channels;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

console.log(`图像 ${img.w}x${img.h}  列间距 ${sx.toFixed(1)} 行间距 ${sy.toFixed(1)}  采样半径 ${R}`);

const probe = (cx, cy) => {
    let n = 0, dark = 0, sr = 0, sg = 0, sb = 0, minL = 999, maxL = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R * R) continue;
        const c = px(Math.round(cx + dx), Math.round(cy + dy));
        const l = lum(c);
        n++; sr += c[0]; sg += c[1]; sb += c[2];
        if (l < 245) dark++;
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
    }
    const avg = [sr / n, sg / n, sb / n];
    return { cover: dark / n, avg, avgL: lum(avg), minL, maxL };
};

const grid = [];
const detail = [];
for (let j = 9; j >= 1; j--) {
    const line = [];
    for (let i = 1; i <= 9; i++) {
        const cx = X1 + sx * (i - 1), cy = Y1 - sy * (j - 1);
        const p = probe(cx, cy);
        let kind = '.';
        if (p.cover > 0.72) {
            if (p.avg[2] - p.avg[0] > 30) kind = 'A';
            else if (p.avgL > 200) kind = 'W';
            else kind = 'B';
        }
        line.push(kind);
        detail.push({ x: i, y: j, kind, cover: +p.cover.toFixed(2), avgL: Math.round(p.avgL), rgb: p.avg.map((v) => Math.round(v)).join(',') });
    }
    grid.push(line);
}
console.log('    1  2  3  4  5  6  7  8  9   x');
grid.forEach((line, idx) => console.log(String(9 - idx).padStart(3) + '  ' + line.join('   ') + '   y'));

const black = [], white = [];
for (const d of detail) {
    if (d.kind === 'B') black.push([d.x, d.y]);
    if (d.kind === 'W' || d.kind === 'A') white.push([d.x, d.y]);
}
const srt = (a) => a.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
console.log('\n黑(display):', JSON.stringify(srt(black)));
console.log('白(display，含升变):', JSON.stringify(srt(white)));
console.log('\n明细 cover>=0.4：');
detail.filter((d) => d.cover >= 0.4).forEach((d) => console.log(`  (${d.x},${d.y}) ${d.kind} cover=${d.cover} avgL=${d.avgL} rgb=${d.rgb}`));
