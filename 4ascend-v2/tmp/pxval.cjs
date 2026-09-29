/*
 * 打印指定像素颜色（用于标定白子颜色）。
 * 运行： node tmp/pxval.cjs <png> x1,y1 x2,y2 ...
 */
const fs = require('node:fs');
const zlib = require('node:zlib');
function decodePng(file) {
    const buf = fs.readFileSync(file);
    let off = 8, w = 0, h = 0, colorType = 0; const idat = [];
    while (off < buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); colorType = data[9]; }
        else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
        off += 12 + len;
    }
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = w * channels; const out = Buffer.alloc(h * stride); let pos = 0;
    for (let y = 0; y < h; y++) {
        const filter = raw[pos++]; const line = raw.subarray(pos, pos + stride); pos += stride;
        const cur = out.subarray(y * stride, (y + 1) * stride);
        const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? cur[i - channels] : 0;
            const b = prev ? prev[i] : 0;
            const c = (prev && i >= channels) ? prev[i - channels] : 0;
            let v = line[i];
            if (filter === 1) v += a; else if (filter === 2) v += b;
            else if (filter === 3) v += (a + b) >> 1;
            else if (filter === 4) { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
            cur[i] = v & 0xff;
        }
    }
    return { w, h, channels, data: out };
}
const img = decodePng(process.argv[2]);
const at = (x, y) => { const i = (y * img.w + x) * img.channels; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
for (const spec of process.argv.slice(3)) {
    const [x, y] = spec.split(',').map(Number);
    console.log(`(${x},${y}) = ${at(x, y).join(',')}`);
}
// 横向扫描一条线，输出亮度变化段
if (process.argv.includes('--scan')) {
    const i = process.argv.indexOf('--scan');
    const [x0, x1, yy] = process.argv.slice(i + 1, i + 4).map(Number);
    let prev = null, start = x0;
    for (let x = x0; x <= x1; x++) {
        const l = Math.round(0.299 * at(x, yy)[0] + 0.587 * at(x, yy)[1] + 0.114 * at(x, yy)[2]);
        const bucket = Math.round(l / 10) * 10;
        if (prev === null) { prev = bucket; start = x; }
        else if (bucket !== prev) { console.log(`  x ${start}..${x - 1} lum≈${prev}`); prev = bucket; start = x; }
    }
    console.log(`  x ${start}..${x1} lum≈${prev}`);
}
