(async () => {
  const c = document.getElementById('canvas_board');
  const fire = (gx, gy) => {
    const r = c.getBoundingClientRect();
    const x = r.left + (gx + 0.5) * (r.width / 9);
    const y = r.top + (gy + 0.5) * (r.height / 9);
    c.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 }));
    c.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 0 }));
  };
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const seq = [[3,3],[5,5],[3,5],[5,3],[2,2],[6,6],[2,6],[6,2]];
  const log = [];
  let triggers = 0;
  for (const [gx, gy] of seq) {
    const s0 = await window.ai_worker.ZERO_DEBUG_STATE();
    if (s0.turnPlayer !== 0) { log.push({ skip: [gx, gy], why: 'not my turn' }); continue; }
    fire(gx, gy); await wait(400); fire(gx, gy);
    for (let i = 0; i < 24; i++) {
      await wait(1000);
      const s = await window.ai_worker.ZERO_DEBUG_STATE();
      if (s.turnPlayer === 0) break;
    }
    const s = await window.ai_worker.ZERO_DEBUG_STATE();
    const sr = await window.ai_worker.ZERO_DEBUG_SEARCH();
    if (sr && sr.handicapOverride) triggers++;
    log.push({
      my: [gx, gy], turnCount: s.turnCount, hp: s.hp,
      aiAction: sr ? sr.action : null,
      handicap: sr ? !!sr.handicapOverride : null,
      level: sr ? (sr.handicapLevel || null) : null,
      reason: sr ? (sr.handicapReason || null) : null,
    });
  }
  return JSON.stringify({ triggers, log }, null, 1);
})()
