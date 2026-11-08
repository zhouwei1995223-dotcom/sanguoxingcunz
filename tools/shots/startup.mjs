// 启动耗时：CPU 降速 THROTTLE 倍，从打开到主界面（或新手试炼）的长任务和函数采样。
// NOMINIFY=1 npm run build 后：ROOT=dist/xhs Q='?skip=1' node tools/shot.mjs startup
export default async function ({ page, wait }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE || 4) });
  await page.addInitScript(() => {
    window.__long = []; window.__t0 = performance.now();
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
    window.__marks = [];
    window.__taskT = []; window.__slow = []; let lastF = 0;
    const tick = () => { const g = window.__game; const nowF = performance.now(); if (lastF && nowF - lastF > 150) window.__slow.push([Math.round(lastF), Math.round(nowF - lastF), g && g.scene && g.scene.constructor.name, window.__taskT.length, g && g.dialogs.map((d) => d.constructor.name).join('/')]); lastF = nowF;
      const sc = g && g.scene; if (sc && sc.tasks) sc.tasks.forEach((f, k) => { if (!f.__w) { const w = function () { const t = performance.now(); f(); window.__taskT.push([String(f).replace(/\s+/g, ' ').slice(6, 46), Math.round(performance.now() - t)]); }; w.__w = 1; sc.tasks[k] = w; } }); const n = g && g.scene && g.scene.constructor.name; const last = window.__marks[window.__marks.length - 1]; if (n && (!last || last[0] !== n)) window.__marks.push([n, Math.round(performance.now())]); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
  await page.reload();
  await page.waitForFunction(() => { const n = window.__game?.scene?.constructor.name; return n === 'HomeScene' || n === 'BattleScene'; }, null, { timeout: 60000 });
  await wait(1500);
  const { profile } = await cdp.send('Profiler.stop');
  const r = await page.evaluate(() => ({ slow: window.__slow, tasks: window.__taskT, marks: window.__marks, long: window.__long.filter((x) => x[1] > 100) }));
  console.log('scenes', JSON.stringify(r.marks));
  console.log('loading tasks', JSON.stringify(r.tasks));
  console.log('slow frames [start, ms, scene, tasksDone, dialogs]', JSON.stringify(r.slow));
  console.log('long tasks >100ms', JSON.stringify(r.long));
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = {}; const dt = profile.timeDeltas; let i = 0;
  for (const s of profile.samples) { const n = byId.get(s); const k = (n.callFrame.functionName || '(anon)') + ':' + n.callFrame.lineNumber; self[k] = (self[k] || 0) + (dt[i++] || 0) / 1000; }
  // 关键函数的含子调用耗时
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const incl = {}; const want = (process.env.FNS || 'buildAtlas,initAudio,ensureSheet,ensureCombo,loadSave,cloudPull,route,HomeScene,drawXuanTexture,paintInkBg,update').split(',');
  i = 0;
  for (const s of profile.samples) { const d = (dt[i++] || 0) / 1000; const seen = new Set(); let id = s; while (id) { const n = byId.get(id); const f = n.callFrame.functionName; if (want.includes(f) && !seen.has(f)) { seen.add(f); incl[f] = (incl[f] || 0) + d; } id = parent.get(id); } }
  // 每个长任务里耗时最多的函数（含子调用，按调用栈从上往下取前 3 层有名字的）
  {
    const t0 = await page.evaluate(() => performance.timeOrigin);
    let ts = profile.startTime; const rows = [];
    profile.samples.forEach((sid, k) => { ts += dt[k]; rows.push([ts / 1000 - t0, sid]); });
    for (const [st, du] of r.long.filter((x) => x[1] > 300)) {
      const acc = {};
      for (const [tm, sid] of rows) { if (tm < st || tm > st + du) continue; let id = sid; const names = []; while (id) { const n = byId.get(id); if (n.callFrame.functionName) names.push(n.callFrame.functionName); id = parent.get(id); } for (const nm of new Set(names)) acc[nm] = (acc[nm] || 0) + 1; }
      console.log('task@' + st, du + 'ms:', Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => k + '=' + v).join(' '));
    }
  }
  // 主界面第一帧：只在 HomeScene 刚出现时采样太难对齐，改为统计调用栈里含 HomeScene.update 的样本
  {
    const homeNodes = new Set(profile.nodes.filter((n) => n.callFrame.functionName === 'update' && /HomeScene|homeScene/.test(n.callFrame.url + (byId.get(parent.get(n.id))?.callFrame.functionName || ''))).map((n) => n.id));
    const acc = {}; let k2 = 0, tot = 0;
    for (const sid of profile.samples) { const d = (dt[k2++] || 0) / 1000; let id = sid; const names = []; let inHome = false; while (id) { const n = byId.get(id); if (n.callFrame.functionName === 'update' && n.callFrame.lineNumber === Number(process.env.HOMELINE || -1)) inHome = true; names.push(n.callFrame.functionName + ':' + n.callFrame.lineNumber); id = parent.get(id); } if (!inHome) continue; tot += d; for (const nm of new Set(names)) acc[nm] = (acc[nm] || 0) + d; }
    if (tot) console.log('home update total', Math.round(tot) + 'ms;', Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => k + '=' + Math.round(v)).join(' '));
  }
  console.log('inclusive', JSON.stringify(Object.fromEntries(Object.entries(incl).map(([k, v]) => [k, Math.round(v)]))));
  Object.entries(self).filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(program)')).sort((a, b) => b[1] - a[1]).slice(0, 18).forEach(([k, v]) => console.log(Math.round(v) + 'ms', k));
}
