//! 增量特征层：**15 个 D4 轨道** + 稠密经济标量。
//!
//! # 为什么是轨道
//!
//! 9×9 棋盘在 D4（旋转/镜像）下只有 15 个轨道。这个游戏没有任何方向性棋子，
//! 所以"轨道合并"是**精确的权重绑定**，不是近似——同轨道内位置完全等价。
//!
//! 稀疏输入 = **462**（v9）：
//!
//! | 索引 | 维度 | 含义 |
//! |---|---|---|
//! | 0..90 | 90 | 基础：6 类 × 15 轨道（黑/白/黑打/白打/草 1/草 2） |
//! | 90..270 | 180 | 棋型：2 色 × 6 类（活二/眠二/死二/活三/眠三/死三）× 15 轨道 |
//! | 270..390 | 120 | 潜力打：2 色 × 4 桶（`m_a` = 0 / 4 / 5-6 / ≥7）× 15 轨道 |
//! | 390..420 | 30 | 致命：该格该色 `m_a ≥ 对方血量`（下一手能成打杀人） |
//! | 420..432 | 12 | 攻防力量：hist(1..4) + 总力量档 + 打子数档 + 斩杀/被斩杀 |
//! | 432..462 | 30 | 草-链：有草的格且该色 `m_a ≥ 4`（草把潜力变成链） |
//!
//! 草是**中立**的：它长在空格上，谁占据该格，谁的子就获得力量加成；
//! 所以草按"格"编码，不按"方"编码。
//!
//! 稠密输入 = **113**：`dense()` 的 one-hot 桶，相对行棋方。
//!
//! # 增量
//!
//! [`Game::changes`](crate::Game::changes) 给出本手改动过的格子（已按格合并，
//! old = 本手开始前），[`PotTable::update_many`] 给出潜力值变化的格子。
//! [`FeatCache`] 缓存每格的棋型/潜力桶/致命/草-链/力量掩码，[`FeatCache::step`]
//! 只对"可能变"的格子重算并发出 `(索引, ±1)`：
//!
//! * 基础段：直接来自 `changes` 的 old/new；
//! * 棋型段：改动格沿 4 轴 ±3 的窗口（run ≤ 3，开放端最多再远 1 格）；
//! * 潜力/致命/链：`update_many` 触碰的格 ∪ 改动格；血量变化时致命段整段重算；
//! * 力量段：12 bit 掩码差分。
//!
//! 全量枚举只有一条路径（[`sparse_indices`] = `FeatCache::build` + `emit_all`），
//! 桥、根节点、训练三方共用，避免"训练/推理特征不一致"这类静默错误。

use crate::board::{N, W};
use crate::enums::{Ascend, Over, Plant, Stone};
use crate::game::{unpack_change, Game};
use crate::potential::PotTable;

/// D4 轨道数。
pub const N_ORBIT: usize = 15;
/// 稀疏输入维度。
/// 基础段：6 类 × 15 轨道 = 90。
pub const N_BASE: usize = 6 * N_ORBIT;
/// 棋型类数（活二/眠二/死二/活三/眠三/死三/活跳二/眠跳二/活跳三/眠跳三）。
pub const K_PAT: usize = 10;
/// 潜力打桶数（与 `PotTable::bucket_of` 的 0..4 一致）。
pub const POT_BUCKETS: usize = 5;
/// 棋型段：2 色 × 10 类 × 15 轨道 = 300。
pub const N_PAT: usize = 2 * K_PAT * N_ORBIT;
/// 潜力打段：2 色 × 5 桶 × 15 轨道 = 150（**替换**旧的 150 威胁段）。
pub const N_POT: usize = 2 * POT_BUCKETS * N_ORBIT;
/// 致命段：2 色 × 15 轨道 = 30。
pub const N_LETHAL: usize = 2 * N_ORBIT;
/// 攻防力量段：12。
pub const N_POWER: usize = 12;
/// 草-链段：2 色 × 15 轨道 = 30。
pub const N_CHAIN: usize = 2 * N_ORBIT;
/// 总稀疏维度：90 + 300 + 150 + 30 + 12 + 30 = **612**。
pub const N_SPARSE: usize = N_BASE + N_PAT + N_POT + N_LETHAL + N_POWER + N_CHAIN;
/// v9 维度别名（文档/训练器共用同一个数字）。
pub const N_SPARSE_V9: usize = N_SPARSE;
/// 累加器宽度。
pub const ACC: usize = 256;
/// 稠密标量维度：去掉"最后落子轨道"（15）后 128 → **113**。
pub const N_DENSE: usize = 128 - N_ORBIT;
/// v9 稠密别名。
pub const DENSE_V9: usize = N_DENSE;

/// 格 → 轨道。键是 `sorted(|x-4|, |y-4|)` 的三角编号。
pub const ORBIT: [u8; N] = build_orbits();

const fn build_orbits() -> [u8; N] {
    let mut m = [0u8; N];
    let mut i = 0;
    while i < N {
        let x = i % W;
        let y = i / W;
        let dx = if x >= 4 { x - 4 } else { 4 - x };
        let dy = if y >= 4 { y - 4 } else { 4 - y };
        let (u, v) = if dx >= dy { (dx, dy) } else { (dy, dx) };
        m[i] = (u * (u + 1) / 2 + v) as u8;
        i += 1;
    }
    m
}

/// 一个格子最多贡献两个稀疏特征（棋子一个、草一个）。
#[inline]
pub fn cell_features(cell: usize, stone: Stone, plant: Plant, out: &mut [u16; 2]) -> usize {
    let o = u16::from(ORBIT[cell]);
    let mut n = 0;
    match stone {
        Stone::Black => {
            out[n] = o;
            n += 1;
        }
        Stone::White => {
            out[n] = 15 + o;
            n += 1;
        }
        Stone::BlackAscend => {
            out[n] = 30 + o;
            n += 1;
        }
        Stone::WhiteAscend => {
            out[n] = 45 + o;
            n += 1;
        }
        Stone::None | Stone::BlackUsed | Stone::WhiteUsed => {}
    }
    match plant {
        Plant::One => {
            out[n] = 60 + o;
            n += 1;
        }
        Plant::Two => {
            out[n] = 75 + o;
            n += 1;
        }
        Plant::None => {}
    }
    n
}

/// 稀疏权重表：90 列 × 256。
pub struct WeightTable {
    pub bias: [i16; ACC],
    pub cols: [[i16; ACC]; N_SPARSE],
}

impl WeightTable {
    /// 造一张可复现的随机权重（**只用于成本基准**，不是网络）。
    pub fn random(seed: u64) -> Self {
        let mut s = seed | 1;
        let mut next = || {
            s ^= s << 13;
            s ^= s >> 7;
            s ^= s << 17;
            ((s >> 32) as i32) as i16
        };
        let mut cols = [[0i16; ACC]; N_SPARSE];
        for c in cols.iter_mut() {
            for v in c.iter_mut() {
                *v = next() / 64;
            }
        }
        let mut bias = [0i16; ACC];
        for v in bias.iter_mut() {
            *v = next() / 64;
        }
        Self { bias, cols }
    }
}

#[inline]
fn add_col(acc: &mut [i16; ACC], col: &[i16; ACC], sign: i16) {
    for i in 0..ACC {
        acc[i] = acc[i].wrapping_add(col[i].wrapping_mul(sign));
    }
}

/// 累加器：`bias + Σ 活跃列`（i16）。诊断/训练对照用，增量逻辑与引擎共用
/// [`FeatCache::step`]，所以两边不会漂移。
#[derive(Clone)]
pub struct FeatureAcc {
    pub acc: [i16; ACC],
}

impl FeatureAcc {
    pub fn zero() -> Self {
        Self { acc: [0; ACC] }
    }

    /// 全量重建（只在根节点用）。`pot = None` 时只加基础段（做 A/B 用）。
    pub fn rebuild(&mut self, g: &Game, w: &WeightTable, pot: Option<&crate::potential::PotTable>) {
        self.acc = w.bias;
        match pot {
            Some(p) => {
                let mut idx = Vec::with_capacity(N_SPARSE);
                sparse_indices(g, p, &mut idx);
                for &k in &idx {
                    add_col(&mut self.acc, &w.cols[k as usize], 1);
                }
            }
            None => {
                for cell in 0..N {
                    let c = g.board.cells[cell];
                    let mut idx = [0u16; 2];
                    let n = cell_features(cell, c.stone, c.plant, &mut idx);
                    for &k in &idx[..n] {
                        add_col(&mut self.acc, &w.cols[k as usize], 1);
                    }
                }
            }
        }
    }

    /// 增量：与引擎同一条路径。
    #[allow(clippy::too_many_arguments)]
    pub fn update(
        &mut self,
        w: &WeightTable,
        fs: &mut FeatCache,
        g: &Game,
        pot: &crate::potential::PotTable,
        changes: &[u32],
        touched: &[u16],
    ) {
        fs.step(g, pot, changes, touched, |k, s| {
            add_col(&mut self.acc, &w.cols[k as usize], i16::from(s));
        });
    }
}

/// 稠密经济标量（one-hot 桶），64 维（尾部 padding 为 0）。
///
/// 这些量**每手都在变**，塞进累加器会白付 5.5 ns/特征；concat 到隐层是免费的。
#[inline]
fn small3(v: u32) -> usize {
    if v == 0 {
        0
    } else if v <= 2 {
        1
    } else {
        2
    }
}

#[inline]
fn stone_bucket(v: usize) -> usize {
    if v <= 10 {
        0
    } else if v <= 20 {
        1
    } else {
        2
    }
}

/// 稠密特征：**相对行棋方**（我方 / 对方），避免网络分别学黑白两套。
///
/// 布局（每组都是 one-hot；`61..64` 是条件致死位，可能全 0）：
/// ```text
/// 0..6 血量差 · 6..11 我血 · 11..16 对血 · 16..19 回合 · 19..22 grow
/// 22..24 charge>0 · 24..26 cf 我>0 · 26..28 cf 对>0 · 28..31 过载
/// 31..32 打悬着 · 32..34 子数差 · 34..37 cf 我档 · 37..40 cf 对档
/// 40..43 合法手 · 43..46 空格 · 46 just · 47 过载×落后
/// 48..52 F_attack · 52..56 F_cover · 56..61 F_counter · 61..64 致死
/// 64..67 我子数 · 67..70 对子数
/// 70..73 我打子数 · 73..76 对打子数 · 76..79 草1 · 79..82 草2
/// 82..88 charge 精确 · 88..91 我攻击点 · 91..94 对攻击点
/// 94..97 我致死威胁 · 97..100 对致死威胁 · 100..101 威胁不对称
/// 101..107 我最长链 · 107..113 对最长链
/// ```
///
/// v9 相对 v0.2：删掉 `64..79 最后落子轨道`（15 维）——落子位置已由基础段/棋型段
/// 覆盖，这一组对评估的独立贡献在消融里为负。其余整体前移 15，128 → 113。
pub fn dense(g: &Game, pot: Option<&crate::potential::PotTable>, out: &mut [u8; N_DENSE]) {
    out.fill(0);
    let my = g.state.turn_player.index();
    let opp = 1 - my;
    let hp_my = g.state.hp[my];
    let hp_opp = g.state.hp[opp];

    let db = match hp_my - hp_opp {
        i32::MIN..=-3 => 0,
        -2 => 1,
        -1 => 2,
        0 => 3,
        1..=2 => 4,
        _ => 5,
    };
    out[db] = 1; // 0..6
    out[6 + hp_my.clamp(0, 4) as usize] = 1; // 6..11
    out[11 + hp_opp.clamp(0, 4) as usize] = 1; // 11..16
    let tb = match g.state.turn_count {
        0..=21 => 0,
        22..=64 => 1,
        _ => 2,
    };
    out[16 + tb] = 1; // 16..19
    let gb = match g.state.grow_count {
        i32::MIN..=0 => 0,
        1..=3 => 1,
        _ => 2,
    };
    out[19 + gb] = 1; // 19..22
    out[22 + usize::from(g.state.unascend_charge > 0)] = 1; // 22..24
    out[24 + usize::from(g.state.unascend_chargef[my] > 0)] = 1; // 24..26
    out[26 + usize::from(g.state.unascend_chargef[opp] > 0)] = 1; // 26..28
    out[28 + g.state.over_status as usize] = 1; // 28..31
    out[31 + usize::from(g.state.ascend_status == Ascend::Start)] = 1; // 31..32
    let sd = g.board.stone_count_player(g.state.turn_player) as i32
        - g.board.stone_count_player(g.state.turn_player.other()) as i32;
    out[32 + usize::from(sd > 0)] = 1; // 32..34

    let cfb = |v: i32| -> usize {
        match v {
            i32::MIN..=0 => 0,
            1..=2 => 1,
            _ => 2,
        }
    };
    out[34 + cfb(g.state.unascend_chargef[my])] = 1; // 34..37
    out[37 + cfb(g.state.unascend_chargef[opp])] = 1; // 37..40

    let lm = g.legal_mask().count_ones();
    out[40 + if lm <= 20 { 0 } else if lm <= 50 { 1 } else { 2 }] = 1; // 40..43
    let empty = 81 - g.board.bb_occ.count_ones();
    out[43 + if empty <= 20 { 0 } else if empty <= 50 { 1 } else { 2 }] = 1; // 43..46

    out[46 + usize::from(g.state.just_unascend)] = 1; // 46..47
    out[47 + usize::from(g.state.over_status == Over::Execute && hp_my <= hp_opp)] = 1; // 47..48

    // ---- 战斗账本 ----
    let mut f_attack = 0u32;
    let mut f_cover = 0u32;
    let starting = g.state.ascend_status == Ascend::Start;
    if starting {
        let mut m = g.board.bb_black_asc | g.board.bb_white_asc;
        while m != 0 {
            let i = m.trailing_zeros() as usize;
            let p = 1 + g.board.cells[i].plant.power_bonus();
            f_attack += p as u32;
            f_cover = f_cover.max(p as u32);
            m &= m - 1;
        }
    }
    out[48 + match f_attack {
        0 => 0,
        1..=3 => 1,
        4..=6 => 2,
        _ => 3,
    }] = 1; // 48..52
    out[52 + f_cover.min(3) as usize] = 1; // 52..56
    let counter_bucket = if starting {
        pot.map_or(0, |p| p.best_bucket(my))
    } else {
        0
    };
    out[56 + counter_bucket as usize] = 1; // 56..61
    if starting && hp_my > 0 {
        out[61 + usize::from(f_attack as i32 >= hp_my)] = 1;
        out[62 + usize::from(f_attack as i32 - f_cover as i32 >= hp_my)] = 1;
        let counter_count = match counter_bucket {
            1 => 4,
            2 => 5,
            3 => 7,
            4 => 9,
            _ => 0,
        };
        out[63 + usize::from(counter_count >= hp_opp.max(1))] = 1;
    } // 61..64 条件位

    // ---- 免费状态 ----
    out[64 + stone_bucket(g.board.stone_count_player(g.state.turn_player))] = 1; // 64..67
    out[67 + stone_bucket(g.board.stone_count_player(g.state.turn_player.other()))] = 1; // 67..70
    let my_asc = if my == 0 {
        g.board.bb_black_asc.count_ones()
    } else {
        g.board.bb_white_asc.count_ones()
    };
    let opp_asc = if opp == 0 {
        g.board.bb_black_asc.count_ones()
    } else {
        g.board.bb_white_asc.count_ones()
    };
    out[70 + small3(my_asc)] = 1; // 70..73
    out[73 + small3(opp_asc)] = 1; // 73..76
    out[76 + small3(g.board.n_plant1 as u32)] = 1; // 76..79
    out[79 + small3(g.board.n_plant2 as u32)] = 1; // 79..82
    let chb = match g.state.unascend_charge {
        i32::MIN..=0 => 0,
        1..=4 => 1,
        5..=9 => 2,
        10..=16 => 3,
        17..=24 => 4,
        _ => 5,
    };
    out[82 + chb] = 1; // 82..88

    // ---- 威胁计数（O(34)）----
    match pot {
        Some(p) => {
            out[88 + small3(p.count_ge(my, 4))] = 1; // 88..91
            out[91 + small3(p.count_ge(opp, 4))] = 1; // 91..94
            if hp_opp > 0 {
                out[94 + small3(p.count_ge(my, hp_opp.min(33) as u8))] = 1;
            } else {
                out[94] = 1;
            }
            if hp_my > 0 {
                out[97 + small3(p.count_ge(opp, hp_my.min(33) as u8))] = 1;
            } else {
                out[97] = 1;
            }
            out[100 + usize::from(p.best_bucket(my) > p.best_bucket(opp))] = 1;
            // 101..107 / 107..113 最长连续链（1–2 / 3 / 4 / 5 / 6 / 7+）
            let lb = |l: u8| -> usize {
                match l {
                    0..=2 => 0,
                    3 => 1,
                    4 => 2,
                    5 => 3,
                    6 => 4,
                    _ => 5,
                }
            };
            out[101 + lb(p.longest(my))] = 1;
            out[107 + lb(p.longest(opp))] = 1;
        }
        None => {
            for i in [88, 91, 94, 97, 100, 101, 107] {
                out[i] = 1;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::potential::PotTable;
    use crate::{Game, Mode};

    /// 增量（棋子 + 棋型 + 潜力/致命/链 + 力量）必须与全量重建逐位相等。
    ///
    /// i16 加法是模 2^16 的交换群运算，顺序无关，所以这里可以要求**严格相等**；
    /// 引擎的 f32 累加器做不到这一点（浮点不满足结合律），另用容差测试。
    #[test]
    fn incremental_features_match_rebuild() {
        let w = WeightTable::random(3);
        let mut g = Game::new(Mode::Normal, 5, 6);
        let mut pot = PotTable::build(&g.board);
        let mut fs = FeatCache::build(&g, &pot);
        let mut acc = FeatureAcc::zero();
        acc.rebuild(&g, &w, Some(&pot));
        let mut rng = crate::game::SamplerRng::new(7);
        for step in 0..80 {
            let ms = g.legal_moves();
            if ms.is_empty() {
                break;
            }
            let mv = ms[(rng.next() as usize) % ms.len()];
            let (_, _, plan) = g.apply_fast(mv);
            if let Some(p) = plan {
                g.commit_plan(&p, &mut rng);
            }
            let changed: Vec<usize> = g.changes().iter().map(|&c| (c & 0x7f) as usize).collect();
            let touched: Vec<u16> = pot.update_many(&g.board, &changed).to_vec();
            acc.update(&w, &mut fs, &g, &pot, g.changes(), &touched);

            let mut fresh = FeatureAcc::zero();
            fresh.rebuild(&g, &w, Some(&pot));
            assert_eq!(acc.acc, fresh.acc, "step={step}");
        }
    }

    /// 血量变化（结算）没有格子改动，但致命段依赖血量 —— 必须整段重算。
    #[test]
    fn hp_change_recomputes_lethal() {
        let w = WeightTable::random(5);
        let mut g = Game::new(Mode::Normal, 20, 20);
        // 摆一些子把 m 拉起来，让 lethal 有条件为真
        for (i, c) in [(40usize, Stone::Black), (41, Stone::White), (39, Stone::Black)] {
            g.board.cells[i].stone = c;
        }
        let mut pot = PotTable::build(&g.board);
        let mut fs = FeatCache::build(&g, &pot);
        let mut acc = FeatureAcc::zero();
        acc.rebuild(&g, &w, Some(&pot));
        for dmg in [2, 3, 1] {
            g.state.hp[1] = (g.state.hp[1] - dmg).max(0);
            let ch: [usize; 0] = [];
            let t: Vec<u16> = pot.update_many(&g.board, &ch).to_vec();
            acc.update(&w, &mut fs, &g, &pot, &[], &t);
            let mut fresh = FeatureAcc::zero();
            fresh.rebuild(&g, &w, Some(&pot));
            assert_eq!(acc.acc, fresh.acc, "dmg={dmg}");
        }
    }

    /// 棋型分类：手工局面逐类验收（含跳型）。
    #[test]
    fn line_patterns_basics() {
        let e = 0u8;
        let b = 1u8;
        let w = 2u8;
        let wall = 3u8;
        // 活二 _XX_（第 3,4 位）
        let mut s = [e; 9];
        s[3] = b;
        s[4] = b;
        let v = line_patterns(&s);
        assert_eq!(v[3], 1, "活二");
        assert_eq!(v[4], 1, "活二");
        // 眠二（左端出界 → wall）
        let mut s = [wall; 9];
        s[0] = b;
        s[1] = b;
        s[2] = e;
        let v = line_patterns(&s);
        assert_eq!(v[0], 2, "眠二");
        // 死二 X X 两端都堵
        let mut s = [e; 9];
        s[3] = w;
        s[4] = b;
        s[5] = b;
        s[6] = w;
        let v = line_patterns(&s);
        assert_eq!(v[4], 3, "死二");
        assert_eq!(v[5], 3, "死二");
        // 活三 _XXX_
        let mut s = [e; 9];
        for p in 3..=5 { s[p] = b; }
        let v = line_patterns(&s);
        assert_eq!(v[4], 4, "活三");
        // 跳二 X_X（两端开）
        let mut s = [e; 9];
        s[3] = b;
        s[5] = b;
        let v = line_patterns(&s);
        assert_eq!(v[3], 7, "活跳二");
        assert_eq!(v[5], 7, "活跳二");
        // 跳三 XX_X
        let mut s = [e; 9];
        s[3] = b;
        s[4] = b;
        s[6] = b;
        let v = line_patterns(&s);
        assert_eq!(v[3], 9, "活跳三");
        assert_eq!(v[6], 9, "活跳三");
        // 跳三 X_XX
        let mut s = [e; 9];
        s[3] = b;
        s[5] = b;
        s[6] = b;
        let v = line_patterns(&s);
        assert_eq!(v[5], 9, "活跳三");
        // 打子打断：把中间换成 wall 后不成三
        let mut s = [e; 9];
        s[3] = b;
        s[4] = wall;
        s[5] = b;
        let v = line_patterns(&s);
        assert_eq!(v[3], 0, "打子应断开");
        // run≥4 不计棋型
        let mut s = [e; 9];
        for p in 2..=5 { s[p] = b; }
        let v = line_patterns(&s);
        assert!(v.iter().all(|&x| x == 0), "run≥4 不应有棋型");
    }

    /// v9 全量枚举：索引必须落在 [0,462)，且可复现。
    #[test]
    fn sparse_indices_in_range() {
        let mut g = Game::new(Mode::Normal, 11, 13);
        let mut rng = crate::game::SamplerRng::new(5);
        let mut out = Vec::new();
        for _ in 0..40 {
            let ms = g.legal_moves();
            if ms.is_empty() { break; }
            let pot = PotTable::build(&g.board);
            sparse_indices(&g, &pot, &mut out);
            assert!(out.iter().all(|&i| (i as usize) < N_SPARSE_V9), "索引越界");
            assert!(out.len() >= 2 * 81, "至少潜力段每格一条");
            let mut again = Vec::new();
            sparse_indices(&g, &pot, &mut again);
            assert_eq!(out, again);
            let (_, _, plan) = g.apply_fast(ms[(rng.next() as usize) % ms.len()]);
            if let Some(p) = plan { g.commit_plan(&p, &mut rng); }
        }
    }

    /// 稠密特征：每组必须恰好一个 one-hot（或全 0 的致死位）。
    #[test]
    fn dense_is_well_formed() {
        let mut g = Game::new(Mode::Normal, 9, 9);
        let pot = PotTable::build(&g.board);
        let mut out = [0u8; N_DENSE];
        dense(&g, Some(&pot), &mut out);
        // 每组恰好 1 个（`61..64` 条件致死位可能全 0，不在此列）
        for (lo, hi) in [
            (0, 6), (6, 11), (11, 16), (16, 19), (19, 22), (22, 24), (24, 26),
            (26, 28), (28, 31), (31, 32), (32, 34), (34, 37), (37, 40), (40, 43),
            (43, 46), (46, 47), (47, 48), (48, 52), (52, 56), (56, 61),
            (64, 67), (67, 70), (70, 73), (73, 76), (76, 79), (79, 82), (82, 88),
            (88, 91), (91, 94), (94, 97), (97, 100), (100, 101),
            (101, 107), (107, 113),
        ] {
            let n: u32 = out[lo..hi].iter().map(|&v| u32::from(v)).sum();
            assert_eq!(n, 1, "group {lo}..{hi} 不是 one-hot");
        }
    }
}

// ---------------------------------------------------------------------------
// v9 特征层（612 稀疏 / 113 稠密）
// 布局：0..90 基础 | 90..390 棋型 | 390..540 潜力打 | 540..570 致命
//       | 570..582 力量 | 582..612 草-链
// ---------------------------------------------------------------------------

#[inline]
pub fn pat_index(color: usize, kind: usize, orbit: u8) -> u16 {
    (N_BASE + (color * K_PAT + kind) * N_ORBIT) as u16 + u16::from(orbit)
}
#[inline]
pub fn pot_index(color: usize, bucket: usize, orbit: u8) -> u16 {
    (N_BASE + N_PAT + (color * POT_BUCKETS + bucket) * N_ORBIT) as u16 + u16::from(orbit)
}
#[inline]
pub fn lethal_index(color: usize, orbit: u8) -> u16 {
    (N_BASE + N_PAT + N_POT + color * N_ORBIT) as u16 + u16::from(orbit)
}
#[inline]
pub fn power_index(k: usize) -> u16 {
    (N_BASE + N_PAT + N_POT + N_LETHAL + k) as u16
}
#[inline]
pub fn chain_index(color: usize, orbit: u8) -> u16 {
    (N_BASE + N_PAT + N_POT + N_LETHAL + N_POWER + color * N_ORBIT) as u16 + u16::from(orbit)
}

/// 棋型 10 类，顺序**固定**（索引 = 类别号，训练与引擎共用）。
pub const PAT_NAMES: [&str; K_PAT] = [
    "活二", "眠二", "死二", "活三", "眠三", "死三", "活跳二", "眠跳二", "活跳三", "眠跳三",
];

/// 强度序：一格同时属于多个棋型时只报**最强**的那个（见 [`line_patterns`]）。
///
/// `死三` 排在 `眠跳三` 之后：两端都堵死的三已经无法延长，不如一个能长大的跳三。
pub const PAT_RANK: [u8; K_PAT] = [
    5,  // 活二
    4,  // 眠二
    1,  // 死二
    10, // 活三
    9,  // 眠三
    6,  // 死三
    3,  // 活跳二
    2,  // 眠跳二
    8,  // 活跳三
    7,  // 眠跳三
];

#[inline]
fn rank_of(v: u8) -> u8 {
    if v == 0 {
        0
    } else {
        PAT_RANK[usize::from(v - 1)]
    }
}

#[inline]
fn put(best: &mut [u8; 9], p: usize, k: u8) {
    if PAT_RANK[usize::from(k)] > rank_of(best[p]) {
        best[p] = k + 1;
    }
}

/// 一条线（9 格）的棋型分类。输入编码：`0` 空 / `1` 黑 / `2` 白 / `3` 墙
/// （打子、已用、棋盘外都按 `3` 处理）。
///
/// 返回 `best[p]`：`0` = 无棋型，`k+1` = 第 k 类（见 [`PAT_NAMES`]）。
///
/// **一格只报一个棋型**，取它参与的所有棋型里最强的一个。三类来源：
///
/// 1. **连续段**：同色 run 长度 2 或 3，按两端开放数分活/眠/死；
/// 2. **跳二**：`X_X`，中间空一格，按两端开放数分活/眠（全堵死不报）；
/// 3. **跳三**：`X_XX` / `XX_X`，4 格 3 子一个空位，同样按两端开放数分活/眠。
///
/// run ≥ 4 不计棋型（那是升仙链，已有打子/链特征）。
///
/// 实现是**按颜色位掩码**做的：一条线每色只需 2 个 9 bit 掩码（子/空），
/// 连续段用 `trailing_ones` 扫，跳型用 3-4 个移位与操作一次算完，整线约 40 条指令。
pub fn line_patterns(s: &[u8; 9]) -> [u8; 9] {
    let mut best = [0u8; 9];
    let (mut mb, mut mw, mut mk) = (0u32, 0u32, 0u32);
    for p in 0..9 {
        match s[p] {
            1 => mb |= 1 << p,
            2 => mw |= 1 << p,
            3 => mk |= 1 << p, // 打子/界外 = 墙
            _ => {}            // 0 = 空
        }
    }
    // 墙不是空位：棋型的"开放"只看真正的空格
    let e = (!(mb | mw | mk)) & 0x1ff;
    pat_color(mb, e, &mut best);
    pat_color(mw, e, &mut best);
    best
}

/// 单色棋型（`m` = 该色 9 bit 掩码，`e` = 空位掩码）。
#[inline]
fn pat_color(m: u32, e: u32, best: &mut [u8; 9]) {
    // 1) 连续段
    let mut r = m;
    while r != 0 {
        let i = r.trailing_zeros();
        let run = (r >> i).trailing_ones();
        if run == 2 || run == 3 {
            let left = u8::from(i > 0 && (e >> (i - 1)) & 1 != 0);
            let right = u8::from((e >> (i + run)) & 1 != 0);
            let base = if run == 2 { 0 } else { 3 };
            let k = base + match left + right {
                2 => 0,
                1 => 1,
                _ => 2,
            };
            for p in i..i + run {
                put(best, p as usize, k);
            }
        }
        r &= !(((1u32 << run.min(9)) - 1) << i);
    }

    // 2) 跳二：X _ X。位 i 表示 i、i+2 有子、i+1 空。
    let j2 = m & (m >> 2) & (e >> 1);
    if j2 != 0 {
        let left = e << 1; // 位 i = e[i-1]
        let right = e >> 3; // 位 i = e[i+3]
        let open = (left & right) | ((left ^ right) & j2);
        let mut two = j2 & (left & right); // 活跳二
        let mut one = j2 & (left ^ right) & !(left & right); // 眠跳二
        // 两端全堵死 → 不报
        while two != 0 {
            let i = two.trailing_zeros() as usize;
            put(best, i, 6);
            put(best, i + 2, 6);
            two &= two - 1;
        }
        while one != 0 {
            let i = one.trailing_zeros() as usize;
            put(best, i, 7);
            put(best, i + 2, 7);
            one &= one - 1;
        }
        let _ = open;
    }

    // 3) 跳三：X _ X X（位 i..i+3 = m,e,m,m）与 X X _ X（m,m,e,m）
    let j3a = m & (e >> 1) & (m >> 2) & (m >> 3);
    let j3b = m & (m >> 1) & (e >> 2) & (m >> 3);
    let mut j3 = j3a | j3b;
    if j3 != 0 {
        let left = e << 1; // e[i-1]
        let right = e >> 4; // e[i+4]
        let mut both = j3 & left & right;
        let mut one = j3 & (left ^ right) & !(left & right);
        while both != 0 {
            let i = both.trailing_zeros();
            for q in i..i + 4 {
                if (m >> q) & 1 != 0 {
                    put(best, q as usize, 8);
                }
            }
            both &= both - 1;
        }
        while one != 0 {
            let i = one.trailing_zeros();
            for q in i..i + 4 {
                if (m >> q) & 1 != 0 {
                    put(best, q as usize, 9);
                }
            }
            one &= one - 1;
        }
        let _ = j3;
    }
}

/// 力量段 12 位掩码（`0..4` hist、`4..8` 总力量档、`8..10` 个数档、
/// `10` 可斩杀、`11` 被斩杀）。
fn power_mask(g: &Game) -> u16 {
    if g.state.ascend_status != Ascend::Start {
        return 0;
    }
    let mut hist = [0u32; 4];
    let mut total = 0u32;
    let mut best = 0u32;
    let mut cnt = 0u32;
    let mut m = g.board.bb_black_asc | g.board.bb_white_asc;
    while m != 0 {
        let i = m.trailing_zeros() as usize;
        let p = 1 + g.board.cells[i].plant.power_bonus() as u32;
        hist[(p.min(4) - 1) as usize] += 1;
        total += p;
        best = best.max(p);
        cnt += 1;
        m &= m - 1;
    }
    let mut mask = 0u16;
    for (k, &v) in hist.iter().enumerate() {
        if v > 0 {
            mask |= 1 << k;
        }
    }
    let tb = match total {
        0 => 0,
        1..=3 => 1,
        4..=6 => 2,
        _ => 3,
    };
    mask |= 1 << (4 + tb);
    let cb = match cnt {
        0 => 0,
        1..=2 => 1,
        _ => 2,
    };
    mask |= 1 << (8 + cb);
    let my = g.state.turn_player.index();
    if best >= g.state.hp[1 - my].max(1) as u32 {
        mask |= 1 << 10;
    }
    if best >= g.state.hp[my].max(1) as u32 {
        mask |= 1 << 11;
    }
    mask
}

#[inline]
fn bit_get(m: &[u64; 3], i: usize) -> bool {
    (m[i >> 6] >> (i & 63)) & 1 != 0
}

#[inline]
fn bit_put(m: &mut [u64; 3], i: usize, v: bool) {
    if v {
        m[i >> 6] |= 1 << (i & 63);
    } else {
        m[i >> 6] &= !(1 << (i & 63));
    }
}

/// 位置级特征缓存：与棋盘/潜力表**一起克隆**，供增量差分使用。
///
/// - `pat[i*4+a]`：0 = 无，`1..=K_PAT` = 黑（类别+1），`K_PAT+1..=2*K_PAT` = 白。
/// - `pot[c*81+i]`：该格该色的潜力桶（0..4，直接取 `PotTable::bucket`）。
/// - `lethal` / `chain`：162 bit 标志，序号 `c*81+i`。
/// - `power`：12 bit 力量段掩码。
/// - `hp`：致命段依赖血量；血量一变就整段重算。
///
/// **棋型不走窗口**：一格的棋型只受它所在 4 条线影响，所以只要某条线里有棋子变了，
/// 就整条线重算一遍（9 格，输入是 `PotTable::code` 的 2 bit/格 颜色码），
/// 再与缓存逐格比较。这比"改动格 ±N 窗口"少算一个数量级，且天然覆盖跳型。
#[derive(Clone)]
pub struct FeatCache {
    pat: [u8; N * 4],
    pot: [u8; 2 * N],
    lethal: [u64; 3],
    chain: [u64; 3],
    power: u16,
    hp: [i32; 2],
    /// 上一次 [`FeatCache::step`] 发出的特征条数（性能诊断用）。
    pub emitted: u32,
    /// 上一次 step 重算的线数 / 重算的格数（性能诊断用）。
    pub dbg_line: u32,
    pub dbg_pat_chg: u32,
    pub dbg_cell: u32,
}

impl FeatCache {
    /// 全量建立缓存（根节点 / 每帧重同步）。
    pub fn build(g: &Game, pot: &PotTable) -> Self {
        let hp = [g.state.hp[0], g.state.hp[1]];
        let mut s = Self {
            pat: [0; N * 4],
            pot: [0; 2 * N],
            lethal: [0; 3],
            chain: [0; 3],
            power: 0,
            hp,
            emitted: 0,
            dbg_line: 0,
            dbg_pat_chg: 0,
            dbg_cell: 0,
        };
        for a in 0..4 {
            for line in 0..crate::potential::LINES {
                s.fill_pat_line(pot, a, line, &mut |_, _| {});
            }
        }
        for i in 0..N {
            let plant = g.board.cells[i].plant;
            for c in 0..2 {
                let slot = c * N + i;
                let m = pot.m[c][i];
                s.pot[slot] = pot.bucket[c][i];
                let lethal = m > 0 && i32::from(m) >= hp[1 - c].max(0);
                bit_put(&mut s.lethal, slot, lethal);
                bit_put(&mut s.chain, slot, plant != Plant::None && m >= 4);
            }
        }
        s.power = power_mask(g);
        s
    }

    /// 重算一条线的棋型并与缓存比较，对每个变化发出 `(索引, ±1)`。
    #[inline]
    fn fill_pat_line<F: FnMut(u16, i8)>(
        &mut self,
        pot: &PotTable,
        a: usize,
        line: usize,
        emit: &mut F,
    ) {
        let n = crate::potential::LINE_LEN[a][line] as usize;
        if n < 2 {
            return;
        }
        let code = pot.code[a][line];
        let mut s = [3u8; 9];
        for p in 0..n {
            s[p] = ((code >> (2 * p)) & 3) as u8;
        }
        let vals = line_patterns(&s);
        let cells = &crate::potential::LINE_CELLS[a][line];
        self.dbg_line += 1;
        for p in 0..n {
            let v = vals[p];
            let newv = if v == 0 {
                0
            } else {
                // v = kind+1，s[p] = 颜色码 1/2
                (s[p] as usize - 1) * K_PAT + usize::from(v - 1) + 1
            };
            let slot = cells[p] as usize * 4 + a;
            let oldv = self.pat[slot];
            if oldv == newv as u8 {
                continue;
            }
            self.dbg_pat_chg += 1;
            let o = ORBIT[cells[p] as usize];
            if oldv != 0 {
                let z = usize::from(oldv - 1);
                emit(pat_index(z / K_PAT, z % K_PAT, o), -1);
            }
            if newv != 0 {
                let z = newv - 1;
                emit(pat_index(z / K_PAT, z % K_PAT, o), 1);
            }
            self.pat[slot] = newv as u8;
        }
    }

    /// 全量枚举 612 个稀疏特征（与 [`sparse_indices`] 同源）。
    pub fn emit_all(&self, g: &Game, out: &mut Vec<u16>) {
        out.clear();
        for i in 0..N {
            let c = g.board.cells[i];
            let mut t = [0u16; 2];
            let n = cell_features(i, c.stone, c.plant, &mut t);
            out.extend_from_slice(&t[..n]);
        }
        for i in 0..N {
            let o = ORBIT[i];
            for a in 0..4 {
                let v = self.pat[i * 4 + a];
                if v != 0 {
                    let z = usize::from(v - 1);
                    out.push(pat_index(z / K_PAT, z % K_PAT, o));
                }
            }
        }
        for i in 0..N {
            let o = ORBIT[i];
            for c in 0..2 {
                let slot = c * N + i;
                out.push(pot_index(c, usize::from(self.pot[slot]), o));
                if bit_get(&self.lethal, slot) {
                    out.push(lethal_index(c, o));
                }
                if bit_get(&self.chain, slot) {
                    out.push(chain_index(c, o));
                }
            }
        }
        let mut pm = self.power;
        while pm != 0 {
            let b = pm.trailing_zeros() as usize;
            out.push(power_index(b));
            pm &= pm - 1;
        }
    }

    /// 单格潜力/致命/草-链差分（两色）。潜力桶直接取 `PotTable::bucket`。
    #[inline]
    fn update_cell<F: FnMut(u16, i8)>(
        &mut self,
        g: &Game,
        pot: &PotTable,
        cell: usize,
        emit: &mut F,
    ) {
        self.dbg_cell += 1;
        let o = ORBIT[cell];
        let plant = g.board.cells[cell].plant;
        for c in 0..2 {
            let slot = c * N + cell;
            let nb = pot.bucket[c][cell];
            if nb != self.pot[slot] {
                emit(pot_index(c, usize::from(self.pot[slot]), o), -1);
                emit(pot_index(c, usize::from(nb), o), 1);
                self.pot[slot] = nb;
            }
            let m = pot.m[c][cell];
            let nl = m > 0 && i32::from(m) >= self.hp[1 - c].max(0);
            if nl != bit_get(&self.lethal, slot) {
                bit_put(&mut self.lethal, slot, nl);
                emit(lethal_index(c, o), if nl { 1 } else { -1 });
            }
            let nch = plant != Plant::None && m >= 4;
            if nch != bit_get(&self.chain, slot) {
                bit_put(&mut self.chain, slot, nch);
                emit(chain_index(c, o), if nch { 1 } else { -1 });
            }
        }
    }

    /// 增量：把缓存从"父局面"推进到 `g`/`pot`（**必须是新局面**）。
    ///
    /// 棋型段按**脏线**整线重算（每条线一次 `line_patterns`，9 格），
    /// 潜力/致命/链只看 `touched ∪ changed`，血量变化时致命段整段重算。
    pub fn step<F: FnMut(u16, i8)>(
        &mut self,
        g: &Game,
        pot: &PotTable,
        changes: &[u32],
        touched: &[u16],
        mut emit: F,
    ) {
        self.dbg_line = 0;
        self.dbg_pat_chg = 0;
        self.dbg_cell = 0;
        let mut cnt = 0u32;
        let mut wrap = |k: u16, s: i8| {
            cnt += 1;
            emit(k, s);
        };

        // 1) 基础段
        for &ch in changes {
            let (cell, os, op, ns, np) = unpack_change(ch);
            let mut buf = [0u16; 2];
            let n = cell_features(cell, os, op, &mut buf);
            for &k in &buf[..n] {
                wrap(k, -1);
            }
            let n = cell_features(cell, ns, np, &mut buf);
            for &k in &buf[..n] {
                wrap(k, 1);
            }
        }

        // 2) 棋型段：脏线（4 轴 × 17 线 = 68 bit）
        let mut dirty = [0u64; 2];
        for &ch in changes {
            let (cell, os, _, ns, _) = unpack_change(ch);
            if os == ns {
                continue;
            }
            for a in 0..4 {
                let line = crate::potential::LINE_INDEX[a][cell] as usize;
                let b = a * crate::potential::LINES + line;
                dirty[b >> 6] |= 1 << (b & 63);
            }
        }
        for k in 0..2 {
            let mut bits = dirty[k];
            while bits != 0 {
                let b = k * 64 + bits.trailing_zeros() as usize;
                let a = b / crate::potential::LINES;
                let line = b % crate::potential::LINES;
                self.fill_pat_line(pot, a, line, &mut wrap);
                bits &= bits - 1;
            }
        }

        // 3) 潜力 / 致命 / 草-链段
        //    血量先更新：`update_cell` 的致命判定要用新血量。
        let hp = [g.state.hp[0], g.state.hp[1]];
        let hp_changed = hp != self.hp;
        self.hp = hp;
        let mut seen = [0u64; 2];
        for &cell in touched {
            let c = cell as usize;
            if seen[c >> 6] >> (c & 63) & 1 != 0 {
                continue;
            }
            seen[c >> 6] |= 1 << (c & 63);
            self.update_cell(g, pot, c, &mut wrap);
        }
        for &ch in changes {
            let c = (ch & 0x7f) as usize;
            if seen[c >> 6] >> (c & 63) & 1 != 0 {
                continue;
            }
            seen[c >> 6] |= 1 << (c & 63);
            self.update_cell(g, pot, c, &mut wrap);
        }
        // 血量变了但格子没动：只有"致命"段会翻，潜力桶/草-链都不依赖血量。
        // 整盘扫一遍只要 162 次比较（比逐格走 `update_cell` 便宜 3 倍）。
        if hp_changed {
            for i in 0..N {
                for c in 0..2 {
                    let slot = c * N + i;
                    let m = pot.m[c][i];
                    let nl = m > 0 && i32::from(m) >= hp[1 - c].max(0);
                    if nl != bit_get(&self.lethal, slot) {
                        bit_put(&mut self.lethal, slot, nl);
                        wrap(lethal_index(c, ORBIT[i]), if nl { 1 } else { -1 });
                    }
                }
            }
        }

        // 4) 力量段
        let np = power_mask(g);
        if np != self.power {
            let mut diff = np ^ self.power;
            while diff != 0 {
                let b = diff.trailing_zeros() as usize;
                wrap(power_index(b), if np >> b & 1 != 0 { 1 } else { -1 });
                diff &= diff - 1;
            }
            self.power = np;
        }
        self.emitted = cnt;
    }
}

/// 一次性枚举 v9 全部 612 个稀疏特征（**唯一**全量路径：桥、`rebuild`、
/// 根节点累加器共用，保证三方逐位一致）。
pub fn sparse_indices(g: &Game, pot: &PotTable, out: &mut Vec<u16>) {
    FeatCache::build(g, pot).emit_all(g, out);
}
