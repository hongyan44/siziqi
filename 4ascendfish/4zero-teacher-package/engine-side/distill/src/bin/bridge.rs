//! 状态桥：4zero JSONL → 我们的特征（462 稀疏 + 113 稠密）→ 数据集 v3。
//!
//! ```bash
//! bridge <in.jsonl> <out-prefix> [val-mod=10]
//! ```
use std::fs::File;
use std::io::{BufRead, BufReader};

use distill::dataset::Writer;
use fascend_rules::features::{dense, sparse_indices, N_DENSE};
use fascend_rules::potential::PotTable;
use fascend_rules::{Ascend, Game, Mode, Over, Plant, Player, Stone};
use serde::Deserialize;

#[derive(Deserialize)]
struct Rec {
    game: u32,
    turn: u32,
    to_play: u8,
    phase: String,
    hp: [i32; 2],
    grid: Vec<u8>,
    plants: Vec<u8>,
    mask: Vec<u8>,
    last_move: Option<[usize; 2]>,
    value: f32,
    low_confidence: u8,
    grow_count: i32,
    charge: i32,
    chargef: [i32; 2],
    over_fill: u8,
    just_unascend: u8,
    #[serde(default)]
    weight_override: f32,
}

fn build(r: &Rec) -> (Game, PotTable) {
    let mut g = Game::new(Mode::Normal, 1, 1);
    let ad = r.phase == "ATTACK_DEFENSE";
    let to_play = if r.to_play == 0 { Player::Black } else { Player::White };
    let attacker = to_play.other();
    for i in 0..81 {
        let st = if r.mask[i] != 0 {
            if attacker == Player::Black { Stone::BlackAscend } else { Stone::WhiteAscend }
        } else {
            match r.grid[i] {
                1 => Stone::Black,
                2 => Stone::White,
                _ => Stone::None,
            }
        };
        g.board.set_stone_at(i, st);
        g.board.set_plant_at(
            i,
            match r.plants[i] {
                1 => Plant::One,
                2 => Plant::Two,
                _ => Plant::None,
            },
        );
    }
    g.state.hp = r.hp;
    g.state.turn_player = to_play;
    g.state.turn_count = r.turn;
    g.state.ascend_status = if ad { Ascend::Start } else { Ascend::None };
    g.state.grow_count = r.grow_count;
    g.state.unascend_charge = r.charge;
    g.state.unascend_chargef = r.chargef;
    g.state.over_status = if r.over_fill != 0 { Over::Enable } else { Over::None };
    g.state.just_unascend = r.just_unascend != 0;
    g.state.turn_pos = r.last_move.map(|[rr, cc]| (cc, rr)).unwrap_or((0, 0));

    // 在 state 设好之后再断言合法手集合（依赖 turn_player）
    let empties = (0..81).filter(|&i| g.board.cells[i].stone == Stone::None).count();
    let mask_n = r.mask.iter().filter(|&&m| m != 0).count();
    let legal = g.legal_mask().count_ones() as usize;
    assert_eq!(legal, empties + mask_n, "合法手集合与教师不一致");

    let pot = PotTable::build(&g.board);
    (g, pot)
}

fn features(g: &Game, pot: &PotTable) -> (Vec<u16>, [f32; N_DENSE]) {
    // 与引擎 `/nnue` 的 `acc_full` 共用 `sparse_indices`，保证训练/推理同源。
    let mut idx: Vec<u16> = Vec::with_capacity(fascend_rules::features::N_SPARSE);
    sparse_indices(g, pot, &mut idx);
    idx.sort_unstable(); // 保留重复：重复 = 该列累加次数
    let mut d = [0u8; N_DENSE];
    dense(g, Some(pot), &mut d);
    (idx, d.map(|x| x as f32))
}

fn bucket_of(turn: u32) -> usize {
    if turn < 10 { 0 } else if turn <= 20 { 1 } else { 2 }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let input = args.get(1).expect("in.jsonl");
    let prefix = args.get(2).expect("out-prefix");
    let val_mod: u32 = args.get(3).and_then(|s| s.parse().ok()).unwrap_or(10);
    let flatten: u32 = args.get(4).and_then(|s| s.parse().ok()).unwrap_or(0);

    // 第一遍：统计 turn 分桶（压平用）
    let mut total = 0u64;
    let mut buckets = [0u64; 3];
    let mut last_hp: std::collections::HashMap<u32, [i32; 2]> = std::collections::HashMap::new();
    for line in BufReader::new(File::open(input).unwrap()).lines() {
        let line = line.unwrap();
        if line.trim().is_empty() { continue; }
        if let Ok(r) = serde_json::from_str::<Rec>(&line) {
            total += 1;
            buckets[bucket_of(r.turn)] += 1;
            last_hp.insert(r.game, r.hp); // 该局最后一条记录 = 终局血量（差一手，见文档）
        }
    }
    let target = total as f64 / 3.0;
    let mut bucket_w = [1f32; 3];
    if flatten != 0 {
        for b in 0..3 {
            if buckets[b] > 0 {
                bucket_w[b] = ((target / buckets[b] as f64).min(1.0)) as f32;
            }
        }
    }
    eprintln!("buckets={:?} bucket_w={:?} (flatten={})", buckets, bucket_w, flatten);

    let mut tr = Writer::create(format!("{prefix}.train.bin"), 0).unwrap();
    let mut va = Writer::create(format!("{prefix}.val.bin"), 0).unwrap();
    let mut n = 0u64;
    let mut nv = 0u64;
    let mut max_sparse = 0usize;
    let mut sum_sparse = 0u64;
    for line in BufReader::new(File::open(input).unwrap()).lines() {
        let line = line.unwrap();
        if line.trim().is_empty() {
            continue;
        }
        let r: Rec = serde_json::from_str(&line).expect("bad json");
        let (g, pot) = build(&r);
        let (idx, d) = features(&g, &pot);
        max_sparse = max_sparse.max(idx.len());
        sum_sparse += idx.len() as u64;
        // Quiet Positions 三档
        let mut w = bucket_w[bucket_of(r.turn)];
        if r.hp[0] <= 1 || r.hp[1] <= 1 { w *= 0.1; }
        if r.weight_override > 0.0 { w *= r.weight_override; }
        // 辅助头标签：终局 HP 差（我方 − 对方，HP 先钳到 ≥0）
        let fh = last_hp.get(&r.game).copied().unwrap_or(r.hp);
        let my = if r.to_play == 0 { 0 } else { 1 };
        let aux = (fh[my].max(0) - fh[1 - my].max(0)) as f32;
        if r.game % val_mod == 0 {
            va.push_weighted_aux(&idx, &d, r.value, r.low_confidence != 0, w, aux).unwrap();
            nv += 1;
        } else {
            tr.push_weighted_aux(&idx, &d, r.value, r.low_confidence != 0, w, aux).unwrap();
            n += 1;
        }
    }
    tr.finish().unwrap();
    va.finish().unwrap();
    println!(
        "train={n} val={nv}  sparse avg={:.1} max={max_sparse}",
        sum_sparse as f64 / (n + nv).max(1) as f64
    );
}
