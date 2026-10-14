// 一次性修复：清除被移除后重新报名选手遗留的历史完赛战绩
// 用法：bun contest_cleanup.cjs node_main:2
//   - 结构性残留：组未满员，或小分身份与当前组员不匹配 -> 清空
//   - 指定残留：node_id:group_index -> 强制清空（用于已被移除并重报名、身份相同的旧战绩）
const { Database } = require('bun:sqlite');
const fs = require('fs');

const db_path = '/root/server/4ascend-online/db/contest.db';
const db = new Database(db_path);
const row = db.query('SELECT data, creator, updated_at FROM bracket WHERE id = 1').get();
if (!row) { console.error('no bracket row'); process.exit(1); }

const stamp = Date.now();
const backup = `/root/server/4ascend-online/db/bracket_backup_${stamp}.json`;
fs.writeFileSync(backup, row.data);
console.log('backup ->', backup);

const state = JSON.parse(row.data);
const now = Date.now();
const targets = process.argv.slice(2).map((s) => {
    const [n, g] = s.split(':');
    return { node: n, group: g };
});

let changed = 0;
for (const node of state.nodes) {
    node.groups = Array.isArray(node.groups) ? node.groups : [];
    node.player_uuids = node.player_uuids && typeof node.player_uuids === 'object' ? node.player_uuids : {};
    node.results = node.results && typeof node.results === 'object' ? node.results : {};
    for (const key of Object.keys(node.results)) {
        const idx = Number(key);
        const group = node.groups[idx] || [];
        const member_uuids = group.map((n) => node.player_uuids[n]).filter(Boolean);
        const entry = node.results[key] || {};
        const wins = entry.wins && typeof entry.wins === 'object' ? entry.wins : {};
        const structural = group.length < 2 || Object.keys(wins).some((k) => !member_uuids.includes(k));
        const targeted = targets.some((t) => t.node === node.id && t.group === key);
        if (structural || targeted) {
            node.results[key] = { bo: entry.bo || 3, wins: {}, games: [], completed: false, winner_uuid: '', updated_at: now };
            changed += 1;
            console.log('cleared', node.id, 'group', key, structural ? '(structural)' : '(targeted)');
        }
    }
}

if (changed === 0) { console.log('no change'); process.exit(0); }

const new_data = JSON.stringify(state);
if (new_data.length > 65536) { console.error('data too large'); process.exit(1); }
db.query('UPDATE bracket SET data = ?, updated_at = ? WHERE id = 1').run(new_data, now);
console.log('updated', changed, 'entries, size', new_data.length);