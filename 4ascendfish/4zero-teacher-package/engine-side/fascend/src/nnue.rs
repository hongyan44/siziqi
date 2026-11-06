//! NNUE 前向：462 稀疏（多重集）→ 256 累加器 ⧺ 113 稠密 → 369 → 32 → 1。
//!
//! AVX2 加速两个热点：稀疏列累加、369→32 矩阵乘；无 AVX2 时自动回退标量。

use std::io::Read;

use crate::features::{dense, sparse_indices, FeatCache, ACC, N_DENSE, N_SPARSE};
use crate::game::Game;
use crate::potential::PotTable;

const HID: usize = 32;
const IN: usize = ACC + N_DENSE;
pub const MAGIC: u32 = 0x4E4E_5545;
/// 612 维模型（不带辅助头）的精确字节数；带辅助头再 +`(HID+1)*4`。
pub const LEN_612: u64 = 4 + ((N_SPARSE * ACC + ACC + HID * IN + HID + HID + 1) * 4) as u64;

#[derive(Clone)]
pub struct Nnue {
    ws: Vec<f32>, // N_SPARSE * ACC
    bs: Vec<f32>, // ACC
    w1: Vec<f32>, // HID * IN
    b1: Vec<f32>, // HID
    w2: Vec<f32>, // HID
    b2: f32,
    w1q: Vec<i8>,  // 量化头部权重（每行一个 scale）
    w1s: Vec<f32>,
    /// 辅助头（终局 HP 差，线性 32 → 1）。老模型文件没有这一段，全 0。
    w2h: Vec<f32>,
    b2h: f32,
    /// 是否用 i8 头部（环境变量 `ASCEND_I8=1` 打开；用于 A/B）。
    use_i8: bool,
}

impl Nnue {
    pub fn load(path: &str) -> std::io::Result<Self> {
        let mut b = Vec::new();
        std::fs::File::open(path)?.read_to_end(&mut b)?;
        let magic = u32::from_le_bytes(b[0..4].try_into().unwrap());
        assert_eq!(magic, MAGIC, "坏模型文件");
        let mut o = 4;
        let mut take = |n: usize| {
            let v: Vec<f32> = b[o..o + n * 4]
                .chunks_exact(4)
                .map(|c| f32::from_le_bytes(c.try_into().unwrap()))
                .collect();
            o += n * 4;
            v
        };
        let ws = take(N_SPARSE * ACC);
        let bs = take(ACC);
        let w1 = take(HID * IN);
        let b1 = take(HID);
        let w2 = take(HID);
        let b2 = take(1)[0];
        // 辅助头是可选尾巴：老文件到这里就结束了。用总长度判断，避免读 `o`。
        let base_len = 4 + (N_SPARSE * ACC + ACC + HID * IN + HID + HID + 1) * 4;
        let (w2h, b2h) = if b.len() >= base_len + (HID + 1) * 4 {
            let w = take(HID);
            let b = take(1)[0];
            (w, b)
        } else {
            (vec![0.0; HID], 0.0)
        };
        let mut w1q = vec![0i8; HID * IN];
        let mut w1s = vec![1f32; HID];
        for j in 0..HID {
            let row = &w1[j * IN..(j + 1) * IN];
            let m = row.iter().fold(0f32, |a, &b| a.max(b.abs()));
            let sc = if m > 0.0 { m / 127.0 } else { 1.0 };
            w1s[j] = sc;
            for k in 0..IN {
                w1q[j * IN + k] = (row[k] / sc).round().clamp(-127.0, 127.0) as i8;
            }
        }
        Ok(Self { ws, bs, w1, b1, w2, b2, w1q, w1s, w2h, b2h,
            use_i8: std::env::var("ASCEND_I8").map(|v| v == "1").unwrap_or(false) })
    }

    #[inline]
    fn active(&self, g: &Game, pot: &PotTable) -> Vec<u16> {
        let mut idx = Vec::with_capacity(N_SPARSE);
        sparse_indices(g, pot, &mut idx);
        idx
    }

    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "avx2,fma")]
    unsafe fn acc_avx2(&self, idx: &[u16]) -> [f32; ACC] {
        use std::arch::x86_64::*;
        let mut acc = [0f32; ACC];
        acc.copy_from_slice(&self.bs);
        let p = acc.as_mut_ptr();
        for &i in idx {
            let base = i as usize * ACC;
            let col = self.ws.as_ptr().add(base);
            let mut k = 0;
            while k + 8 <= ACC {
                let a = _mm256_loadu_ps(p.add(k));
                let b = _mm256_loadu_ps(col.add(k));
                _mm256_storeu_ps(p.add(k), _mm256_fmadd_ps(a, _mm256_set1_ps(1.0), b));
                k += 8;
            }
        }
        acc
    }

    fn acc_scalar(&self, idx: &[u16]) -> [f32; ACC] {
        let mut acc = [0f32; ACC];
        acc.copy_from_slice(&self.bs);
        for &i in idx {
            let base = i as usize * ACC;
            let row = &self.ws[base..base + ACC];
            for k in 0..ACC {
                acc[k] += row[k];
            }
        }
        acc
    }

    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "avx2,fma")]
    unsafe fn head_avx2(&self, x: &[f32; IN]) -> f32 {
        use std::arch::x86_64::*;
        let mut h = [0f32; HID];
        for j in 0..HID {
            let row = self.w1.as_ptr().add(j * IN);
            // 4 路累加，打断 FMA 依赖链
            let mut s0 = _mm256_setzero_ps();
            let mut s1 = _mm256_setzero_ps();
            let mut s2 = _mm256_setzero_ps();
            let mut s3 = _mm256_setzero_ps();
            let mut k = 0;
            while k + 32 <= IN {
                s0 = _mm256_fmadd_ps(_mm256_loadu_ps(x.as_ptr().add(k)), _mm256_loadu_ps(row.add(k)), s0);
                s1 = _mm256_fmadd_ps(_mm256_loadu_ps(x.as_ptr().add(k + 8)), _mm256_loadu_ps(row.add(k + 8)), s1);
                s2 = _mm256_fmadd_ps(_mm256_loadu_ps(x.as_ptr().add(k + 16)), _mm256_loadu_ps(row.add(k + 16)), s2);
                s3 = _mm256_fmadd_ps(_mm256_loadu_ps(x.as_ptr().add(k + 24)), _mm256_loadu_ps(row.add(k + 24)), s3);
                k += 32;
            }
            let mut s = _mm256_add_ps(_mm256_add_ps(s0, s1), _mm256_add_ps(s2, s3));
            let mut k2 = k;
            while k2 + 8 <= IN {
                s = _mm256_add_ps(s, _mm256_mul_ps(_mm256_loadu_ps(x.as_ptr().add(k2)), _mm256_loadu_ps(row.add(k2))));
                k2 += 8;
            }
            let mut tmp = [0f32; 8];
            _mm256_storeu_ps(tmp.as_mut_ptr(), s);
            let mut acc = self.b1[j];
            for t in tmp { acc += t; }
            h[j] = acc.max(0.0);
        }
        let mut o = self.b2;
        for j in 0..HID {
            o += self.w2[j] * h[j];
        }
        o.tanh()
    }

    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "avx2,fma")]
    unsafe fn add_col_avx2(&self, acc: &mut [f32; ACC], i: u16, sign: f32) {
        use std::arch::x86_64::*;
        let base = i as usize * ACC;
        let row = self.ws.as_ptr().add(base);
        let p = acc.as_mut_ptr();
        let sv = _mm256_set1_ps(sign);
        let mut k = 0;
        while k + 8 <= ACC {
            let a = _mm256_loadu_ps(p.add(k));
            let b = _mm256_loadu_ps(row.add(k));
            _mm256_storeu_ps(p.add(k), _mm256_fmadd_ps(b, sv, a));
            k += 8;
        }
    }

    fn head_scalar(&self, x: &[f32; IN]) -> f32 {
        let mut h = [0f32; HID];
        for j in 0..HID {
            let mut s = self.b1[j];
            let row = &self.w1[j * IN..(j + 1) * IN];
            for k in 0..IN {
                s += row[k] * x[k];
            }
            h[j] = s.max(0.0);
        }
        let mut o = self.b2;
        for j in 0..HID {
            o += self.w2[j] * h[j];
        }
        o.tanh()
    }

    pub fn acc_full(&self, g: &Game, pot: &PotTable) -> [f32; ACC] {
        let idx = self.active(g, pot);
        #[cfg(target_arch = "x86_64")]
        {
            if std::arch::is_x86_feature_detected!("avx2") && std::arch::is_x86_feature_detected!("fma") {
                return unsafe { self.acc_avx2(&idx) };
            }
        }
        self.acc_scalar(&idx)
    }

    #[inline]
    fn add_col(&self, acc: &mut [f32; ACC], i: u16, sign: f32) {
        let base = i as usize * ACC;
        let row = &self.ws[base..base + ACC];
        if sign > 0.0 {
            for k in 0..ACC { acc[k] += row[k]; }
        } else {
            for k in 0..ACC { acc[k] -= row[k]; }
        }
    }

    /// 增量：由 [`FeatCache::step`] 给出全部 (索引, ±1)，累加器只做列加减。
    ///
    /// 与全量重建的差异只在 f32 求和顺序（浮点不满足结合律），量级 ~1e-5。
    #[allow(clippy::too_many_arguments)]
    pub fn acc_step(
        &self,
        acc: &mut [f32; ACC],
        fs: &mut FeatCache,
        g: &Game,
        pot: &PotTable,
        changes: &[u32],
        touched: &[u16],
    ) {
        #[cfg(target_arch = "x86_64")]
        let use_avx =
            std::arch::is_x86_feature_detected!("avx2") && std::arch::is_x86_feature_detected!("fma");
        #[cfg(not(target_arch = "x86_64"))]
        let use_avx = false;
        #[cfg(target_arch = "x86_64")]
        if use_avx {
            let p = &mut *acc;
            fs.step(g, pot, changes, touched, |i, s| unsafe {
                self.add_col_avx2(p, i, f32::from(s));
            });
            return;
        }
        let _ = use_avx;
        let p = &mut *acc;
        fs.step(g, pot, changes, touched, |i, s| self.add_col(p, i, f32::from(s)));
    }

    /// i8 头部：把激活量化到 u8(0..127) × 权重 i8，用 `vpmaddubsw + vpmaddwd`
    /// 一条指令吃 32 个元素。
    ///
    /// 关键约束：`maddubs` 的中间结果是 **i16 且饱和**，所以激活必须 ≤127，
    /// 这样一对乘积 ≤ 2×127×127 = 32258 < 32767，不会饱和。
    ///
    /// 旧版本这里有两个 bug 导致它一直没被接线：`IN = 226` 不是 32 的倍数，
    /// 尾数 2 个元素被整段丢掉；而且没有和 f32 路径做过逐局面比对。
    /// 现在尾数用标量补齐，并提供 `verify_i8` 做一致性检查。
    #[cfg(target_arch = "x86_64")]
    #[target_feature(enable = "avx2")]
    unsafe fn head_i8(&self, x: &[f32; IN]) -> f32 {
        use std::arch::x86_64::*;
        // 1) 求激活最大值（AVX 8 路）
        let mut mv = _mm256_setzero_ps();
        let mut k = 0usize;
        while k + 8 <= IN {
            mv = _mm256_max_ps(mv, _mm256_loadu_ps(x.as_ptr().add(k)));
            k += 8;
        }
        let mut t = [0f32; 8];
        _mm256_storeu_ps(t.as_mut_ptr(), mv);
        let mut maxv = 0f32;
        for v in t {
            if v > maxv {
                maxv = v;
            }
        }
        while k < IN {
            if x[k] > maxv {
                maxv = x[k];
            }
            k += 1;
        }
        let sx = if maxv > 1e-6 { maxv / 127.0 } else { 1.0 };
        let inv = 1.0 / sx;

        // 2) 量化到 u8（v 已经是 relu 后的非负值）
        let mut xq = [0u8; IN];
        for k in 0..IN {
            let v = x[k] * inv;
            xq[k] = if v >= 127.0 { 127 } else { v as u8 };
        }

        // 3) 32 个一组做 maddubs（尾数标量补）
        let ones = _mm256_set1_epi16(1);
        let mut h = [0f32; HID];
        for j in 0..HID {
            let mut acc = _mm256_setzero_si256();
            let mut k = 0usize;
            while k + 32 <= IN {
                let xv = _mm256_loadu_si256(xq.as_ptr().add(k) as *const __m256i);
                let wv = _mm256_loadu_si256(self.w1q.as_ptr().add(j * IN + k) as *const __m256i);
                let p16 = _mm256_maddubs_epi16(xv, wv);
                let p32 = _mm256_madd_epi16(p16, ones);
                acc = _mm256_add_epi32(acc, p32);
                k += 32;
            }
            let mut tmp = [0i32; 8];
            _mm256_storeu_si256(tmp.as_mut_ptr() as *mut __m256i, acc);
            let mut sum: i32 = tmp.iter().sum();
            // 尾数：标量 i32 累加，不能用 i16（会饱和）
            while k < IN {
                sum += i32::from(xq[k]) * i32::from(self.w1q[j * IN + k]);
                k += 1;
            }
            let v = sum as f32 * sx * self.w1s[j] + self.b1[j];
            h[j] = v.max(0.0);
        }
        let mut o = self.b2;
        for j in 0..HID {
            o += self.w2[j] * h[j];
        }
        o.tanh()
    }

    /// 一致性自检：同一批激活，i8 与 f32 头部的 tanh 输出差。
    /// 返回 (max|Δ|, mean|Δ|)。
    pub fn verify_i8(&self, xs: &[[f32; IN]]) -> (f32, f32) {
        #[cfg(target_arch = "x86_64")]
        {
            if std::arch::is_x86_feature_detected!("avx2") && std::arch::is_x86_feature_detected!("fma") {
                let (mut mx, mut sum) = (0f32, 0f32);
                for x in xs {
                    let a = unsafe { self.head_avx2(x) };
                    let b = unsafe { self.head_i8(x) };
                    let d = (a - b).abs();
                    if d > mx { mx = d; }
                    sum += d;
                }
                return (mx, sum / xs.len().max(1) as f32);
            }
        }
        (0.0, 0.0)
    }

    /// 拼出头部输入：`[relu(累加器) ; 稠密特征]`。
    #[inline]
    fn make_x(&self, g: &Game, pot: &PotTable, acc: &[f32; ACC]) -> [f32; IN] {
        let mut x = [0f32; IN];
        for k in 0..ACC { x[k] = acc[k].max(0.0); }
        let mut d = [0u8; N_DENSE];
        dense(g, Some(pot), &mut d);
        for k in 0..N_DENSE { x[ACC + k] = d[k] as f32; }
        x
    }

    #[inline]
    pub fn use_i8(&self) -> bool {
        self.use_i8
    }

    pub fn set_i8(&mut self, on: bool) {
        self.use_i8 = on;
    }

    pub fn value_acc(&self, g: &Game, pot: &PotTable, acc: &[f32; ACC]) -> f32 {
        let x = self.make_x(g, pot, acc);
        #[cfg(target_arch = "x86_64")]
        {
            if std::arch::is_x86_feature_detected!("avx2") && std::arch::is_x86_feature_detected!("fma") {
                if self.use_i8 {
                    return unsafe { self.head_i8(&x) };
                }
                return unsafe { self.head_avx2(&x) };
            }
        }
        self.head_scalar(&x)
    }

    /// 一致性自检：同一局面，i8 与 f32 的 tanh 输出差。
    pub fn verify_i8_acc(&self, g: &Game, pot: &PotTable, acc: &[f32; ACC]) -> f32 {
        let x = self.make_x(g, pot, acc);
        #[cfg(target_arch = "x86_64")]
        {
            if std::arch::is_x86_feature_detected!("avx2") && std::arch::is_x86_feature_detected!("fma") {
                return (unsafe { self.head_avx2(&x) } - unsafe { self.head_i8(&x) }).abs();
            }
        }
        0.0
    }

    /// 诊断：返回各张量首元素，用于加载顺序回归测试。
    pub fn debug_first(&self) -> (f32, f32, f32, f32, f32, f32) {
        (self.ws[0], self.bs[0], self.w1[0], self.b1[0], self.w2[0], self.b2)
    }

    /// 标量全路径（诊断对照）。
    pub fn value_scalar(&self, g: &Game, pot: &PotTable) -> f32 {
        let idx = self.active(g, pot);
        let acc = self.acc_scalar(&idx);
        let mut x = [0f32; IN];
        for k in 0..ACC { x[k] = acc[k].max(0.0); }
        let mut d = [0u8; N_DENSE];
        dense(g, Some(pot), &mut d);
        for k in 0..N_DENSE { x[ACC + k] = d[k] as f32; }
        self.head_scalar(&x)
    }

    /// 模型里是否带辅助头（终局 HP 差）。
    #[inline]
    pub fn has_aux(&self) -> bool {
        self.w2h.iter().any(|&v| v != 0.0) || self.b2h != 0.0
    }

    /// (价值, HP 差辅助头)。辅助头是线性输出，单位 = HP 差（我方−对方）。
    pub fn value_and_aux(&self, g: &Game, pot: &PotTable, acc: &[f32; ACC]) -> (f32, f32) {
        let mut x = [0f32; IN];
        for k in 0..ACC { x[k] = acc[k].max(0.0); }
        let mut d = [0u8; N_DENSE];
        dense(g, Some(pot), &mut d);
        for k in 0..N_DENSE { x[ACC + k] = d[k] as f32; }
        let mut h = [0f32; HID];
        for j in 0..HID {
            let mut s = self.b1[j];
            let row = &self.w1[j * IN..(j + 1) * IN];
            for k in 0..IN { s += row[k] * x[k]; }
            h[j] = s.max(0.0);
        }
        let mut o = self.b2;
        let mut a = self.b2h;
        for j in 0..HID {
            o += self.w2[j] * h[j];
            a += self.w2h[j] * h[j];
        }
        (o.tanh(), a)
    }

    /// 只取辅助头（终局 HP 差预测，单位 HP）。
    #[inline]
    pub fn aux_value(&self, g: &Game, pot: &PotTable, acc: &[f32; ACC]) -> f32 {
        self.value_and_aux(g, pot, acc).1
    }

    /// 仅头部（诊断用）。
    pub fn head_only(&self, x: &[f32; IN]) -> f32 {
        #[cfg(target_arch = "x86_64")]
        {
            if std::arch::is_x86_feature_detected!("avx2") && std::arch::is_x86_feature_detected!("fma") {
                return unsafe { self.head_avx2(x) };
            }
        }
        self.head_scalar(x)
    }

    /// f32 头部（对照用）。
    pub fn value_acc_f32(&self, g: &Game, pot: &PotTable, acc: &[f32; ACC]) -> f32 {
        let mut x = [0f32; IN];
        for k in 0..ACC { x[k] = acc[k].max(0.0); }
        let mut d = [0u8; N_DENSE];
        dense(g, Some(pot), &mut d);
        for k in 0..N_DENSE { x[ACC + k] = d[k] as f32; }
        #[cfg(target_arch = "x86_64")]
        {
            if std::arch::is_x86_feature_detected!("avx2") && std::arch::is_x86_feature_detected!("fma") {
                return unsafe { self.head_avx2(&x) };
            }
        }
        self.head_scalar(&x)
    }

    /// 行棋方视角的价值，[-1, 1]（全量重建版）。
    pub fn value(&self, g: &Game, pot: &PotTable) -> f32 {
        let acc = self.acc_full(g, pot);
        self.value_acc(g, pot, &acc)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// 写一个各张量首元素可区分的合成模型，验证 load 的字节消费顺序。
    #[test]
    fn load_order_is_correct() {
        let path = std::env::temp_dir().join("nnue_load_order.bin");
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(&MAGIC.to_le_bytes()).unwrap();
        let mut push = |n: usize, first: f32| {
            for i in 0..n {
                let v = if i == 0 { first } else { 0.0 };
                f.write_all(&v.to_le_bytes()).unwrap();
            }
        };
        push(N_SPARSE * ACC, 1.0); // ws[0]
        push(ACC, 2.0);            // bs[0]
        push(HID * IN, 3.0);       // w1[0]
        push(HID, 4.0);            // b1[0]
        push(HID, 5.0);            // w2[0]
        push(1, 6.0);              // b2
        drop(f);
        let net = Nnue::load(path.to_str().unwrap()).unwrap();
        let (a, b, c, d, e, f2) = net.debug_first();
        assert_eq!((a, b, c, d, e, f2), (1.0, 2.0, 3.0, 4.0, 5.0, 6.0), "加载顺序错位");
        assert!(!net.has_aux(), "老格式不应被当成带辅助头");
        std::fs::remove_file(&path).ok();

        // 带辅助头的尾巴：长度多 (HID+1)*4
        let path = std::env::temp_dir().join("nnue_load_order_aux.bin");
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(&MAGIC.to_le_bytes()).unwrap();
        for n in [N_SPARSE * ACC, ACC, HID * IN, HID, HID, 1] {
            for _ in 0..n {
                f.write_all(&0f32.to_le_bytes()).unwrap();
            }
        }
        for j in 0..HID {
            f.write_all(&(j as f32 + 1.0).to_le_bytes()).unwrap();
        }
        f.write_all(&7.5f32.to_le_bytes()).unwrap();
        drop(f);
        let net = Nnue::load(path.to_str().unwrap()).unwrap();
        assert!(net.has_aux(), "辅助头没读出来");
        std::fs::remove_file(&path).ok();
    }
}
