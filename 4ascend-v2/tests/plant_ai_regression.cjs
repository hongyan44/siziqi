// Run with Node; uses production JS through a small loader for this repo's mixed CJS/ESM files.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const source = path.resolve(__dirname, '../js/global/fascend');
const cache = new Map();
function load(name) {
    const file = path.resolve(source, name);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const text = fs.readFileSync(file, 'utf8').replace(/^export\s*\{([^}]+)\};?/gm, 'module.exports = {$1};');
    new Function('require', 'module', 'exports', text)(p => p.startsWith('.') ? load(path.resolve(path.dirname(file), p)) : require(p), module, module.exports);
    return module.exports;
}
const { Board } = load('board.cjs');
const { State } = load('state.cjs');
const { GameNormal } = load('game_normal.cjs');
const { RandAIC, RandUnity } = load('rand.cjs');
const { STONE_ENUM:S, PLANT_ENUM:P, PLAYER_ENUM:R, ASCEND_ENUM:A, OVER_ENUM:O } = load('enum.cjs');
const stones=[S.NONE,S.BLACK,S.WHITE,S.BLACK_ASCEND,S.WHITE_ASCEND,S.BLACK_USED,S.WHITE_USED];
const plants=[P.NONE,P.ONE,P.TWO];
function setup(seed=1,first=0,night=false) {
    const b=new Board(9,9), s=new State(); s.turn_player=first?R.WHITE:R.BLACK;
    const g=new GameNormal(b,s,new RandAIC(seed),new RandUnity(seed+99)); g.always_overload=night;
    return {b,s,g};
}
function put(b,x,y,stone,plant=P.NONE) { b.set_stone(x,y,stone); b.set_plant(x,y,plant); return b.get_pos(x,y); }
function snapshot({b,s}) {
    return [s.turn_count,s.turn_player===R.WHITE?1:0,[A.NONE,A.START,A.END].indexOf(s.ascend_status),...s.hp,s.grow_count,s.unascend_charge,...s.unascend_chargef,[O.NONE,O.ENABLE,O.EXECUTE].indexOf(s.over_status),+s.just_unascend,...b.data.flatMap(p=>[stones.indexOf(p.stone),plants.indexOf(p.plant)])];
}
// Benchmark permits upgrading existing one-grass cells outside overload.
{
 const {b,g}=setup(); put(b,4,4,S.BLACK); const p=put(b,4,3,S.NONE,P.ONE);
 assert(g.p_scan_pos(false,false).includes(p));
}
// Overload's two bits are groups, not an unconditional guarantee of two completed double plants.
{
 const {b,s,g}=setup(); s.over_status=O.EXECUTE; s.unascend_chargef=[0,0];
 const points=[[0,0],[2,0],[4,0],[6,0]].map(([x,y])=>put(b,x,y,S.NONE));
 b.get_align=(x,y,color)=>x===0?(color===S.BLACK?[4,4]:[1,1]):x===2?(color===S.WHITE?[4,4]:[1,1]):[1,1];
 g.rand_aic={xor:n=>n-1}; g.rand_unity={shuffle:()=>{}};
 const result=g.p_scan_score(points,false,3,false,false,false);
 assert.equal(result.filter(p=>p.x===0).length,2);
 assert.equal(result.filter(p=>p.x===2).length,1);
 assert.equal(result.length,5);
 console.log('Benchmark score fixture: self 619/540, opponent 565/486, neutral 519/519; only one double is expected.');
}
// Base +50 exceeds the entire [0,19] jitter range. Preserve the original rule.
{
 let oldSites=0;
 for(let seed=1;seed<=500;++seed) {
    const {b,s,g}=setup(seed); for(let x=2;x<6;++x) put(b,x,4,S.BLACK_USED);
    s.ascend_status=A.END; s.unascend_charge=13; s.unascend_chargef=[0,0];
    const result=g.p_create(2); oldSites+=result.filter(p=>p.stone===S.BLACK_USED).length;
 }
 assert.equal(oldSites,1000);
 console.log('ASCEND sparse-board fixture: 1000/1000 plants select original sites, as required by benchmark +50.');
}
// Compare both production rule engines for every prefix of seeded legal games.
const probe=process.argv[2]; assert(probe,'pass compiled rules_probe path');
let seedRand=0x12345678;
function random(n) {seedRand=(Math.imul(seedRand,1664525)+1013904223)>>>0; return seedRand%n;}
const input=[], expected=[];
for(let seed=1;seed<=48;++seed) {
 const first=seed%2, night=seed%3===0, state=setup(seed,first,night), {b,s,g}=state, moves=[];
 for(let j=0;j<100;++j) {
    const color=s.turn_player===R.BLACK?S.BLACK:S.WHITE;
    const legal=b.data.filter(p=>g.valid(p.x,p.y,color)); if(!legal.length)break;
    const tactical=legal.filter(p=>b.get_ascend(p.x,p.y,color));
    const pool=tactical.length&&random(3)?tactical:legal;
    const p=pool[random(pool.length)]; const index=p.y*9+p.x; moves.push(index);
    assert(g.ed_tr_1(p.x,p.y)); g.ed_as_1(); g.ed_as_2(); g.ed_tr_2(); g.ed_pl_1(); g.ed_as_3();
    input.push([seed,seed+99,first,1,+night,moves.length,...moves].join(' ')); expected.push(snapshot(state));
    if(g.ed_win())break;
 }
}
const run=spawnSync(probe,['step'],{input:input.join('\n')+'\n',encoding:'utf8',maxBuffer:32*1024*1024});
assert.equal(run.status,0,run.stderr);
const actual=run.stdout.trim().split('\n').map(l=>l.trim().split(/\s+/).map(Number));
assert.equal(actual.length,expected.length);
for(let i=0;i<expected.length;++i) assert.deepEqual(actual[i],expected[i],`JS/C++ divergence at case ${i}: ${input[i]}`);
console.log(`PASS: candidate/weight regressions and ${expected.length} JS/C++ state comparisons (normal/night, both first players).`);
// Explicit cooldown/mask cases: an eligible color may have no USED cells.
const refreshInput=[], refreshExpected=[];
for(let fast0 of [0,5]) for(let fast1 of [0,5]) for(let charge of [0,13,25]) for(let night of [false,true]) {
 const state=setup(17,0,night), {b,s,g}=state;
 put(b,0,0,S.BLACK); put(b,8,8,S.WHITE);
 for(let x=2;x<6;++x) put(b,x,4,S.WHITE_USED);
 put(b,1,0,S.NONE,P.ONE); put(b,7,8,S.NONE,P.TWO);
 s.turn_count=30; s.ascend_status=A.END; s.unascend_charge=charge;
 s.unascend_chargef=[fast0,fast1];
 const data=snapshot(state);
 refreshInput.push([17,116,0,1,+night,s.turn_count,0,2,s.grow_count,charge,fast0,fast1,0,0,...data.slice(11)].join(' '));
 g.ed_pl_1(); refreshExpected.push(snapshot(state));
}
const refresh=spawnSync(probe,['refresh'],{input:refreshInput.join('\n')+'\n',encoding:'utf8'});
assert.equal(refresh.status,0,refresh.stderr);
refresh.stdout.trim().split('\n').forEach((line,i)=>assert.deepEqual(line.trim().split(/\s+/).map(Number),refreshExpected[i],`cooldown fixture ${i}`));
console.log(`PASS: ${refreshExpected.length} explicit cooldown/ASCEND-mask cases.`);
module.exports={setup,put,snapshot,load};
