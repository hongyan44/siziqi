//! PVS / Alpha-Beta：决策节点 + 机会节点。
//!
//! 已含：
//! * 迭代加深 + PVS（零窗口 + 失败重搜）
//! * 置换表（TT 走法优先、mate 距离修正）
//! * 杀手走法（2 槽/层）+ 历史启发
//! * LMR（晚走法减深；战术走法不减）
//! * 静态搜索（qsearch；只展开"成打/卖血"）
//! * MCMS 渐进加宽（机会节点采样数随访问次数增长）
//!
//! 仍是近似（诚实记录）：
//! * qsearch 在 `START` 时只展开"卖血/反击"，不展开"不理"（通常更差，但非严格）
//! * 机会节点用 K 次平均，不是严格的 alpha-beta 界

use std::collections::HashMap;
use std::time::Instant;

use crate::board::N;
use crate::enums::{Ascend, Player};
use crate::game::{unpack_change, Game, PlantPlan, SamplerRng};
use crate::features::{FeatCache, ACC};
use crate::potential::PotTable;
use crate::tt::{self, TranspositionTable};

pub const INF: i32 = 1_000_000;
pub const MATE: i32 = 900_000;
pub const MAX_PLY: usize = 128;

/// 一手之后的子局面 + 它的特征缓存 + 潜力表"触碰格"列表。
///
/// `touched` 是 `PotTable::update_many` 的返回值（哪些格的 `m` 变了），
/// 增量特征需要它来决定潜力/致命/链段要重算哪些格。
struct Child {
    g: Game,
    pot: PotTable,
    touched: [u16; N],
    ntouch: usize,
    plan: Option<PlantPlan>,
    winner: Option<Player>,
}

/// 一个可落子的网络：v9.1（612）或 240 维老模型（只读兼容）。
///
/// 按**文件长度**分派，见 [`crate::legacy`]。这样归档的 M1/M1v2/m2b 还能直接打对局。
#[derive(Clone)]
pub enum Net {
    V9(crate::nnue::Nnue),
    Old(crate::legacy::OldNnue),
}

impl Net {
    pub fn load(path: &str) -> std::io::Result<Self> {
        let len = std::fs::metadata(path)?.len();
        if len == crate::legacy::LEN_240 {
            return Ok(Net::Old(crate::legacy::OldNnue::load(path)?));
        }
        if len == crate::nnue::LEN_612 || len == crate::nnue::LEN_612 + 132 {
            return Ok(Net::V9(crate::nnue::Nnue::load(path)?));
        }
        Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!(
                "不支持的模型长度 {len}（240=296200，612=675208/675340；462 维需要旧二进制）"
            ),
        ))
    }

    pub fn acc_full(&self, g: &Game, pot: &PotTable) -> [f32; ACC] {
        match self {
            Net::V9(n) => n.acc_full(g, pot),
            Net::Old(n) => n.acc_full(g, pot),
        }
    }

    /// `pot_parent` 只有老模型用得到（它靠威胁掩码差分），新模型只看子局面的潜力表。
    #[allow(clippy::too_many_arguments)]
    pub fn acc_step(
        &self,
        acc: &mut [f32; ACC],
        fs: &mut FeatCache,
        g: &Game,
        pot_parent: &PotTable,
        pot_child: &PotTable,
        changes: &[u32],
        touched: &[u16],
    ) {
        match self {
            Net::V9(n) => n.acc_step(acc, fs, g, pot_child, changes, touched),
            Net::Old(n) => {
                n.acc_apply(acc, changes, pot_parent.threat_mask(), pot_child.threat_mask())
            }
        }
    }

    pub fn value_acc(&self, g: &Game, pot: &PotTable, acc: &[f32; ACC]) -> f32 {
        match self {
            Net::V9(n) => n.value_acc(g, pot, acc),
            Net::Old(n) => n.value_acc(g, pot, acc),
        }
    }

    pub fn has_aux(&self) -> bool {
        match self {
            Net::V9(n) => n.has_aux(),
            Net::Old(_) => false,
        }
    }

    pub fn aux_value(&self, g: &Game, pot: &PotTable, acc: &[f32; ACC]) -> f32 {
        match self {
            Net::V9(n) => n.aux_value(g, pot, acc),
            Net::Old(_) => 0.0,
        }
    }

    pub fn describe(&self) -> &'static str {
        match self {
            Net::V9(_) => "v9.1(612)",
            Net::Old(_) => "legacy(240)",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EvalMode {
    /// HP + 子数 + 攻击点数 + 最长链 + 打悬着力量。
    Full,
    /// 只用 HP + 子数（威胁项消融的代理）。
    HpOnly,
    /// NNUE（需要 `Searcher::with_net`）。
    Nnue,
}

#[derive(Clone, Debug)]
pub struct SearchConfig {
    pub max_depth: u32,
    pub sample_k: u32,
    pub leaf_skip_plan: bool,
    pub time_ms: u64,
    /// 节点上限（0 = 不限）。用于「等节点」比较：同样的搜索量下，
    /// 谁的剪枝/排序更好，就能搜得更深。时间预算与节点上限可同时给，先到先停。
    pub node_limit: u64,
    pub use_tt: bool,
    pub tt_bits: usize,
    pub eval_mode: EvalMode,
    pub use_killers: bool,
    pub use_lmr: bool,
    pub lmr_min_depth: u32,
    pub use_qsearch: bool,
    pub qdepth: u32,
    pub progressive_widening: bool,
    pub pw_c: f64,
    /// Optional root move filter used by the parallel analysis service.
    /// `None` = normal full-root search.
    pub root_moves: Option<Vec<usize>>,
    /// NNUE 辅助头（终局 HP 差）的权重，**默认 0 = 关闭**。
    ///
    /// 打开后评估变成 `tanh_value + aux_weight * (hp_diff / 10)`，
    /// 即每 1 点 HP 差折算 `aux_weight * 0.1` 的 tanh 分。模型里没有辅助头
    /// （老文件）时该字段无效。
    pub aux_weight: f32,
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            max_depth: 5,
            sample_k: 4,
            leaf_skip_plan: true,
            time_ms: 0,
            node_limit: 0,
            use_tt: true,
            tt_bits: 18,
            eval_mode: EvalMode::Full,
            use_killers: true,
            use_lmr: false,
            lmr_min_depth: 3,
            use_qsearch: false,
            qdepth: 2,
            progressive_widening: true,
            pw_c: 1.0,
            root_moves: None,
            aux_weight: 0.0,
        }
    }
}

#[derive(Clone, Debug)]
pub struct SearchResult {
    pub best_move: Option<usize>,
    pub score: i32,
    pub depth: u32,
    pub nodes: u64,
    pub elapsed_ms: u128,
    pub aborted: bool,
}

const NO_MOVE: usize = usize::MAX;

pub struct Searcher {
    pub cfg: SearchConfig,
    pub nodes: u64,
    pub history: [[i32; 81]; 2],
    pub killers: [[usize; 2]; MAX_PLY],
    pub tt: TranspositionTable,
    pub net: Option<Box<Net>>,
    pub start: Instant,
    pub aborted: bool,
    chance_visits: HashMap<u64, u32>,
    seed: u64,
}

impl Searcher {
    pub fn new(cfg: SearchConfig) -> Self {
        let bits = cfg.tt_bits.min(22);
        Self {
            cfg,
            nodes: 0,
            history: [[0; 81]; 2],
            killers: [[NO_MOVE; 2]; MAX_PLY],
            tt: TranspositionTable::new(bits),
            net: None,
            start: Instant::now(),
            aborted: false,
            chance_visits: HashMap::new(),
            seed: 0x9E37_79B9_7F4A_7C15,
        }
    }

    /// 把"搜索历史"全部清掉：TT、chance 采样计数、历史/Killer 启发。
    ///
    /// 目的是让同一次搜索成为**局面的纯函数**——同样的局面、同样的配置、
    /// 同样的网络，无论之前搜过什么，结果都一样。数值标签生成必须这样，
    /// 否则同一局面在不同上下文里会得到不同的"正确值"，网络只能学到噪声。
    /// 实测不清理时，同一局面（同深度）两次搜索的平均差是 0.27（±1 尺度）。
    pub fn reset_for_position(&mut self) {
        self.tt.clear();
        self.chance_visits.clear();
        self.history = [[0; 81]; 2];
        self.killers = [[NO_MOVE; 2]; MAX_PLY];
    }

    pub fn with_net(mut self, net: crate::nnue::Nnue) -> Self {
        self.net = Some(Box::new(Net::V9(net)));
        self
    }

    /// 任意版本（含 240 维老模型）。
    pub fn with_net_any(mut self, net: Net) -> Self {
        self.net = Some(Box::new(net));
        self
    }

    #[inline]
    fn evaluate(&self, g: &Game, pot: &PotTable, acc: &[f32; ACC]) -> i32 {
        match self.cfg.eval_mode {
            EvalMode::Nnue => match &self.net {
                Some(n) => {
                    let v = n.value_acc(g, pot, acc);
                    let v = if self.cfg.aux_weight != 0.0 && n.has_aux() {
                        v + self.cfg.aux_weight * (n.aux_value(g, pot, acc) / 10.0)
                    } else {
                        v
                    };
                    (v * 4000.0) as i32
                }
                None => eval(g, pot, EvalMode::Full),
            },
            m => eval(g, pot, m),
        }
    }

    fn time_up(&self) -> bool {
        if self.cfg.node_limit > 0 && self.nodes >= self.cfg.node_limit {
            return true;
        }
        if self.cfg.time_ms == 0 {
            return false;
        }
        (self.nodes & 1023) == 0 && self.start.elapsed().as_millis() as u64 >= self.cfg.time_ms
    }

    pub fn search(&mut self, g: &Game) -> SearchResult {
        self.start = Instant::now();
        self.aborted = false;
        self.nodes = 0;
        self.chance_visits.clear();
        let pot = PotTable::build(&g.board);
        let acc = match &self.net {
            Some(n) => n.acc_full(g, &pot),
            None => [0f32; ACC],
        };
        let fs = FeatCache::build(g, &pot);
        let mut best_move = None;
        let mut best_score = 0;
        let mut completed = 0u32;

        for depth in 1..=self.cfg.max_depth {
            let (mv, score) = self.root(g, &pot, &acc, &fs, depth, best_move);
            if self.aborted {
                break;
            }
            best_move = Some(mv);
            best_score = score;
            completed = depth;
            if score.abs() >= MATE - 100 || self.time_up() {
                break;
            }
        }

        SearchResult {
            best_move,
            score: best_score,
            depth: completed,
            nodes: self.nodes,
            elapsed_ms: self.start.elapsed().as_millis(),
            aborted: self.aborted,
        }
    }

    fn root(
        &mut self,
        g: &Game,
        pot: &PotTable,
        acc: &[f32; ACC],
        fs: &FeatCache,
        depth: u32,
        hint: Option<usize>,
    ) -> (usize, i32) {
        // 迭代加深：上一轮的 best 通过 `hint` 拿到最高排序键，先搜。
        // 旧版每层都从零重排、且不把上一轮的 best 提前 = 每加一层都从坏着法开始。
        let mut mv_buf = [0u8; 81];
        let mut n = self.ordered_moves_into(g, pot, hint, 0, &mut mv_buf);
        if let Some(allowed) = &self.cfg.root_moves {
            let mut k = 0usize;
            for i in 0..n {
                if allowed.contains(&(mv_buf[i] as usize)) {
                    mv_buf[k] = mv_buf[i];
                    k += 1;
                }
            }
            n = k;
            if n == 0 {
                return (NO_MOVE, -INF);
            }
        }
        let mut best = mv_buf[0] as usize;
        let mut best_score = -INF;
        let mut alpha = -INF;
        for (i, &mv8) in mv_buf[..n].iter().enumerate() {
            let mv = mv8 as usize;
            let score = if i == 0 {
                -self.child_value(g, pot, acc, fs, mv, depth, -INF, -alpha, 1)
            } else {
                let s = -self.child_value(g, pot, acc, fs, mv, depth, -alpha - 1, -alpha, 1);
                if s > alpha {
                    -self.child_value(g, pot, acc, fs, mv, depth, -INF, -alpha, 1)
                } else {
                    s
                }
            };
            if self.aborted {
                break;
            }
            if score > best_score {
                best_score = score;
                best = mv;
            }
            if score > alpha {
                alpha = score;
            }
        }
        (best, best_score)
    }

    /// 做一手：返回 (子局面, 子潜力表, 机会计划)。
    fn make_child(
        &self,
        g: &Game,
        pot: &PotTable,
        mv: usize,
        leaf: bool,
    ) -> Option<Child> {
        let mut c = g.clone();
        let (legal, winner, plan) = if leaf && self.cfg.leaf_skip_plan {
            let (l, w) = c.apply_leaf(mv);
            (l, w, None)
        } else {
            c.apply_fast(mv)
        };
        if !legal {
            return None;
        }
        let mut cpot = pot.clone();
        let mut cells = [0usize; 40];
        let mut n = 0;
        for &ch in c.changes() {
            let (cell, os, _, ns, _) = unpack_change(ch);
            if os != ns && n < cells.len() {
                cells[n] = cell;
                n += 1;
            }
        }
        let touched = cpot.update_many(&c.board, &cells[..n]);
        let mut out = [0u16; N];
        let nt = touched.len().min(N);
        out[..nt].copy_from_slice(&touched[..nt]);
        Some(Child {
            g: c,
            pot: cpot,
            touched: out,
            ntouch: nt,
            plan,
            winner,
        })
    }

    /// 机会节点的采样数（MCMS 渐进加宽）。
    fn samples_for(&mut self, key: u64, cap: u32) -> u32 {
        if !self.cfg.progressive_widening {
            return cap;
        }
        let e = self.chance_visits.entry(key).or_insert(0);
        *e += 1;
        let n = f64::from(*e);
        let k = (1.0 + n.sqrt() * self.cfg.pw_c).floor() as u32;
        k.clamp(1, cap)
    }

    fn child_value(
        &mut self,
        g: &Game,
        pot: &PotTable,
        acc: &[f32; ACC],
        fs: &FeatCache,
        mv: usize,
        depth: u32,
        alpha: i32,
        beta: i32,
        ply: u32,
    ) -> i32 {
        let leaf = depth <= 1;
        let c = match self.make_child(g, pot, mv, leaf) {
            Some(x) => x,
            None => return -INF,
        };
        if let Some(w) = c.winner {
            return mate_score(w, c.g.state.turn_player, ply);
        }
        match c.plan {
            None => {
                // 父累加器/缓存 → 落子后的子局面
                let mut cfs = fs.clone();
                let mut cacc = *acc;
                if let Some(n) = &self.net {
                    n.acc_step(
                        &mut cacc,
                        &mut cfs,
                        &c.g,
                        pot,
                        &c.pot,
                        c.g.changes(),
                        &c.touched[..c.ntouch],
                    );
                }
                self.pvs(&c.g, &c.pot, &cacc, &cfs, depth - 1, alpha, beta, ply)
            }
            Some(p) => {
                let cap = self.cfg.sample_k.max(1);
                let key = c.g.hash();
                let k = self.samples_for(key, cap);
                let mut sum = 0i64;
                for i in 0..k {
                    let mut s = c.g.clone();
                    let mut rng = SamplerRng::new(self.seed ^ key ^ (u64::from(i) << 32));
                    s.commit_plan(&p, &mut rng);
                    // `commit_plan` 不清空 change log，所以 `s.changes()` 已经是
                    // "父局面 → s" 的合并改动：**从父缓存一步推进**即可（不能先推 c）。
                    let ch: Vec<usize> = s.changes().iter().map(|&x| (x & 0x7f) as usize).collect();
                    let mut spot = pot.clone();
                    let t: Vec<u16> = spot.update_many(&s.board, &ch).to_vec();
                    let mut sfs = fs.clone();
                    let mut sacc = *acc;
                    if let Some(n) = &self.net {
                        n.acc_step(&mut sacc, &mut sfs, &s, pot, &spot, s.changes(), &t);
                    }
                    sum += i64::from(self.pvs(&s, &spot, &sacc, &sfs, depth - 1, alpha, beta, ply));
                }
                (sum / i64::from(k)) as i32
            }
        }
    }

    fn pvs(
        &mut self,
        g: &Game,
        pot: &PotTable,
        acc: &[f32; ACC],
        fs: &FeatCache,
        depth: u32,
        mut alpha: i32,
        beta: i32,
        ply: u32,
    ) -> i32 {
        self.nodes += 1;
        if self.time_up() {
            self.aborted = true;
            return 0;
        }
        if let Some(w) = g.winner() {
            return mate_score(w, g.state.turn_player, ply);
        }
        if depth == 0 {
            if self.cfg.use_qsearch {
                return self.qsearch(g, pot, acc, fs, alpha, beta, ply, self.cfg.qdepth);
            }
            return self.evaluate(g, pot, acc);
        }
        let my = g.state.turn_player.index();
        let key = g.hash();
        let orig_alpha = alpha;
        let mut tt_move = None;
        if self.cfg.use_tt {
            if let Some(e) = self.tt.probe(key) {
                if e.best < 81 {
                    tt_move = Some(e.best as usize);
                }
                if u32::from(e.depth) >= depth {
                    let s = tt::from_tt(e.score, ply);
                    match e.flag {
                        tt::FLAG_EXACT => return s,
                        tt::FLAG_LOWER if s >= beta => {
                            self.tt.cuts += 1;
                            return s;
                        }
                        tt::FLAG_UPPER if s <= alpha => {
                            self.tt.cuts += 1;
                            return s;
                        }
                        _ => {}
                    }
                }
            }
        }
        let mut mv_buf = [0u8; 81];
        let nmv = self.ordered_moves_into(g, pot, tt_move, ply as usize, &mut mv_buf);
        let mut best = -INF;
        let mut best_move = mv_buf[0] as usize;
        for (i, &mv8) in mv_buf[..nmv].iter().enumerate() {
            let mv = mv8 as usize;
            let tactical = is_tactical(g, pot, mv);
            let mut red = 0u32;
            if self.cfg.use_lmr && i >= 3 && depth >= self.cfg.lmr_min_depth && !tactical {
                red = 1 + u32::from(i >= 8);
                red = red.min(depth.saturating_sub(2));
            }
            let score = if i == 0 {
                -self.child_value(g, pot, acc, fs, mv, depth, -beta, -alpha, ply)
            } else {
                let mut s =
                    -self.child_value(g, pot, acc, fs, mv, depth - red, -alpha - 1, -alpha, ply);
                if s > alpha && red > 0 {
                    s = -self.child_value(g, pot, acc, fs, mv, depth, -alpha - 1, -alpha, ply);
                }
                if s > alpha && s < beta {
                    s = -self.child_value(g, pot, acc, fs, mv, depth, -beta, -alpha, ply);
                }
                s
            };
            if self.aborted {
                return best.max(-INF);
            }
            if score > best {
                best = score;
                best_move = mv;
            }
            if score > alpha {
                alpha = score;
            }
            if alpha >= beta {
                // 历史 + 杀手
                let h = &mut self.history[my][mv];
                *h = (*h + (depth * depth) as i32).min(1 << 20);
                let pl = ply as usize;
                if self.cfg.use_killers && pl < MAX_PLY && self.killers[pl][0] != mv {
                    self.killers[pl][1] = self.killers[pl][0];
                    self.killers[pl][0] = mv;
                }
                break;
            }
        }
        if self.cfg.use_tt && !self.aborted {
            let flag = if best <= orig_alpha {
                tt::FLAG_UPPER
            } else if best >= beta {
                tt::FLAG_LOWER
            } else {
                tt::FLAG_EXACT
            };
            self.tt
                .store(key, depth as u8, tt::to_tt(best, ply), flag, best_move);
        }
        best
    }

    /// 静态搜索：只展开"能成打"与"卖血"的走法。
    fn qsearch(
        &mut self,
        g: &Game,
        pot: &PotTable,
        acc: &[f32; ACC],
        fs: &FeatCache,
        mut alpha: i32,
        beta: i32,
        ply: u32,
        qdepth: u32,
    ) -> i32 {
        self.nodes += 1;
        if self.time_up() {
            self.aborted = true;
            return 0;
        }
        if let Some(w) = g.winner() {
            return mate_score(w, g.state.turn_player, ply);
        }
        let stand = self.evaluate(g, pot, acc);
        if qdepth == 0 || ply as usize >= MAX_PLY - 1 {
            return stand;
        }
        if stand >= beta {
            return stand;
        }
        if stand > alpha {
            alpha = stand;
        }
        let mut best = stand;
        for mv in self.qmoves(g, pot) {
            let c = match self.make_child(g, pot, mv, true) {
                Some(x) => x,
                None => continue,
            };
            if let Some(w) = c.winner {
                let s = mate_score(w, c.g.state.turn_player, ply);
                if s > best {
                    best = s;
                }
                if best > alpha {
                    alpha = best;
                }
                if alpha >= beta {
                    break;
                }
                continue;
            }
            let s = match c.plan {
                None => {
                    let mut cfs = fs.clone();
                    let mut cacc = *acc;
                    if let Some(n) = &self.net {
                        n.acc_step(
                            &mut cacc,
                            &mut cfs,
                            &c.g,
                            pot,
                            &c.pot,
                            c.g.changes(),
                            &c.touched[..c.ntouch],
                        );
                    }
                    -self.qsearch(&c.g, &c.pot, &cacc, &cfs, -beta, -alpha, ply + 1, qdepth - 1)
                }
                Some(p) => {
                    let cap = self.cfg.sample_k.max(1);
                    let key = c.g.hash();
                    let k = self.samples_for(key, cap);
                    let mut sum = 0i64;
                    for i in 0..k {
                        let mut sc = c.g.clone();
                        let mut rng = SamplerRng::new(self.seed ^ key ^ (u64::from(i) << 32));
                        sc.commit_plan(&p, &mut rng);
                        // `changes()` 已含落子 + 计划两段（见 child_value 注释）
                        let ch: Vec<usize> =
                            sc.changes().iter().map(|&x| (x & 0x7f) as usize).collect();
                        let mut spot = pot.clone();
                        let t: Vec<u16> = spot.update_many(&sc.board, &ch).to_vec();
                        let mut sfs = fs.clone();
                        let mut sacc = *acc;
                        if let Some(n) = &self.net {
                            n.acc_step(&mut sacc, &mut sfs, &sc, pot, &spot, sc.changes(), &t);
                        }
                        sum += i64::from(-self.qsearch(
                            &sc,
                            &spot,
                            &sacc,
                            &sfs,
                            -beta,
                            -alpha,
                            ply + 1,
                            qdepth - 1,
                        ));
                    }
                    (sum / i64::from(k)) as i32
                }
            };
            if self.aborted {
                return best;
            }
            if s > best {
                best = s;
            }
            if best > alpha {
                alpha = best;
            }
            if alpha >= beta {
                break;
            }
        }
        best
    }

    fn qmoves(&self, g: &Game, pot: &PotTable) -> Vec<usize> {
        let my = g.state.turn_player.index();
        let enemy = g.state.turn_player.enemy_ascend();
        let start = g.state.ascend_status == Ascend::Start;
        let mut v = Vec::new();
        let mut mask = g.legal_mask();
        while mask != 0 {
            let cell = mask.trailing_zeros() as usize;
            let cover = g.board.cells[cell].stone == enemy;
            let attack = pot.m[my][cell] >= 4;
            // `START`：防守方必须应对 → 卖血/反击都算战术；"不理"通常更差，省略（近似）
            if attack || (start && cover) {
                v.push(cell);
            }
            mask &= mask - 1;
        }
        v.sort_unstable_by_key(|&cell| {
            let cover = i32::from(g.board.cells[cell].stone == enemy) * 10;
            -(i32::from(pot.m[my][cell]) * 100 + cover)
        });
        v
    }

    /// 生成并排序合法着法，写入调用方给的栈缓冲，返回个数。
    ///
    /// 旧版每个节点分配两个 `Vec`（~40 元素 × 2）再排序；按 390k NPS 算就是
    /// 每秒 ~78 万次堆分配。改成固定数组后这一项消失。
    fn ordered_moves_into(
        &mut self,
        g: &Game,
        pot: &PotTable,
        tt_move: Option<usize>,
        ply: usize,
        out: &mut [u8; 81],
    ) -> usize {
        let my_idx = g.state.turn_player.index();
        let enemy = g.state.turn_player.enemy_ascend();
        let k0 = if ply < MAX_PLY { self.killers[ply][0] } else { NO_MOVE };
        let k1 = if ply < MAX_PLY { self.killers[ply][1] } else { NO_MOVE };
        let mut keyed = [(0i32, 0u8); 81];
        let mut n = 0usize;
        let mut mask = g.legal_mask();
        while mask != 0 {
            let cell = mask.trailing_zeros() as usize;
            mask &= mask - 1;
            let tt_bonus = if tt_move == Some(cell) { 1_000_000 } else { 0 };
            let killer = if self.cfg.use_killers && cell == k0 {
                50_000
            } else if self.cfg.use_killers && cell == k1 {
                25_000
            } else {
                0
            };
            let cover = i32::from(g.board.cells[cell].stone == enemy) * 400;
            let attack = i32::from(pot.m[my_idx][cell]) * 100;
            let key = tt_bonus + killer + attack + cover + self.history[my_idx][cell];
            keyed[n] = (-key, cell as u8);
            n += 1;
        }
        keyed[..n].sort_unstable();
        for k in 0..n {
            out[k] = keyed[k].1;
        }
        n
    }
}

#[inline]
fn mate_score(w: Player, to_move: Player, ply: u32) -> i32 {
    if w == to_move {
        MATE - ply as i32
    } else {
        -(MATE - ply as i32)
    }
}

#[inline]
fn is_tactical(g: &Game, pot: &PotTable, mv: usize) -> bool {
    let my = g.state.turn_player.index();
    pot.m[my][mv] >= 4 || g.board.cells[mv].stone == g.state.turn_player.enemy_ascend()
}

/// 手写评估（骨架用；不是网络）。从**行棋方**视角。
pub fn eval(g: &Game, pot: &PotTable, mode: EvalMode) -> i32 {
    let my = g.state.turn_player.index();
    let opp = 1 - my;
    let mut s = (g.state.hp[my] - g.state.hp[opp]) * 1000;
    let ms = g.board.stone_count_player(g.state.turn_player) as i32;
    let os = g.board.stone_count_player(g.state.turn_player.other()) as i32;
    s += (ms - os) * 12;
    if mode == EvalMode::HpOnly {
        return s;
    }
    s += (pot.count_ge(my, 4) as i32 - pot.count_ge(opp, 4) as i32) * 60;
    s += (pot.longest(my) as i32 - pot.longest(opp) as i32) * 25;

    if g.state.ascend_status == Ascend::Start {
        let mut f_black = 0i32;
        let mut f_white = 0i32;
        let mut mb = g.board.bb_black_asc;
        while mb != 0 {
            let i = mb.trailing_zeros() as usize;
            f_black += 1 + g.board.cells[i].plant.power_bonus();
            mb &= mb - 1;
        }
        let mut mw = g.board.bb_white_asc;
        while mw != 0 {
            let i = mw.trailing_zeros() as usize;
            f_white += 1 + g.board.cells[i].plant.power_bonus();
            mw &= mw - 1;
        }
        let mine = if g.state.turn_player == Player::Black {
            f_black
        } else {
            f_white
        };
        let theirs = if g.state.turn_player == Player::Black {
            f_white
        } else {
            f_black
        };
        s += (mine - theirs) * 40;
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Game, Mode, Stone};

    fn cfg(d: u32) -> SearchConfig {
        SearchConfig {
            max_depth: d,
            sample_k: 4,
            tt_bits: 16,
            ..SearchConfig::default()
        }
    }

    /// 黑 (0,0)-(2,0)，白 HP 3：黑落 (3,0) 成打，白无论卖血还是不理都会被 ≥3 伤害打死。
    #[test]
    fn finds_mate_in_two() {
        let mut g = Game::new(Mode::Blight, 1, 1);
        for x in 0..3 {
            g.board.set_stone_at(x, Stone::Black);
        }
        g.state.hp = [6, 3];
        let mut s = Searcher::new(cfg(3));
        let r = s.search(&g);
        assert_eq!(r.best_move, Some(3), "应找到 (3,0)");
        assert!(r.score >= MATE - 10, "应判必杀，实得 {}", r.score);
    }

    #[test]
    fn eval_symmetric_on_empty_board() {
        let g = Game::new(Mode::Blight, 1, 1);
        let pot = PotTable::build(&g.board);
        assert_eq!(eval(&g, &pot, EvalMode::Full), 0);
    }

    #[test]
    fn search_returns_legal_move() {
        let g = Game::new(Mode::Normal, 3, 4);
        let mut s = Searcher::new(cfg(2));
        let r = s.search(&g);
        let mv = r.best_move.expect("应有落子");
        assert!(g.legal_mask() & (1u128 << mv) != 0);
    }

    /// 关掉所有增强后仍然合法。
    #[test]
    fn plain_search_still_works() {
        let g = Game::new(Mode::Normal, 9, 9);
        let mut s = Searcher::new(SearchConfig {
            max_depth: 2,
            use_tt: false,
            use_killers: false,
            use_lmr: false,
            use_qsearch: false,
            progressive_widening: false,
            ..SearchConfig::default()
        });
        let r = s.search(&g);
        assert!(r.best_move.is_some());
    }
}
