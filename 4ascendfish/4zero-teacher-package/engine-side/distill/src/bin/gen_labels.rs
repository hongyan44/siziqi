//! 自对弈生成 **搜索值标签**（GTL-lite：PV 节点自举）。
//!
//! **每个局面清空 TT 再搜**（`fresh_tt=1`，默认）：标签于是成为**局面的纯函数**，
//! 同一局面无论在哪一代、哪一局、哪个线程搜出来都是同一个值。
//! 不清空时标签依赖搜索历史——实测同一局面"暖 TT 生成 / 冷 TT 重搜"平均差 0.27
//! （±1 尺度，约 38% 的信号），这部分成了网络学不掉的不可约噪声，也正是
//! "拟合度每代大幅下降、Elo 不动"的直接原因。
//!
//! **随机开局的那 8 手也要标**（用独立的 Searcher，避免污染对局用 TT）：
//! 否则 turn<10 的标签数恰好 = 局数 × 2，等于没有开局数据。
//!
//! 每手只做一次 depth-4 搜索，然后把主变（PV）上每个节点都写成一条样本：
//! 第 k 层节点的值 = (-1)^k × 根分值（negamax 符号关系），**不需要再搜**。
//! 一次搜索从 1 个标签变成 4~5 个，且这些值都经过对手回应，不是静态叶子。
//!
//! 输出是 4zero 同款 jsonl，直接喂 `bridge`：
//!   gen_labels <model> <out.jsonl> <games> <depth> <open_plies> <seed> [threads]
//!
//! 线程模型：**按局并行**。局与局之间没有任何共享状态，所以这是天然可并行的；
//! 每线程写自己的 `<out>.part<i>`，最后按行拼接。
//! 每局**新建一个 Searcher/TT**：否则上一局的 TT 会渗进下一局的值，
//! 结果随线程数变化（实测 1 线程 4097 条 vs 6 线程 3650 条）。局内 TT 仍然连续。
//! 记录顺序会变成"按线程分段"，对下游无影响（`bridge` 只用 `game` 分组，
//! `game % 10` 决定 train/val，都与行序无关）。
use std::io::Write;
use std::time::Instant;

use fascend_rules::game::SamplerRng;
use fascend_rules::search::{EvalMode, Net, SearchConfig, Searcher};
use fascend_rules::{Ascend, Game, Mode, Over, Player, Stone};

/// 生成 `[t, t+stride, t+2*stride, ...]` 这些局，返回 (根标签数, PV 标签数)。
fn run_games(
    cfg: &SearchConfig,
    net: &Net,
    f: &mut impl Write,
    games: u32,
    t: u32,
    stride: u32,
    open: usize,
    seed0: u64,
    depth: u32,
    fresh_tt: bool,
    pv_plies: u32,
) -> (u64, u64) {
    let (mut n_root, mut n_pv) = (0u64, 0u64);
    let mut gi = t;
    while gi < games {
        let mut se = Searcher::new(cfg.clone()).with_net_any(net.clone());
        let se = &mut se;
        let seed = seed0.wrapping_add(gi as u64 * 0x9E37_79B9);
        let mut g = Game::new(Mode::Blight, seed as u32, (seed >> 32) as u32);
        let mut rng = SamplerRng::new(seed ^ 0x5DEECE66D);
        // 开局标签用独立 Searcher：不碰对局用的 TT，保证对局轨迹与"不标开局"时完全一致。
        // 开局位置子力少、分支多，depth-4 比终局贵 6 倍以上；开局用 depth-1 就够
        // （估值要看的是"这块地值多少"，不是战术），否则 8 次开局搜索能把整局成本翻倍。
        let od = depth.saturating_sub(1).max(2);
        let mut ose = if open > 0 {
            let mut ocfg = cfg.clone();
            ocfg.max_depth = od;
            Some(Searcher::new(ocfg).with_net_any(net.clone()))
        } else {
            None
        };
        for _ in 0..open {
            let ms = g.legal_moves();
            if ms.is_empty() { break; }
            if g.apply_move(ms[(rng.next() as usize) % ms.len()]).winner.is_some() { break; }
            if let Some(o) = ose.as_mut() {
                if g.winner().is_none() && !g.legal_moves().is_empty() {
                    if fresh_tt { o.reset_for_position(); }
                    let r = o.search(&g);
                    let rv = r.score as f32 / 4000.0;
                    emit(f, gi, &g, rv.clamp(-1.0, 1.0), 1.0, "open", 0);
                    n_root += 1;
                }
            }
        }
        drop(ose);
        for _ply in 0..260 {
            if g.winner().is_some() || g.legal_moves().is_empty() { break; }
            if fresh_tt { se.reset_for_position(); }
            let r = se.search(&g);
            // 清空 TT 后必须把根节点自己写回去：搜索只在 pvs 内部 store，
            // 根节点不会留条目。原来能取到 PV，靠的是"上一手的搜索恰好搜到过这个局面"。
            if fresh_tt {
                if let Some(bm) = r.best_move {
                    se.tt.store(g.hash(), r.depth.min(255) as u8, r.score, 0, bm); // 0 = FLAG_EXACT
                }
            }
            let root_v = r.score as f32 / 4000.0;
            emit(f, gi, &g, root_v.clamp(-1.0, 1.0), 1.0, "root", 0);
            n_root += 1;

            // ---- PV 自举 ----
            let mut cg = g.clone();
            let mut sign = -1.0f32;
            let pv_lim = if pv_plies == 0 { 0 } else { r.depth.min(pv_plies) };
            for k in 0..pv_lim {
                let key = cg.hash();
                let mv = match se.tt.probe(key) {
                    Some(e) if e.best != 255 => e.best as usize,
                    _ => break,
                };
                let res = cg.apply_move(mv);
                if !res.legal { break; }
                let v = (sign * root_v).clamp(-1.0, 1.0);
                if res.winner.is_none() && !cg.legal_moves().is_empty() {
                    emit(f, gi, &cg, v, 0.5, "pv", k + 1);
                    n_pv += 1;
                }
                sign = -sign;
                if res.winner.is_some() { break; }
            }

            let mv = match r.best_move { Some(m) => m, None => break };
            if g.apply_move(mv).winner.is_some() { break; }
        }
        if t == 0 && (gi / stride) % 10 == 0 {
            eprintln!("  [t0] 局 {gi}/{games}  已出 {} 条", n_root + n_pv);
        }
        gi += stride;
    }
    let _ = depth;
    (n_root, n_pv)
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let model = a.get(1).cloned().unwrap_or("../distill/v9.qad.bin".into());
    let out = a.get(2).cloned().unwrap_or("../distill/gen.jsonl".into());
    let games: u32 = a.get(3).and_then(|s| s.parse().ok()).unwrap_or(200);
    let depth: u32 = a.get(4).and_then(|s| s.parse().ok()).unwrap_or(4);
    let open: usize = a.get(5).and_then(|s| s.parse().ok()).unwrap_or(8);
    let seed0: u64 = a.get(6).and_then(|s| s.parse().ok()).unwrap_or(20261031);
    let threads: usize = a.get(7).and_then(|s| s.parse().ok()).unwrap_or(1).max(1);
    let threads = threads.min(games as usize).max(1);
    // 8 号参数：1 = 每个局面清空 TT（默认，标签可复现），0 = 保留跨局面 TT。
    let fresh_tt = a.get(8).map(|s| s != "0").unwrap_or(true);
    // 9 号参数：PV 自举取几层（0 = 只标根，默认 = 跟满 r.depth）。
    let pv_plies: u32 = a.get(9).and_then(|s| s.parse().ok()).unwrap_or(depth);

    let net = Net::load(&model).expect("load model");
    let cfg = SearchConfig {
        max_depth: depth,
        time_ms: 0,
        node_limit: 0,
        eval_mode: EvalMode::Nnue,
        sample_k: 2,
        ..SearchConfig::default()
    };

    let t0i = Instant::now();
    let parts: Vec<String> = (0..threads).map(|t| format!("{out}.part{t}")).collect();
    let res: Vec<(u64, u64)> = std::thread::scope(|sc| {
        let mut hs = Vec::new();
        for (t, path) in parts.iter().enumerate() {
            let cfg = cfg.clone();
            let net = net.clone();
            let path = path.clone();
            hs.push(sc.spawn(move || {
                let mut f = std::io::BufWriter::with_capacity(1 << 20, std::fs::File::create(&path).unwrap());
                let r = run_games(&cfg, &net, &mut f, games, t as u32, threads as u32, open, seed0, depth, fresh_tt, pv_plies);
                f.flush().unwrap();
                r
            }));
        }
        hs.into_iter().map(|h| h.join().unwrap()).collect()
    });

    let mut out_f = std::io::BufWriter::with_capacity(1 << 20, std::fs::File::create(&out).unwrap());
    for p in &parts {
        let mut r = std::fs::File::open(p).unwrap();
        std::io::copy(&mut r, &mut out_f).unwrap();
        std::fs::remove_file(p).ok();
    }
    out_f.flush().unwrap();

    let n_root: u64 = res.iter().map(|x| x.0).sum();
    let n_pv: u64 = res.iter().map(|x| x.1).sum();
    eprintln!(
        "root={n_root}  pv={n_pv}  total={}  threads={threads}  fresh_tt={fresh_tt} pv_plies={pv_plies}  {:.1}s/{}局 ({:.2}s/局)  -> {out}",
        n_root + n_pv,
        t0i.elapsed().as_secs_f64(),
        games,
        t0i.elapsed().as_secs_f64() / games.max(1) as f64
    );
}

fn emit<W: Write>(f: &mut W, game: u32, g: &Game, value: f32, w: f32, src: &str, pv_k: u32) {
    let mut grid = vec![0u8; 81];
    let mut mask = vec![0u8; 81];
    for i in 0..81 {
        match g.board.cells[i].stone {
            Stone::Black => grid[i] = 1,
            Stone::White => grid[i] = 2,
            Stone::BlackAscend | Stone::WhiteAscend => mask[i] = 1,
            _ => {}
        }
    }
    let plants: Vec<u8> = (0..81).map(|i| g.board.cells[i].plant as u8).collect();
    let phase = if g.state.ascend_status == Ascend::Start { "ATTACK_DEFENSE" } else { "NORMAL" };
    let (lx, ly) = g.state.turn_pos;
    let rec = serde_json::json!({
        "game": game, "ply": g.state.turn_count, "turn": g.state.turn_count,
        "to_play": g.state.turn_player as u8, "phase": phase,
        "hp": [g.state.hp[0], g.state.hp[1]],
        "grid": grid, "plants": plants, "mask": mask,
        // `last_move` 用 4zero 的 [行, 列] 约定：引擎的 turn_pos 是 (x=列, y=行)，
        // 所以这里必须写成 [ly, lx]；`bridge` 会按 [行, 列] 还原回 (x, y)。
        "last_move": [ly, lx], "value": value, "low_confidence": 0,
        "grow_count": g.state.grow_count, "charge": g.state.unascend_charge,
        "chargef": [g.state.unascend_chargef[0], g.state.unascend_chargef[1]],
        "over_fill": (g.state.over_status != Over::None) as u8,
        "just_unascend": g.state.just_unascend as u8,
        "move": [0, 0], "src": src, "pv_k": pv_k, "open_stones": 0, "hp0": 6, "hp1": 6,
        "mode": "blight", "weight_override": w,
    });
    writeln!(f, "{rec}").unwrap();
}
