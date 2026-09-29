/*
 * 自动标定：先解码 PNG，再扫描网格线（细灰线）定位 9 条竖线/横线，
 * 然后在交点处采样判定棋子。输出用户坐标（列,行），左下角=(1,1)，先横后竖。
 * 用法： node tmp/calib-grid.cjs <png>
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
const at = (x, y) => {
    const i = (y * img.w + x) * img.channels;
    return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;

// 网格线：细、灰、低饱和（不是纯白、不是棋子）
const isLine = (c) => {
    const [r, g, b] = c;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = lum(c);
    return (mx - mn) < 16 && l > 170 && l < 250;
};

const colScore = new Array(img.w).fill(0);
for (let x = 0; x < img.w; x++) {
    let n = 0;
    for (let y = 0; y < img.h; y++) if (isLine(at(x, y))) n++;
    colScore[x] = n;
}
const rowScore = new Array(img.h).fill(0);
for (let y = 0; y < img.h; y++) {
    let n = 0;
    for (let x = 0; x < img.w; x++) if (isLine(at(x, y))) n++;
    rowScore[y] = n;
}

// 找峰值（局部极大 + 高于阈值）
const peaks = (score, minFrac) => {
    const max = Math.max(...score);
    const th = max * minFrac;
    const out = [];
    for (let i = 1; i < score.length - 1; i++) {
        if (score[i] >= th && score[i] >= score[i - 1] && score[i] >= score[i + 1]) {
            if (out.length && i - out[out.length - 1] < 8) {
                if (score[i] > score[out[out.length - 1]]) out[out.length - 1] = i;
                continue;
            }
            out.push(i);
        }
    }
    return out;
};

const xs = peaks(colScore, 0.35);
const ys = peaks(rowScore, 0.35);
console.log(`图像 ${img.w}x${img.h}`);
console.log('竖线 x 候选:', xs.join(' '));
console.log('横线 y 候选:', ys.join(' '));

// 在候选中挑出“间距最均匀的 9 条”等差数列（排除外边框等杂峰）
const group9 = (arr) => {
    if (arr.length < 9) return null;
    let best = null;
    for (let i = 0; i < arr.length; i++) {
        for (let j = i + 8; j < arr.length; j++) {
            const step = (arr[j] - arr[i]) / 8;
            if (step < 20) continue;
            const pick = [];
            let ok = true;
            for (let k = 0; k < 9; k++) {
                const want = arr[i] + step * k;
                let hit = null, bd = step * 0.3;
                for (const v of arr) { const d = Math.abs(v - want); if (d < bd) { bd = d; hit = v; } }
                if (hit === null) { ok = false; break; }
                pick.push(hit);
            }
            if (!ok) continue;
            const score = (arr[j] - arr[i]) - step * 0; // 优先跨度大的等差数列
            if (!best || (arr[j] - arr[i]) > best.span) best = { pick, span: arr[j] - arr[i] };
        }
    }
    return best ? best.pick : null;
};

const gx = group9(xs);
const gy = group9(ys);
if (!gx || !gy) { console.log('未能定位 9 条网格线，请手工指定'); process.exit(1); }
console.log('采用竖线 x:', gx.join(' '));
console.log('采用横线 y:', gy.join(' '));
console.log('列间距', ((gx[8] - gx[0]) / 8).toFixed(1), '行间距', ((gy[8] - gy[0]) / 8).toFixed(1));

const R = Math.round(Math.min((gx[8] - gx[0]) / 8, (gy[8] - gy[0]) / 8) * 0.36);
console.log('采样半径', R, '\n');

// gy 从上到下；用户坐标行 1 在下 → 行 j 用 gy[9-j]（gy 升序）
const grid = [];
const detail = [];
for (let j = 9; j >= 1; j--) {
    const line = [];
    for (let i = 1; i <= 9; i++) {
        const cx = gx[i - 1], cy = gy[9 - j];
        let n = 0, sr = 0, sg = 0, sb = 0, dark = 0, minL = 999;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
            if (dx * dx + dy * dy > R * R) continue;
            const x = cx + dx, y = cy + dy;
            if (x < 0 || y < 0 || x >= img.w || y >= img.h) continue;
            const c = at(x, y); const l = lum(c);
            n++; sr += c[0]; sg += c[1]; sb += c[2];
            if (l < 245) dark++;
            if (l < minL) minL = l;
        }
        const avg = [sr / n, sg / n, sb / n];
        const avgL = lum(avg);
        const cover = dark / n;
        let kind = '.';
        if (cover > 0.80) {
            if (avg[2] - avg[0] > 40) kind = 'A';        // 蓝：升变打
            else if (avgL > 205) kind = 'W';             // 白
            else kind = 'B';                             // 黑
        } else if (cover > 0.62 && minL < 150) {
            kind = avgL > 205 ? 'w' : 'b';               // 边缘被裁切
        }
        line.push(kind);
        detail.push({ x: i, y: j, kind, cover: +cover.toFixed(2), avgL: Math.round(avgL), rgb: avg.map((v) => Math.round(v)).join(',') });
    }
    grid.push(line);
}
console.log('      列1 列2 列3 列4 列5 列6 列7 列8 列9');
grid.forEach((line, idx) => console.log(`行${9 - idx}   ` + line.map((k) => ` ${k} `).join('')));
console.log('\n明细（cover>=0.5）：');
detail.filter((d) => d.cover >= 0.5).forEach((d) => console.log(`  用户坐标(${d.x},${d.y}) ${d.kind} cover=${d.cover} avgL=${d.avgL} rgb=${d.rgb}`));
const black = detail.filter((d) => d.kind === 'B' || d.kind === 'b').map((d) => [d.x, d.y]);
const white = detail.filter((d) => d.kind === 'W' || d.kind === 'w' || d.kind === 'A').map((d) => [d.x, d.y]);
const srt = (a) => a.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
console.log('\n黑:', JSON.stringify(srt(black)));
console.log('白(含升变):', JSON.stringify(srt(white)));
