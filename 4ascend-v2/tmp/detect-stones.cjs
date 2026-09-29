/*
 * 通过连通域检测残局截图中的棋子圆，输出 display 坐标。
 * 运行： node tmp/detect-stones.cjs <png路径> <x1> <x9> <y1> <y9>
 *   x1/x9 = display 列 1/9 的像素 x；y1/y9 = display 行 1/9 的像素 y。
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
const px = (x, y) => { const i = (y * img.w + x) * img.channels; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

const mask = new Uint8Array(img.w * img.h);
for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) mask[y * img.w + x] = lum(px(x, y)) < 200 ? 1 : 0;

const seen = new Uint8Array(img.w * img.h);
const comps = [];
for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const s = y * img.w + x;
    if (!mask[s] || seen[s]) continue;
    const stack = [s]; seen[s] = 1;
    const pts = [];
    let sx = 0, sy = 0, sr = 0, sg = 0, sb = 0, dark = 0;
    while (stack.length) {
        const p = stack.pop();
        const py = Math.floor(p / img.w), pxx = p % img.w;
        pts.push(p); sx += pxx; sy += py;
        const c = px(pxx, py); sr += c[0]; sg += c[1]; sb += c[2];
        if (lum(c) < 100) dark++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = pxx + dx, ny = py + dy;
            if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h) continue;
            const ns = ny * img.w + nx;
            if (mask[ns] && !seen[ns]) { seen[ns] = 1; stack.push(ns); }
        }
    }
    if (pts.length < 1200) continue;
    const n = pts.length;
    comps.push({
        n, cx: sx / n, cy: sy / n,
        rgb: [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)],
        darkRatio: +(dark / n).toFixed(2),
    });
}

const sx = (X9 - X1) / 8, sy = (Y1 - Y9) / 8;
const toCol = (cx) => Math.round((cx - X1) / sx) + 1;
const toRow = (cy) => Math.round((Y1 - cy) / sy) + 1;

console.log(`检测到 ${comps.length} 个候选连通域（面积>=1200）`);
const black = [], white = [], other = [];
for (const c of comps) {
    const col = toCol(c.cx), row = toRow(c.cy);
    const kind = c.darkRatio > 0.6 ? 'B' : (c.rgb[2] - c.rgb[0] > 30 ? 'A' : 'W');
    const rec = [col, row];
    if (col < 1 || col > 9 || row < 1 || row > 9) { other.push({ ...c, col, row, kind }); continue; }
    if (kind === 'B') black.push(rec); else white.push(rec);
    console.log(`  (${col},${row}) ${kind}  area=${c.n} rgb=${c.rgb.join(',')} dark=${c.darkRatio} centroid=(${Math.round(c.cx)},${Math.round(c.cy)})`);
}
const uniq = (a) => { const m = new Map(); for (const [x, y] of a) m.set(`${x},${y}`, [x, y]); return [...m.values()].sort((p, q) => p[1] - q[1] || p[0] - q[0]); };
console.log('\n黑:', JSON.stringify(uniq(black)));
console.log('白:', JSON.stringify(uniq(white)));
if (other.length) console.log('越界/其他:', JSON.stringify(other.map((o) => [o.col, o.row, o.kind, o.n])));
