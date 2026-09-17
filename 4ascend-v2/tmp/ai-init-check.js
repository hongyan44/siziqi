(async () => {
  const out = {};
  const t0 = performance.now();
  out.init = await Promise.race([
    window.ai_worker.AI_INIT().then(() => 'ok').catch((e) => 'err:' + String(e)),
    new Promise((r) => setTimeout(() => r('timeout'), 55000)),
  ]);
  out.initMs = Math.round(performance.now() - t0);
  out.state = await Promise.race([
    window.ai_worker.ZERO_DEBUG_STATE().then((s) => ({ turnCount: s.turnCount, turnPlayer: s.turnPlayer })),
    new Promise((r) => setTimeout(() => r('timeout'), 10000)),
  ]);
  return JSON.stringify(out);
})()
