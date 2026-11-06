//! 置换表（固定 16 字节槽，总是替换）。
//!
//! 分数用"相对根"的 mate 距离存储：`score > MATE-1000` 时存 `score + ply`，
//! 取回时再减回去——否则同一杀棋在不同深度会互相污染。

use crate::search::MATE;

pub const FLAG_EXACT: u8 = 0;
pub const FLAG_LOWER: u8 = 1;
pub const FLAG_UPPER: u8 = 2;

#[derive(Clone, Copy)]
pub struct TtEntry {
    pub key: u64,
    pub score: i32,
    pub depth: u8,
    pub flag: u8,
    pub best: u8,
}

impl Default for TtEntry {
    fn default() -> Self {
        Self {
            key: 0,
            score: 0,
            depth: 0,
            flag: 0,
            best: 255,
        }
    }
}

pub struct TranspositionTable {
    entries: Vec<TtEntry>,
    mask: usize,
    pub probes: u64,
    pub hits: u64,
    pub cuts: u64,
}

impl TranspositionTable {
    pub fn new(bits: usize) -> Self {
        let n = 1usize << bits;
        Self {
            entries: vec![TtEntry::default(); n],
            mask: n - 1,
            probes: 0,
            hits: 0,
            cuts: 0,
        }
    }

    #[inline]
    pub fn probe(&mut self, key: u64) -> Option<TtEntry> {
        self.probes += 1;
        let e = self.entries[(key as usize) & self.mask];
        if e.key == key && e.depth > 0 {
            self.hits += 1;
            Some(e)
        } else {
            None
        }
    }

    #[inline]
    pub fn store(&mut self, key: u64, depth: u8, score: i32, flag: u8, best: usize) {
        let e = &mut self.entries[(key as usize) & self.mask];
        e.key = key;
        e.depth = depth;
        e.score = score;
        e.flag = flag;
        e.best = if best < 81 { best as u8 } else { 255 };
    }

    #[inline]
    pub fn clear(&mut self) {
        for e in self.entries.iter_mut() {
            *e = TtEntry::default();
        }
    }
}

/// `score` 存表时按 ply 修正 mate 距离。
#[inline]
pub fn to_tt(score: i32, ply: u32) -> i32 {
    if score > MATE - 1000 {
        score + ply as i32
    } else if score < -MATE + 1000 {
        score - ply as i32
    } else {
        score
    }
}

#[inline]
pub fn from_tt(score: i32, ply: u32) -> i32 {
    if score > MATE - 1000 {
        score - ply as i32
    } else if score < -MATE + 1000 {
        score + ply as i32
    } else {
        score
    }
}
