/*
 * 对残局截图做像素级判定（按圆环判定是否有子，再按中心亮度区分黑白）。
 * 运行： node tmp/px-analyze.cjs <png路径> [x0 x1 y0 y1]
 */
const fs = require('node:fs');
const zlib = require('node:zlib');

function decodePng(file) {
    const buf = fs.readFileSync(file);
    let off = 8;
    let w = 0, h = 0, bitDepth = 0, colorType = 0;
    const idat = [];
    while (off < buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') {
            w = data.readUInt32BE(0); h = data.readUInt32BE(4);
            bitDepth = data[8]; colorType = data[9];
        } else if (type === 'IDAT') idat.push(data);
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
const px = (x, y) => {
    if (x < 0 || y < 0 || x >= img.w || y >= img.h) return [255, 255, 255];
    const i = (y * img.w + x) * img.channels;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

let [x0, x1, y0, y1] = process.argv.slice(3, 7).map(Number);
if (!Number.isFinite(x0)) {
    const isLine = ([r, g, b]) => {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        return (mx - mn) < 12 && l > 185 && l < 248;
    };
    const colCount = new Array(img.w).fill(0);
    const rowCount = new Array(img.h).fill(0);
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
        if (isLine(px(x, y))) { colCount[x]++; rowCount[y]++; }
    }
    const top = (arr, n) => arr.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v).slice(0, n).sort((a, b) => a.i - b.i);
    console.log('列候选:', top(colCount, 30).map((o) => `${o.i}:${o.v}`).join(' '));
    console.log('行候选:', top(rowCount, 30).map((o) => `${o.i}:${o.v}`).join(' '));
    process.exit(0);
}
const xs = Array.from({ length: 9 }, (_, i) => Math.round(x0 + (x1 - x0) * i / 8));
const ys = Array.from({ length: 9 }, (_, i) => Math.round(y0 + (y1 - y0) * i / 8));

// 估计棋子半径：相邻交叉点间距的 0.36
const spacing = (x1 - x0) / 8;
const rStone = spacing * 0.38;

function probe(cx, cy) {
    // 在半径 28..33 处采样（避开中心的小绿点），取平均色与最大亮度
    let sr = 0, sg = 0, sb = 0, n = 0, maxL = 0, minL = 999;
    for (let k = 0; k < 48; k++) {
        const th = (k / 48) * Math.PI * 2;
        for (const m of [28, 30, 33]) {
            const c = px(Math.round(cx + Math.cos(th) * m), Math.round(cy + Math.sin(th) * m));
            sr += c[0]; sg += c[1]; sb += c[2]; n++;
            const l = lum(c);
            if (l > maxL) maxL = l;
            if (l < minL) minL = l;
        }
    }
    const avg = [sr / n, sg / n, sb / n];
    const avgL = lum(avg);
    let kind = '.';
    if (maxL < 250) {
        if (avgL > 225) kind = 'W';
        else if (avg[2] - avg[0] > 100) kind = 'A';        // 蓝＝白方升变子
        else kind = 'B';                                   // 深色＝黑子
    }
    return { kind, avgL: Math.round(avgL), maxL: Math.round(maxL), rgb: avg.map((v) => Math.round(v)) };
}

console.log(`采样网格 x=${xs.join(',')}  y=${ys.join(',')}  (y 行号 1=最下)`);
console.log('     ' + xs.map((_, i) => i + 1).join('   '));
const black = [], white = [];
for (let j = 9; j >= 1; j--) {
    let line = String(j).padStart(3) + '  ';
    for (let i = 1; i <= 9; i++) {
        const p = probe(xs[i - 1], ys[j - 1]);
        line += p.kind + '   ';
        if (p.kind === 'B') black.push([i, j]);
        if (p.kind === 'W' || p.kind === 'A') white.push([i, j]);
    }
    console.log(line);
}
console.log('\n黑:', JSON.stringify(black));
console.log('白(含蓝色升变子):', JSON.stringify(white));
console.log('\n=== 明细（center / ringRatio，ring>=0.35 全列）===');
for (let j = 9; j >= 1; j--) for (let i = 1; i <= 9; i++) {
    const p = probe(xs[i - 1], ys[j - 1]);
    if (p.kind !== '.') console.log(`  (${i},${j}) ${p.kind}  avgL=${p.avgL} maxL=${p.maxL} rgb=${p.rgb.join(',')}`);
}
