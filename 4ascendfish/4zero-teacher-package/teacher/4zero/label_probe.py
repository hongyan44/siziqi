"""标签侧 P0：静态值 vs 深度4搜索值，谁更能预测终局？(n≈1000)
校准表是关键：如果 v=+0.4 实际只有 55% 胜率，那它当标签就是错的。"""
import json, math, subprocess, sys
import numpy as np
ROOT='/nnue-engine'; BIN=f'{ROOT}/fascend/target/release/examples/arena'
# 用法: label_probe.py [模型 ...]   —— 不给则用现役 v9.qad.bin
MODELS = sys.argv[1:] or [f'{ROOT}/distill/v9.qad.bin']
rows=[json.loads(l) for l in open(f'{ROOT}/web/games.jsonl')]
games=[r for r in rows if r['winner'] in ('a','b')]
print('games', len(games))
class A:
    def __init__(s, model):
        s.p=subprocess.Popen([BIN, model],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True,bufsize=1)
        s.p.stdin.write('{"t":"ping"}\n'); s.p.stdin.flush(); s.p.stdout.readline()
    def ask(s,mv,d):
        s.p.stdin.write(json.dumps({'t':'move','moves':mv,'time_ms':300,'depth':d})+'\n'); s.p.stdin.flush()
        return json.loads(s.p.stdout.readline())
def probe(model):
  ar=A(model); recs=[]
  for r in games:
    g=r['game']; n=len(g['moves'])
    if n < 14: continue
    wc = 0 if r['winner']==r['black'] else 1
    step=max(1,(n-10)//25)
    idx=list(range(9,n,step))[:25]
    mv=[]
    for i,m in enumerate(g['moves']):
        if i in idx:
            tp = 0 if i%2==0 else 1
            out = 1.0 if wc==tp else -1.0
            d1=ar.ask(mv,1); d4=ar.ask(mv,4)
            recs.append((d1.get('score',0), d4.get('score',0), out))
        mv.append(m['mv'])
  try: ar.p.stdin.close()
  except Exception: pass
  return np.array(recs,float)
def pear(u,v):
    u=u-u.mean(); v=v-v.mean(); return float((u*v).sum()/math.sqrt((u*u).sum()*(v*v).sum()))
def spear(u,v):
    return pear(np.argsort(np.argsort(u)).astype(float), np.argsort(np.argsort(v)).astype(float))
for MODEL in MODELS:
  a = probe(MODEL)
  print(f'\n==== {MODEL.split("/")[-1]}  样本 {len(a)} ====')
  c1=np.clip(a[:,0],-4000,4000)/4000; c4=np.clip(a[:,1],-4000,4000)/4000; y=a[:,2]
  for nm,c in (('depth1(静态)',c1),('depth4(搜索)',c4)):
    print(f'  {nm}: pear {pear(c,y):+.3f}  spear {spear(c,y):+.3f}  方向 {100*((c>0)==(y>0)).mean():.1f}%')
  print('  校准（每桶实际胜率，n>=25）:')
  for nm,c in (('depth1',c1),('depth4',c4)):
    print('   ', nm, end=' ')
    edges=[-1.01,-0.6,-0.3,-0.1,0.1,0.3,0.6,1.01]
    for lo,hi in zip(edges,edges[1:]):
        m=(c>=lo)&(c<hi)
        if m.sum()>=25: print(f'[{lo:+.1f},{hi:+.1f})={100*(y[m]>0).mean():4.0f}%({m.sum()})', end=' ')
        else: print(f'[{lo:+.1f},{hi:+.1f})=--', end=' ')
    print()
