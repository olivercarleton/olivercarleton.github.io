/* Oliver Carleton - personal site
   Modules: nav, theme, hero graph, agent-ops console (FLIP kanban), stats, experience switcher,
   project simulations (canvas), skills filter, command palette, clipboard, reveal. No dependencies. */
(() => {
  'use strict';

  // ---------- utils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');

  let themeCache = null;
  const theme = () => {
    if (themeCache) return themeCache;
    const cs = getComputedStyle(document.documentElement);
    const g = n => cs.getPropertyValue(n).trim();
    themeCache = { fg: g('--fg'), muted: g('--fg-muted'), dim: g('--fg-dim'), line: g('--line'), accent: g('--accent'), accent2: g('--accent-2'), ok: g('--ok'), warn: g('--warn'), danger: g('--danger'), bg: g('--bg'), card: g('--bg-card') };
    return themeCache;
  };
  const invalidateTheme = () => { themeCache = null; };
  const themeListeners = [];
  const invalidateOnTheme = fn => { themeListeners.push(fn); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { invalidateTheme(); themeListeners.forEach(f => f()); });
  new MutationObserver(() => { invalidateTheme(); themeListeners.forEach(f => f()); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Canvas sizing with DPR, returns a getter for the logical size.
  function fitCanvas(canvas) {
    const state = { w: 0, h: 0, ctx: canvas.getContext('2d') };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      if (w === state.w && h === state.h) return;
      state.w = w; state.h = h;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    return state;
  }
  const alpha = (hex, a) => {
    if (hex.startsWith('rgb')) return hex.replace(/rgba?\(([^)]+)\)/, (m, inner) => { const p = inner.split(',').slice(0, 3).join(','); return `rgba(${p},${a})`; });
    const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  };

  // ---------- toast + clipboard ----------
  const toast = $('#toast'), toastMsg = $('#toastMsg');
  let toastT;
  function showToast(msg) {
    toastMsg.textContent = msg; toast.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('show'), 1800);
  }
  function copyText(text) {
    const done = () => showToast('Copied ' + text);
    const fallback = () => {
      const el = $('#emailText');
      if (el) { const range = document.createRange(); range.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); }
      showToast('Select and copy: ' + text);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  $$('[data-copy]').forEach(b => b.addEventListener('click', () => copyText(b.dataset.copy)));

  // ---------- nav ----------
  const nav = $('#nav'), progress = $('#progress'), navLinks = $('#navLinks');
  const onScroll = () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    nav.classList.toggle('scrolled', y > 8);
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (max > 0 ? clamp(y / max, 0, 1) * 100 : 0) + '%';
    tiltConsole();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  $('#navToggle').addEventListener('click', () => navLinks.classList.toggle('open'));
  navLinks.addEventListener('click', e => { if (e.target.tagName === 'A') navLinks.classList.remove('open'); });
  if (isMac) { const hk = $('.hint kbd'); if (hk) hk.textContent = '⌘'; }

  const sectionIds = ['work', 'projects', 'skills', 'education', 'contact'];
  const navMap = Object.fromEntries($$('[data-nav]').map(a => [a.dataset.nav, a]));
  const secObs = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { Object.values(navMap).forEach(a => a.classList.remove('active')); navMap[en.target.id]?.classList.add('active'); } });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sectionIds.forEach(id => { const s = document.getElementById(id); if (s) secObs.observe(s); });

  // ---------- theme ----------
  const root = document.documentElement;
  function currentTheme() {
    return root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }
  function setTheme(t) {
    root.dataset.theme = t; invalidateTheme();
    try { localStorage.setItem('oc-theme', t); } catch (e) { /* storage unavailable */ }
  }
  try { const saved = localStorage.getItem('oc-theme'); if (saved === 'light' || saved === 'dark') { root.dataset.theme = saved; invalidateTheme(); } } catch (e) { /* ignore */ }
  $('#themeBtn').addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));

  // ---------- hero headline intro ----------
  const headline = $('#headline');
  if (!reduced && headline && headline.animate) {
    const words = headline.textContent.split(' ');
    headline.textContent = '';
    words.forEach((w, i) => {
      const s = document.createElement('span'); s.className = 'word'; s.textContent = w + (i < words.length - 1 ? ' ' : '');
      headline.appendChild(s);
      s.animate([{ opacity: 0, transform: 'translateY(14px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 650, delay: 80 + i * 70, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
    });
  }

  // ---------- hero graph canvas ----------
  (function heroGraph() {
    const canvas = $('#heroCanvas'); if (!canvas) return;
    const st = fitCanvas(canvas);
    const N = 70, nodes = [];
    const mouse = { x: -1e4, y: -1e4 };
    const hero = $('.hero');
    hero.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -1e4; });
    const seed = () => { nodes.length = 0; for (let i = 0; i < N; i++) nodes.push({ x: Math.random() * st.w, y: Math.random() * st.h, vx: rand(-.18, .18), vy: rand(-.12, .12), r: rand(1, 2.2), p: Math.random() * 6.28 }); };
    seed();
    let pulses = [];
    let running = true, last = 0;
    const io = new IntersectionObserver(e => { running = e[0].isIntersecting; if (running) requestAnimationFrame(frame); }); io.observe(canvas);
    function frame(ts) {
      if (!running || document.hidden) { last = 0; if (running) requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(40, ts - last) : 16; last = ts;
      const { ctx, w, h } = st; const T = theme();
      ctx.clearRect(0, 0, w, h);
      if (nodes.length && (nodes[0].x > w * 1.2 || nodes[0].y > h * 1.2)) seed();
      const link = 120, k = dt / 16;
      for (const n of nodes) {
        n.x += n.vx * k; n.y += n.vy * k; n.p += 0.01 * k;
        if (n.x < -10) n.x = w + 10; if (n.x > w + 10) n.x = -10; if (n.y < -10) n.y = h + 10; if (n.y > h + 10) n.y = -10;
        const dx = mouse.x - n.x, dy = mouse.y - n.y, d2 = dx * dx + dy * dy;
        if (d2 < 220 * 220) { const f = 0.0009 * k; n.x += dx * f; n.y += dy * f; }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = nodes[i], b = nodes[j]; const dx = a.x - b.x, dy = a.y - b.y; const d = Math.hypot(dx, dy);
        if (d < link) { ctx.strokeStyle = alpha(T.accent2, (1 - d / link) * 0.28); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      for (const n of nodes) { ctx.fillStyle = alpha(T.accent2, 0.35 + 0.3 * Math.sin(n.p)); ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.283); ctx.fill(); }
      // pulses travelling along a random edge
      if (!reduced && Math.random() < 0.04 && pulses.length < 6) { const a = pick(nodes); let b = null, bd = 1e9; for (const o of nodes) { if (o === a) continue; const d = Math.hypot(a.x - o.x, a.y - o.y); if (d < link && d < bd) { bd = d; b = o; } } if (b) pulses.push({ a, b, t: 0 }); }
      pulses = pulses.filter(p => p.t < 1);
      for (const p of pulses) { p.t += 0.018 * k; const x = lerp(p.a.x, p.b.x, p.t), y = lerp(p.a.y, p.b.y, p.t); ctx.fillStyle = alpha(T.accent2, 0.9); ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 6.283); ctx.fill(); ctx.fillStyle = alpha(T.accent2, 0.25); ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.283); ctx.fill(); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  // ---------- console tilt ----------
  const consoleEl = $('#console');
  function tiltConsole() {
    if (!consoleEl || reduced || innerWidth < 720) return;
    const r = consoleEl.getBoundingClientRect();
    const t = clamp((r.top - innerHeight * 0.25) / (innerHeight * 0.6), 0, 1);
    consoleEl.style.setProperty('--tilt', (t * 7).toFixed(2) + 'deg');
  }

  // ---------- Agent Ops console ----------
  (function agentOps() {
    const board = $('#board'); if (!board) return;
    const cols = $$('.col', board);
    const log = $('#log'), mAgents = $('#mAgents'), mAgentsDelta = $('#mAgentsDelta'), mCycle = $('#mCycle');
    const clock = $('#clock');
    setInterval(() => { clock.textContent = new Date().toLocaleTimeString([], { hour12: false }); }, 1000);

    const pool = [
      ['Credit memo summarizer', 'Commercial banking'], ['KYC document classifier', 'Compliance'], ['Deal pipeline forecast', 'Investment banking'],
      ['Op-risk quarterly pipeline', 'Risk'], ['Annual review UI', 'Credit'], ['Vendor invoice extraction', 'Finance'], ['Call report drafting', 'Treasury'],
      ['Covenant monitoring agent', 'Credit'], ['Spreading model tuner', 'Credit'], ['Board pack generator', 'Risk'], ['Wire exception triage', 'Operations'],
      ['Policy Q&A agent', 'Risk'], ['Loan doc QA agent', 'Legal'], ['Deposit churn model', 'Treasury']
    ];
    let poolIdx = 0; const nextUse = () => pool[(poolIdx++) % pool.length];
    const cards = [];
    let uid = 1;
    function makeCard(stage, progress) {
      const [name, team] = nextUse();
      const el = document.createElement('div'); el.className = 'card';
      el.innerHTML = `<div class="t"></div><div class="m"><span class="tag"></span><span class="id"></span></div><div class="bar"><i></i></div>`;
      const c = { id: uid++, name, team, stage, progress, el };
      $('.t', el).textContent = name; $('.tag', el).textContent = team; $('.id', el).textContent = 'AGT-' + String(100 + c.id);
      el.style.setProperty('--p', progress + '%');
      cols[stage].appendChild(el);
      cards.push(c);
      return c;
    }
    const seeds = [[0, 10], [0, 40], [1, 30], [1, 75], [2, 60], [3, 100], [3, 100]];
    seeds.forEach(([s, p]) => makeCard(s, p));

    function snapshot() { const m = new Map(); cards.forEach(c => m.set(c, c.el.getBoundingClientRect())); return m; }
    function flip(before) {
      cards.forEach(c => {
        const a = before.get(c); if (!a) return; const b = c.el.getBoundingClientRect();
        const dx = a.left - b.left, dy = a.top - b.top; if (!dx && !dy) return;
        if (!c.el.animate || reduced) return;
        c.el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.2,.7,.2,1)' });
      });
    }
    function counts() { cols.forEach((col, i) => { $('.n', col).textContent = cards.filter(c => c.stage === i).length; }); }
    const lines = {
      0: c => `<b>intake</b> ${c.name} scoped with ${c.team}`,
      1: c => `<b>poc</b> ${c.name}: eval pass <span class="ok">${(88 + Math.random() * 10).toFixed(1)}%</span>`,
      2: c => `<b>deploy</b> ${c.name} v${1 + Math.floor(Math.random() * 4)}.${Math.floor(Math.random() * 9)} <span class="ok">live</span> for ${c.team}`,
      3: c => `<b>monitor</b> ${c.name} p95 ${(0.8 + Math.random() * 1.6).toFixed(2)}s, drift <span class="ok">none</span>`,
    };
    const misc = [
      () => `<b>train</b> fine-tune job finished, loss ${(0.2 + Math.random() * 0.3).toFixed(3)}`,
      () => `<b>cortex</b> snowflake agent refreshed 50+ deals`,
      () => `<b>monitor</b> quality check <span class="ok">passed</span> across 6 groups`,
      () => `<b>intake</b> working session with risk users, 3 new use cases`,
      () => `<b>alert</b> <span class="wn">latency spike</span> on spreading model, auto-scaled`,
    ];
    function pushLog(html) {
      const ln = document.createElement('div'); ln.className = 'ln';
      ln.innerHTML = `<span class="muted">${new Date().toLocaleTimeString([], { hour12: false })}</span> ${html}`;
      log.appendChild(ln); while (log.children.length > 9) log.removeChild(log.firstChild);
    }
    pushLog(`<b>boot</b> agent ops console connected`);
    cards.forEach(c => c.stage >= 2 && pushLog(lines[c.stage](c)));

    const s1 = Array.from({ length: 36 }, (_, i) => 1 + i * 0.05 + Math.random() * 0.25);
    const s2 = Array.from({ length: 36 }, () => 0);
    const sp1 = fitCanvas($('#spark1')), sp2 = fitCanvas($('#spark2'));
    function drawSpark(st, data, color, fill) {
      const { ctx, w, h } = st; ctx.clearRect(0, 0, w, h);
      const min = Math.min(...data), max = Math.max(...data), span = (max - min) || 1;
      const px = i => (i / (data.length - 1)) * (w - 2) + 1, py = v => h - 4 - ((v - min) / span) * (h - 10);
      ctx.beginPath(); data.forEach((v, i) => i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v)));
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
      if (fill) { ctx.lineTo(px(data.length - 1), h); ctx.lineTo(px(0), h); ctx.closePath(); ctx.fillStyle = alpha(color, 0.12); ctx.fill(); }
      const lx = px(data.length - 1), ly = py(data[data.length - 1]);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, 6.283); ctx.fill();
    }
    let week = 0;
    function metrics() {
      const T = theme();
      const prod = cards.filter(c => c.stage >= 2).length;
      mAgents.textContent = prod; s2.push(prod); s2.shift();
      week = Math.max(0, Math.min(prod, week + (Math.random() < 0.3 ? 1 : 0)));
      mAgentsDelta.textContent = `+${week} this week`;
      const last = s1[s1.length - 1]; s1.push(clamp(last + rand(-0.12, 0.14), 2.4, 3.4)); s1.shift();
      mCycle.textContent = s1[s1.length - 1].toFixed(1) + 'x';
      drawSpark(sp1, s1, T.accent2, true); drawSpark(sp2, s2, T.ok, true);
    }
    metrics(); counts();
    invalidateOnTheme(metrics);

    let visible = true;
    new IntersectionObserver(e => { visible = e[0].isIntersecting; }).observe(board);
    function tick() {
      if (!visible || document.hidden) return;
      const c = pick(cards);
      if (c.stage < 3) {
        c.progress = Math.min(100, c.progress + rand(14, 36));
        c.el.style.setProperty('--p', c.progress + '%');
        if (c.progress >= 100) {
          const before = snapshot();
          c.stage++; c.progress = c.stage === 3 ? 100 : 0;
          cols[c.stage].appendChild(c.el); c.el.classList.add('moving');
          setTimeout(() => c.el.classList.remove('moving'), 650);
          c.el.style.setProperty('--p', c.progress + '%');
          flip(before); pushLog(lines[c.stage](c)); counts();
        }
      } else if (cards.filter(x => x.stage === 3).length > 2 && Math.random() < 0.5) {
        // retire a monitored agent and open a new intake
        const before = snapshot();
        const anim = c.el.animate ? c.el.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.96)' }], { duration: 300, fill: 'forwards' }) : null;
        const finish = () => { c.el.remove(); cards.splice(cards.indexOf(c), 1); const n = makeCard(0, 5); n.el.animate && n.el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 400 }); flip(before); pushLog(lines[0](n)); counts(); };
        if (anim) anim.onfinish = finish; else finish();
      } else if (Math.random() < 0.5) pushLog(pick(misc)());
      metrics();
    }
    setInterval(tick, reduced ? 2600 : 1300);
  })();

  // ---------- count-up stats ----------
  (function counters() {
    const els = $$('[data-count]'); if (!els.length) return;
    const fmt = (v, suf) => { if (suf === 'M+') return Math.round(v) + 'M+'; return (suf === 'x' ? v.toFixed(1) : Math.round(v)) + (suf || ''); };
    els.forEach(el => { el.textContent = fmt(0, el.dataset.suffix); });
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return; io.unobserve(en.target);
      const el = en.target, target = +el.dataset.count, suf = el.dataset.suffix || '';
      if (reduced) { el.innerHTML = fmt(target, suf).replace(/([^0-9.]+)$/, '<span>$1</span>'); return; }
      const t0 = performance.now(), dur = 1300;
      (function step(now) { const t = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - t, 3); el.innerHTML = fmt(target * e, suf).replace(/([^0-9.]+)$/, '<span>$1</span>'); if (t < 1) requestAnimationFrame(step); })(t0);
    }), { threshold: 0.6 });
    els.forEach(el => io.observe(el));
  })();

  // ---------- spotlight ----------
  $$('.proj, .xp-panel').forEach(el => {
    el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--mx', '-200px'); el.style.setProperty('--my', '-200px'); });
  });

  // ---------- experience switcher ----------
  (function experience() {
    const items = $$('.xp-item'), panes = $$('.xp-pane');
    function show(id) {
      items.forEach(i => { const on = i.dataset.xp === id; i.classList.toggle('active', on); i.setAttribute('aria-selected', on); });
      panes.forEach(p => { p.classList.remove('active'); if (p.dataset.pane === id) { void p.offsetWidth; p.classList.add('active'); } });
    }
    items.forEach(i => i.addEventListener('click', () => show(i.dataset.xp)));
    $('.xp-list').addEventListener('keydown', e => {
      const idx = items.findIndex(i => i.classList.contains('active'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); const n = items[(idx + 1) % items.length]; n.focus(); show(n.dataset.xp); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); const n = items[(idx - 1 + items.length) % items.length]; n.focus(); show(n.dataset.xp); }
    });
  })();

  // ---------- project simulations ----------
  const VIZ = {};

  VIZ.ecg = (st, ro) => {
    const buf = []; let x = 0, phase = 0, bpm = 72;
    const beat = p => { // one cardiac cycle, p in [0,1)
      const g = (c, w, a) => a * Math.exp(-((p - c) ** 2) / (2 * w * w));
      return g(0.12, 0.025, 0.12) - g(0.22, 0.008, 0.1) + g(0.25, 0.012, 1) - g(0.29, 0.01, 0.25) + g(0.48, 0.045, 0.28);
    };
    return (dt, t) => {
      const { ctx, w, h } = st; const T = theme();
      const speed = 90 * dt / 1000; // px per second
      phase += (bpm / 60) * dt / 1000 * (0.6);
      for (let i = 0; i < Math.max(1, Math.round(speed)); i++) { buf.push(beat(phase % 1)); phase += 0.002; }
      while (buf.length > w) buf.shift();
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = alpha(T.line, 1); ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 24) { ctx.beginPath(); ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, h); ctx.stroke(); }
      for (let gy = 0; gy < h; gy += 24) { ctx.beginPath(); ctx.moveTo(0, gy + 0.5); ctx.lineTo(w, gy + 0.5); ctx.stroke(); }
      const grad = ctx.createLinearGradient(0, 0, w, 0); grad.addColorStop(0, alpha(T.ok, 0)); grad.addColorStop(0.7, alpha(T.ok, 0.9)); grad.addColorStop(1, T.ok);
      ctx.strokeStyle = grad; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.beginPath();
      const off = w - buf.length; buf.forEach((v, i) => { const y = h * 0.62 - v * h * 0.42; i ? ctx.lineTo(off + i, y) : ctx.moveTo(off + i, y); }); ctx.stroke();
      const lastY = h * 0.62 - buf[buf.length - 1] * h * 0.42;
      ctx.fillStyle = T.ok; ctx.beginPath(); ctx.arc(w - 1, lastY, 2.5, 0, 6.283); ctx.fill();
      if (Math.floor(t / 2000) !== Math.floor((t - dt) / 2000)) bpm = clamp(bpm + Math.round(rand(-3, 3)), 62, 84);
      ro.textContent = `simulated ECG · ${bpm} bpm · lead II`;
    };
  };

  VIZ.anomaly = (st, ro) => {
    const data = []; let flagged = 0, level = 50, trend = 0, tAcc = 0;
    for (let i = 0; i < 120; i++) data.push({ v: 50 + Math.sin(i / 9) * 6 + rand(-2, 2), a: false });
    return (dt, t) => {
      tAcc += dt;
      while (tAcc > 90) {
        tAcc -= 90; trend = clamp(trend + rand(-0.3, 0.3), -1.2, 1.2); level = clamp(level + trend * 0.4 + rand(-1.2, 1.2), 30, 70);
        let v = level + Math.sin(t / 900) * 4; const spike = Math.random() < 0.035; if (spike) v += rand(14, 22) * (Math.random() < 0.5 ? 1 : -1);
        const win = data.slice(-24).map(d => d.v); const mu = win.reduce((a, b) => a + b, 0) / win.length; const sd = Math.sqrt(win.reduce((a, b) => a + (b - mu) ** 2, 0) / win.length) || 1;
        const a = Math.abs(v - mu) > 2.6 * sd; if (a) flagged++;
        data.push({ v, a }); if (data.length > 120) data.shift();
      }
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const px = i => i / (data.length - 1) * w, py = v => h - (v - 10) / 70 * h;
      // rolling band
      const band = [];
      for (let i = 0; i < data.length; i++) { const win = data.slice(Math.max(0, i - 24), i + 1).map(d => d.v); const mu = win.reduce((a, b) => a + b, 0) / win.length; const sd = Math.sqrt(win.reduce((a, b) => a + (b - mu) ** 2, 0) / win.length) || 1; band.push([mu, sd]); }
      ctx.beginPath(); band.forEach(([m, s], i) => i ? ctx.lineTo(px(i), py(m + 2.6 * s)) : ctx.moveTo(px(i), py(m + 2.6 * s)));
      for (let i = band.length - 1; i >= 0; i--) ctx.lineTo(px(i), py(band[i][0] - 2.6 * band[i][1]));
      ctx.closePath(); ctx.fillStyle = alpha(T.accent2, 0.12); ctx.fill();
      ctx.beginPath(); band.forEach(([m], i) => i ? ctx.lineTo(px(i), py(m)) : ctx.moveTo(px(i), py(m))); ctx.strokeStyle = alpha(T.accent2, 0.5); ctx.setLineDash([3, 4]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); data.forEach((d, i) => i ? ctx.lineTo(px(i), py(d.v)) : ctx.moveTo(px(i), py(d.v))); ctx.strokeStyle = T.fg; ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.stroke();
      data.forEach((d, i) => { if (!d.a) return; ctx.fillStyle = T.danger; ctx.beginPath(); ctx.arc(px(i), py(d.v), 3.5, 0, 6.283); ctx.fill(); ctx.fillStyle = alpha(T.danger, 0.25); ctx.beginPath(); ctx.arc(px(i), py(d.v), 8, 0, 6.283); ctx.fill(); });
      ro.textContent = `rolling z-score · ${flagged} anomalies flagged · 2.6σ band`;
    };
  };

  VIZ.nodes = (st, ro) => {
    const src = ['CRM', 'Sheets', 'Email', 'POS', 'Calendar'], out = ['Forecast', 'Report', 'Alerts'];
    let packets = [], runs = 0, acc = 0;
    return (dt, t) => {
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const L = src.map((n, i) => ({ n, x: 36, y: (i + 1) / (src.length + 1) * h })), C = { x: w / 2, y: h / 2 }, R = out.map((n, i) => ({ n, x: w - 40, y: (i + 1) / (out.length + 1) * h }));
      ctx.lineWidth = 1; ctx.strokeStyle = alpha(T.fg, 0.14);
      const edge = (a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo((a.x + b.x) / 2, a.y, (a.x + b.x) / 2, b.y, b.x, b.y); ctx.stroke(); };
      L.forEach(a => edge(a, C)); R.forEach(b => edge(C, b));
      acc += dt; if (acc > 420) { acc = 0; const i = Math.floor(Math.random() * L.length); packets.push({ a: L[i], b: C, t: 0, leg: 0 }); }
      packets.forEach(p => { p.t += dt / 900; if (p.t >= 1 && p.leg === 0) { p.leg = 1; p.t = 0; p.a = C; p.b = pick(R); runs++; } });
      packets = packets.filter(p => !(p.leg === 1 && p.t >= 1));
      packets.forEach(p => { const u = p.t, a = p.a, b = p.b, mx = (a.x + b.x) / 2; const x = (1 - u) ** 3 * a.x + 3 * (1 - u) ** 2 * u * mx + 3 * (1 - u) * u * u * mx + u ** 3 * b.x; const y = (1 - u) ** 3 * a.y + 3 * (1 - u) ** 2 * u * a.y + 3 * (1 - u) * u * u * b.y + u ** 3 * b.y; ctx.fillStyle = T.accent2; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 6.283); ctx.fill(); });
      const box = (p, label, big) => { const bw = big ? 64 : 52, bh = big ? 30 : 20; ctx.fillStyle = T.card; ctx.strokeStyle = big ? T.accent : alpha(T.fg, 0.2); ctx.lineWidth = big ? 1.5 : 1; ctx.beginPath(); ctx.roundRect(p.x - bw / 2, p.y - bh / 2, bw, bh, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = big ? T.fg : T.muted; ctx.font = `${big ? 500 : 400} ${big ? 11 : 10}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, p.x, p.y + 0.5); };
      L.forEach(a => box(a, a.n)); R.forEach(b => box(b, b.n)); box(C, 'model', true);
      const pulse = 0.5 + 0.5 * Math.sin(t / 400); ctx.strokeStyle = alpha(T.accent2, 0.25 * pulse); ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(C.x - 36, C.y - 19, 72, 38, 9); ctx.stroke();
      ro.textContent = `${src.length} sources → model → ${out.length} outputs · ${runs} runs`;
    };
  };

  VIZ.vega = (st, ro) => {
    const K = 100, r = 0.02, Tm = 0.5; const phi = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    const vega = (S, sig) => { const d1 = (Math.log(S / K) + (r + sig * sig / 2) * Tm) / (sig * Math.sqrt(Tm)); return S * phi(d1) * Math.sqrt(Tm); };
    const hist = [];
    return (dt, t) => {
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const sig = 0.3 + 0.15 * Math.sin(t / 1800);
      const px = S => (S - 50) / 100 * (w - 20) + 10, py = v => h - 14 - v / 32 * (h - 30);
      ctx.strokeStyle = alpha(T.fg, 0.08); ctx.lineWidth = 1; for (let S = 60; S < 150; S += 20) { ctx.beginPath(); ctx.moveTo(px(S) + 0.5, 0); ctx.lineTo(px(S) + 0.5, h); ctx.stroke(); }
      ctx.strokeStyle = alpha(T.fg, 0.2); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(px(K), 0); ctx.lineTo(px(K), h); ctx.stroke(); ctx.setLineDash([]);
      if (Math.floor(t / 120) !== Math.floor((t - dt) / 120)) { hist.push(sig); if (hist.length > 14) hist.shift(); }
      hist.forEach((s, i) => { ctx.beginPath(); for (let S = 50; S <= 150; S += 2) { const y = py(vega(S, s)); S === 50 ? ctx.moveTo(px(S), y) : ctx.lineTo(px(S), y); } ctx.strokeStyle = alpha(T.accent2, 0.06 + 0.3 * i / hist.length); ctx.lineWidth = 1; ctx.stroke(); });
      ctx.beginPath(); let peakS = 50, peakV = 0; for (let S = 50; S <= 150; S += 1) { const v = vega(S, sig); if (v > peakV) { peakV = v; peakS = S; } const y = py(v); S === 50 ? ctx.moveTo(px(S), y) : ctx.lineTo(px(S), y); }
      ctx.strokeStyle = T.accent2; ctx.lineWidth = 2; ctx.stroke();
      ctx.lineTo(px(150), h); ctx.lineTo(px(50), h); ctx.closePath(); ctx.fillStyle = alpha(T.accent2, 0.1); ctx.fill();
      ctx.fillStyle = T.fg; ctx.beginPath(); ctx.arc(px(peakS), py(peakV), 3, 0, 6.283); ctx.fill();
      ctx.fillStyle = T.muted; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('K = 100', px(K), h - 3); ctx.textAlign = 'left'; ctx.fillText('S', px(146), h - 3);
      ro.textContent = `ν = Sφ(d₁)√T · σ = ${sig.toFixed(2)} · peak ${peakV.toFixed(1)} at S = ${peakS}`;
    };
  };

  VIZ.airfoil = (st, ro) => {
    // NACA 2412 geometry
    const m = 0.02, p = 0.4, tt = 0.12;
    const yt = x => 5 * tt * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = x => x < p ? m / (p * p) * (2 * p * x - x * x) : m / ((1 - p) ** 2) * ((1 - 2 * p) + 2 * p * x - x * x);
    const parts = []; let aoa = 4;
    return (dt, t) => {
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const chord = w * 0.5, ox = w * 0.25, oy = h * 0.55; aoa = 4 + 3 * Math.sin(t / 2600); const a = -aoa * Math.PI / 180;
      const tf = (x, y) => { const X = x * chord, Y = -y * chord; return [ox + X * Math.cos(a) - Y * Math.sin(a), oy + X * Math.sin(a) + Y * Math.cos(a)]; };
      // particles
      if (parts.length < 90) parts.push({ x: -10, y: rand(0, h), s: rand(40, 70) });
      ctx.lineWidth = 1;
      parts.forEach(pt => {
        const ds = pt.s * dt / 1000; const px0 = pt.x, py0 = pt.y; pt.x += ds;
        const xc = (pt.x - ox) / chord; // chord fraction
        if (xc > -0.15 && xc < 1.1) {
          const xcl = clamp(xc, 0, 1); const [, cy] = tf(xcl, yc(xcl)); const th = yt(xcl) * chord;
          const dyv = pt.y - cy; const dist = Math.abs(dyv); const infl = Math.exp(-Math.max(0, dist - th) / 26);
          const push = (dyv < 0 ? -1 : 1) * infl * (xc < 0.3 ? 1.2 : -0.6) * ds * 0.9;
          pt.y += push + (xc > 0 && xc < 1 ? -ds * Math.sin(a) * 0.35 * (dyv < 0 ? 1 : 0.3) : 0);
          if (xc > 0 && xc < 1 && dist < th) pt.y = cy + (dyv < 0 ? -th - 1 : th + 1);
        }
        ctx.strokeStyle = alpha(T.accent2, 0.35 + 0.4 * (1 - Math.min(1, Math.abs(pt.y - oy) / (h * 0.6)))); ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(pt.x, pt.y); ctx.stroke();
        if (pt.x > w + 10) { pt.x = -10; pt.y = rand(0, h); }
      });
      ctx.beginPath(); for (let i = 0; i <= 60; i++) { const x = i / 60; const [X, Y] = tf(x, yc(x) + yt(x)); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); } for (let i = 60; i >= 0; i--) { const x = i / 60; const [X, Y] = tf(x, yc(x) - yt(x)); ctx.lineTo(X, Y); } ctx.closePath();
      ctx.fillStyle = T.card; ctx.fill(); ctx.strokeStyle = T.fg; ctx.lineWidth = 1.4; ctx.stroke();
      ro.textContent = `NACA 2412 · α = ${aoa.toFixed(1)}° · streamlines, simulated`;
    };
  };

  VIZ.gridworld = (st, ro) => {
    const W = 8, H = 5, gamma = 0.9, noise = 0.2, living = -0.04;
    const walls = new Set(['2,1', '2,2', '5,2', '5,3']); const goal = '7,0'; const cliff = new Set(['3,4', '4,4', '5,4', '6,4']);
    let V = {}, k = 0, delta = 1, hold = 0;
    const key = (x, y) => `${x},${y}`;
    const reset = () => { V = {}; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) V[key(x, y)] = 0; k = 0; delta = 1; };
    reset();
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const term = s => s === goal || cliff.has(s);
    const R = s => s === goal ? 1 : cliff.has(s) ? -1 : living;
    const move = (x, y, d) => { const nx = x + d[0], ny = y + d[1]; if (nx < 0 || ny < 0 || nx >= W || ny >= H || walls.has(key(nx, ny))) return key(x, y); return key(nx, ny); };
    const qval = (x, y, di) => { const s = [[di, 1 - noise], [(di + 1) % 4, noise / 2], [(di + 3) % 4, noise / 2]]; return s.reduce((a, [d, p]) => { const n = move(x, y, dirs[d]); return a + p * (R(n) + gamma * (term(n) ? 0 : V[n])); }, 0); };
    const step = () => { const NV = {}; delta = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = key(x, y); if (walls.has(s) || term(s)) { NV[s] = 0; continue; } const best = Math.max(...dirs.map((_, i) => qval(x, y, i))); delta = Math.max(delta, Math.abs(best - V[s])); NV[s] = best; } V = NV; k++; };
    let acc = 0;
    return (dt, t) => {
      acc += dt; if (delta > 1e-3) { if (acc > 260) { acc = 0; step(); } } else { hold += dt; if (hold > 2500) { hold = 0; reset(); } }
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const cw = Math.min(w / W, h / H) * 0.92, ox = (w - cw * W) / 2, oy = (h - cw * H) / 2;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const s = key(x, y), X = ox + x * cw, Y = oy + y * cw;
        let fill;
        if (walls.has(s)) fill = alpha(T.fg, 0.18); else if (s === goal) fill = alpha(T.ok, 0.75); else if (cliff.has(s)) fill = alpha(T.danger, 0.65);
        else { const v = clamp(V[s], -1, 1); fill = v >= 0 ? alpha(T.ok, 0.08 + v * 0.7) : alpha(T.danger, 0.08 + -v * 0.7); }
        ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(X + 1.5, Y + 1.5, cw - 3, cw - 3, 4); ctx.fill();
        if (!walls.has(s) && !term(s) && k > 0) { let bi = 0, bv = -1e9; dirs.forEach((_, i) => { const q = qval(x, y, i); if (q > bv) { bv = q; bi = i; } }); const d = dirs[bi]; const cx = X + cw / 2, cy = Y + cw / 2; ctx.strokeStyle = alpha(T.fg, 0.85); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - d[0] * cw * 0.2, cy - d[1] * cw * 0.2); ctx.lineTo(cx + d[0] * cw * 0.2, cy + d[1] * cw * 0.2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + d[0] * cw * 0.2, cy + d[1] * cw * 0.2, 1.8, 0, 6.283); ctx.fillStyle = T.fg; ctx.fill(); }
      }
      ro.textContent = `value iteration · k = ${k} · Δ = ${delta.toFixed(4)} · γ = 0.9, noise 0.2`;
    };
  };

  VIZ.montecarlo = (st, ro) => {
    let pts = [], inside = 0;
    return (dt, t) => {
      const { ctx, w, h } = st; const T = theme();
      const n = reduced ? 8 : 30;
      for (let i = 0; i < n; i++) { const x = Math.random(), y = Math.random(); const inn = x * x + y * y <= 1; if (inn) inside++; pts.push([x, y, inn]); }
      if (pts.length > 24000) { pts = []; inside = 0; }
      ctx.clearRect(0, 0, w, h);
      const size = Math.min(w, h) - 16, ox = (w - size) / 2, oy = (h - size) / 2;
      ctx.strokeStyle = alpha(T.fg, 0.2); ctx.lineWidth = 1; ctx.strokeRect(ox + 0.5, oy + 0.5, size, size);
      ctx.beginPath(); ctx.arc(ox, oy + size, size, -Math.PI / 2, 0); ctx.strokeStyle = alpha(T.accent2, 0.7); ctx.stroke();
      const draw = (col, flag) => { ctx.fillStyle = col; ctx.beginPath(); for (const [x, y, inn] of pts) { if (inn !== flag) continue; ctx.rect(ox + x * size, oy + size - y * size, 1.3, 1.3); } ctx.fill(); };
      draw(alpha(T.accent2, 0.7), true); draw(alpha(T.fg, 0.35), false);
      const est = pts.length ? 4 * inside / pts.length : 0;
      ro.textContent = `π ≈ ${est.toFixed(4)} · n = ${pts.length.toLocaleString()} · err ${Math.abs(est - Math.PI).toFixed(4)}`;
    };
  };

  VIZ.delays = (st, ro) => {
    const base = Array.from({ length: 24 }, (_, hr) => 0.08 + 0.22 * Math.max(0, Math.sin((hr - 5) / 24 * Math.PI * 1.1)) ** 1.6 + (hr >= 16 && hr <= 20 ? 0.08 : 0));
    let day = 1, obs = [], pred = [], prog = 0;
    const newDay = () => { obs = base.map(b => clamp(b + rand(-0.06, 0.06) + (day % 3 === 0 ? 0.06 : 0), 0.02, 0.6)); pred = obs.map((o, i) => clamp(0.65 * o + 0.35 * base[i] + rand(-0.03, 0.03), 0.02, 0.6)); prog = 0; };
    newDay();
    return (dt, t) => {
      prog += dt / 2600; if (prog > 1.6) { day++; newDay(); }
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const n = 24, pad = 10, bw = (w - pad * 2) / n, py = v => h - 12 - v / 0.6 * (h - 28);
      ctx.fillStyle = T.muted; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      for (let i = 0; i < n; i++) {
        const x = pad + i * bw; const a = clamp(prog * 1.6 - i / n, 0, 1);
        ctx.fillStyle = alpha(T.fg, 0.18); const bh = (h - 12 - py(obs[i])) * a; ctx.fillRect(x + 1.5, h - 12 - bh, bw - 3, bh);
        if (i % 6 === 0) { ctx.fillStyle = T.muted; ctx.fillText(String(i).padStart(2, '0'), x + bw / 2, h - 2); }
      }
      ctx.beginPath(); const upto = Math.floor(clamp(prog, 0, 1) * (n - 1)); for (let i = 0; i <= upto; i++) { const x = pad + i * bw + bw / 2; i ? ctx.lineTo(x, py(pred[i])) : ctx.moveTo(x, py(pred[i])); }
      ctx.strokeStyle = T.accent2; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
      if (upto >= 0) { ctx.fillStyle = T.accent2; ctx.beginPath(); ctx.arc(pad + upto * bw + bw / 2, py(pred[upto]), 3, 0, 6.283); ctx.fill(); }
      const peak = obs.indexOf(Math.max(...obs));
      ro.textContent = `day ${day} · bars: observed delay rate · line: predicted · peak ${String(peak).padStart(2, '0')}:00`;
    };
  };

  VIZ.stress = (st, ro) => {
    const mats = [
      { n: '1045 steel', E: 205, sy: 530, su: 625, ef: 0.12, col: 'fg' },
      { n: '6061-T6 Al', E: 69, sy: 276, su: 310, ef: 0.17, col: 'accent2' },
      { n: 'Ti-6Al-4V', E: 114, sy: 880, su: 950, ef: 0.14, col: 'ok' },
    ];
    const sigma = (m, e) => { const ey = m.sy / m.E / 100; if (e <= ey) return m.E * e * 100; const u = (e - ey) / (m.ef - ey); return m.sy + (m.su - m.sy) * (1 - Math.pow(1 - clamp(u, 0, 1), 2.2)); };
    let prog = 0;
    return (dt, t) => {
      prog += dt / 3800; if (prog > 1.5) prog = 0;
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const px = e => 30 + e / 0.18 * (w - 40), py = s => h - 16 - s / 1000 * (h - 28);
      ctx.strokeStyle = alpha(T.fg, 0.08); ctx.lineWidth = 1; [250, 500, 750].forEach(s => { ctx.beginPath(); ctx.moveTo(30, py(s) + 0.5); ctx.lineTo(w - 10, py(s) + 0.5); ctx.stroke(); });
      ctx.fillStyle = T.muted; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; [250, 500, 750].forEach(s => ctx.fillText(s, 26, py(s))); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('ε', w - 16, h - 4); ctx.fillText('σ MPa', 4, 10);
      mats.forEach(m => {
        const end = Math.min(m.ef, clamp(prog, 0, 1) * 0.18); ctx.beginPath(); for (let e = 0; e <= end; e += 0.0015) { const y = py(sigma(m, e)); e === 0 ? ctx.moveTo(px(e), y) : ctx.lineTo(px(e), y); }
        ctx.strokeStyle = T[m.col]; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.stroke();
        if (end >= m.ef) { ctx.fillStyle = T[m.col]; ctx.beginPath(); ctx.arc(px(m.ef), py(sigma(m, m.ef)), 3, 0, 6.283); ctx.fill(); ctx.font = '9px JetBrains Mono, monospace'; ctx.fillText('x', px(m.ef) + 5, py(sigma(m, m.ef)) + 3); }
      });
      ro.textContent = `σ-ε · ${mats.map(m => m.n).join(', ')} · typical values`;
    };
  };

  VIZ.photo = (st, ro) => {
    const leds = [['red', 4.6], ['yellow', 5.1], ['green', 5.6], ['blue', 6.4], ['violet', 7.3]]; // 1e14 Hz
    const he = 4.136, phi = 1.6; // h/e in 1e-15 V s
    let pts = [], prog = 0;
    const regen = () => { pts = leds.map(([n, f]) => [f, he * f / 10 - phi + rand(-0.06, 0.06), n]); prog = 0; };
    regen();
    return (dt, t) => {
      prog += dt / 2400; if (prog > 2.2) regen();
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const px = f => 30 + (f - 4) / 4 * (w - 44), py = v => h - 18 - v / 1.6 * (h - 34);
      ctx.strokeStyle = alpha(T.fg, 0.08); ctx.lineWidth = 1; [0.5, 1, 1.5].forEach(v => { ctx.beginPath(); ctx.moveTo(30, py(v) + 0.5); ctx.lineTo(w - 10, py(v) + 0.5); ctx.stroke(); });
      ctx.fillStyle = T.muted; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; [0.5, 1, 1.5].forEach(v => ctx.fillText(v.toFixed(1), 26, py(v)));
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; [4, 5, 6, 7, 8].forEach(f => ctx.fillText(f + 'e14', px(f), h - 5)); ctx.textAlign = 'left'; ctx.fillText('Vₛ (V)', 4, 10);
      const shown = pts.filter((_, i) => prog > i * 0.18);
      shown.forEach(([f, v, n]) => { ctx.fillStyle = T.accent2; ctx.beginPath(); ctx.arc(px(f), py(v), 3.5, 0, 6.283); ctx.fill(); ctx.strokeStyle = alpha(T.fg, 0.3); ctx.beginPath(); ctx.moveTo(px(f), py(v) - 8); ctx.lineTo(px(f), py(v) + 8); ctx.stroke(); });
      let slope = 0, icpt = 0;
      if (shown.length >= 2) {
        const n = shown.length, sx = shown.reduce((a, p) => a + p[0], 0), sy = shown.reduce((a, p) => a + p[1], 0), sxx = shown.reduce((a, p) => a + p[0] * p[0], 0), sxy = shown.reduce((a, p) => a + p[0] * p[1], 0);
        slope = (n * sxy - sx * sy) / (n * sxx - sx * sx); icpt = (sy - slope * sx) / n;
        const fade = clamp(prog - 0.9, 0, 1); ctx.strokeStyle = alpha(T.ok, 0.9 * fade); ctx.lineWidth = 1.6; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(px(4), py(slope * 4 + icpt)); ctx.lineTo(px(8), py(slope * 8 + icpt)); ctx.stroke();
      }
      // slope is V per 1e14 Hz, so h = e * slope / 1e14
      const hJ = shown.length >= 2 ? (slope * 1e-14 * 1.602e-19) : 0;
      ro.textContent = shown.length >= 2 ? `stopping potential vs f · fit h ≈ ${(hJ * 1e34).toFixed(2)}e-34 J·s · φ ≈ ${(-icpt).toFixed(2)} eV` : 'photoelectric effect · collecting LED points';
    };
  };

  VIZ.list = (st, ro) => {
    let nodes = [3, 8, 12, 20], phase = 0, tacc = 0, newVal = 0, insertAt = 0, cursor = 0, op = 'traverse';
    return (dt, t) => {
      tacc += dt;
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const n = nodes.length, bw = 44, gap = (w - 40 - n * bw) / Math.max(1, n - 1), y = h * 0.42;
      const xs = nodes.map((_, i) => 20 + i * (bw + gap));
      if (op === 'traverse') { if (tacc > 420) { tacc = 0; cursor++; if (cursor >= n) { cursor = 0; op = 'insert'; newVal = Math.floor(rand(1, 30)); insertAt = nodes.findIndex(v => v > newVal); if (insertAt < 0) insertAt = n; phase = 0; } } }
      else if (op === 'insert') { phase += dt / 1400; if (phase >= 1) { nodes.splice(insertAt, 0, newVal); if (nodes.length > 7) nodes = nodes.slice(0, 4); op = 'traverse'; cursor = 0; tacc = 0; } }
      ctx.font = '500 12px JetBrains Mono, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const drawNode = (x, yy, v, hi, ghost) => { ctx.fillStyle = ghost ? alpha(T.accent2, 0.15) : T.card; ctx.strokeStyle = hi ? T.accent2 : alpha(T.fg, 0.25); ctx.lineWidth = hi ? 1.6 : 1; ctx.beginPath(); ctx.roundRect(x, yy - 14, bw, 28, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = hi ? T.fg : T.muted; ctx.fillText(v, x + bw * 0.38, yy + 0.5); ctx.strokeStyle = alpha(T.fg, 0.2); ctx.beginPath(); ctx.moveTo(x + bw * 0.74, yy - 14); ctx.lineTo(x + bw * 0.74, yy + 14); ctx.stroke(); ctx.fillStyle = hi ? T.accent2 : alpha(T.fg, 0.4); ctx.beginPath(); ctx.arc(x + bw * 0.87, yy, 2, 0, 6.283); ctx.fill(); };
      const arrow = (x1, y1, x2, y2, col) => { ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); const a = Math.atan2(y2 - y1, x2 - x1); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 6 * Math.cos(a - 0.4), y2 - 6 * Math.sin(a - 0.4)); ctx.lineTo(x2 - 6 * Math.cos(a + 0.4), y2 - 6 * Math.sin(a + 0.4)); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
      nodes.forEach((v, i) => {
        const x = xs[i]; const hi = op === 'traverse' && i === cursor;
        if (i < n - 1) {
          const rerouted = op === 'insert' && i === insertAt - 1 && phase > 0.5;
          arrow(x + bw * 0.87 + 3, y, xs[i + 1] - 2, y, rerouted ? alpha(T.fg, 0.08) : alpha(T.fg, 0.5));
        }
        drawNode(x, y, v, hi, false);
      });
      if (n) { const lx = xs[n - 1] + bw * 0.87 + 3; ctx.fillStyle = T.muted; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'left'; ctx.fillText('null', lx + 4, y + 0.5); }
      if (op === 'insert') {
        const e = 1 - Math.pow(1 - clamp(phase, 0, 1), 3);
        const targetX = insertAt < n ? (xs[insertAt] - (bw + gap) / 2) : xs[n - 1] + bw + gap * 0.6; const ny = y + (h * 0.38) * (1 - e);
        const nx = lerp(w / 2 - bw / 2, targetX, e);
        if (insertAt > 0) arrow(xs[insertAt - 1] + bw * 0.87 + 3, y, nx - 2, ny, alpha(T.accent2, 0.3 + 0.6 * e));
        if (insertAt < n) arrow(nx + bw * 0.87 + 3, ny, xs[insertAt] - 2, y, alpha(T.accent2, 0.3 + 0.6 * e));
        ctx.font = '500 12px JetBrains Mono, monospace'; ctx.textAlign = 'center'; drawNode(nx, ny, newVal, true, true);
      }
      ctx.fillStyle = T.muted; ctx.font = '10px JetBrains Mono, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(op === 'traverse' ? `head -> ... -> node[${cursor}] (${nodes[cursor]})` : `insert(${newVal}) at index ${insertAt}`, 20, h - 10);
      ro.textContent = op === 'traverse' ? `singly linked list · traverse O(n) · ${n} nodes` : `singly linked list · insert O(1) after find · ${n} nodes`;
    };
  };

  // ---- Work-section visuals ----
  VIZ.hub = (st, ro) => {
    const groups = ['Credit', 'Risk', 'Treasury', 'IB', 'Compliance', 'Ops'];
    let packets = [], acc = 0, served = 0;
    return (dt, t) => {
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
      const pos = groups.map((g, i) => { const a = -Math.PI / 2 + i / groups.length * Math.PI * 2; return { g, x: cx + Math.cos(a) * R * (w > h ? 1.6 : 1), y: cy + Math.sin(a) * R }; });
      ctx.lineWidth = 1; pos.forEach(p => { ctx.strokeStyle = alpha(T.fg, 0.12); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p.x, p.y); ctx.stroke(); });
      acc += dt; if (acc > 380) { acc = 0; const p = pick(pos); packets.push({ p, t: 0, out: true }); }
      packets.forEach(k => { k.t += dt / 800; if (k.t >= 1 && k.out) { k.out = false; k.t = 0; served++; } });
      packets = packets.filter(k => !(k.t >= 1 && !k.out));
      packets.forEach(k => { const u = k.out ? k.t : 1 - k.t; const x = lerp(cx, k.p.x, u), y = lerp(cy, k.p.y, u); ctx.fillStyle = k.out ? T.accent2 : T.ok; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 6.283); ctx.fill(); });
      ctx.font = '500 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      pos.forEach(p => { const bw = 74, bh = 24; ctx.fillStyle = T.card; ctx.strokeStyle = alpha(T.fg, 0.2); ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(p.x - bw / 2, p.y - bh / 2, bw, bh, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = T.muted; ctx.fillText(p.g, p.x, p.y + 0.5); });
      const pulse = 0.5 + 0.5 * Math.sin(t / 500);
      ctx.fillStyle = alpha(T.accent2, 0.12 + 0.1 * pulse); ctx.beginPath(); ctx.arc(cx, cy, 34, 0, 6.283); ctx.fill();
      ctx.fillStyle = T.card; ctx.strokeStyle = T.accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(cx - 42, cy - 16, 84, 32, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = T.fg; ctx.fillText('AI platform', cx, cy + 0.5);
      ro.textContent = `${groups.length} stakeholder groups · ${served} agent runs served`;
    };
  };

  VIZ.jobs = (st, ro) => {
    const N = 20; const jobs = Array.from({ length: N }, (_, i) => ({ start: rand(0, 0.6), len: rand(0.08, 0.3), done: 0 }));
    let cursor = 0, runs = 0;
    return (dt, t) => {
      cursor += dt / 9000; if (cursor > 1.15) { cursor = 0; jobs.forEach(j => { j.done = 0; }); }
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const left = 54, top = 10, rowH = (h - 24) / N, px = u => left + u * (w - left - 12);
      ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      jobs.forEach((j, i) => {
        const y = top + i * rowH + rowH / 2;
        ctx.fillStyle = T.muted; ctx.fillText('job-' + String(i + 1).padStart(2, '0'), left - 8, y);
        ctx.fillStyle = alpha(T.fg, 0.08); ctx.fillRect(px(0), y - rowH * 0.28, w - left - 12, rowH * 0.56);
        const prog = clamp((cursor - j.start) / j.len, 0, 1); if (prog >= 1 && !j.done) { j.done = 1; runs++; }
        if (prog > 0) { ctx.fillStyle = prog >= 1 ? alpha(T.ok, 0.75) : T.accent2; ctx.beginPath(); ctx.roundRect(px(j.start), y - rowH * 0.28, (px(j.start + j.len) - px(j.start)) * prog, rowH * 0.56, 2); ctx.fill(); }
      });
      ctx.strokeStyle = alpha(T.fg, 0.5); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(px(clamp(cursor, 0, 1)), top); ctx.lineTo(px(clamp(cursor, 0, 1)), h - 12); ctx.stroke(); ctx.setLineDash([]);
      ro.textContent = `quarterly close · ${jobs.filter(j => j.done).length}/${N} scripted jobs complete · ${runs} runs`;
    };
  };

  VIZ.funnel = (st, ro) => {
    const stages = ['Visitors', 'Sign-ups', 'Scans run', 'Paid'];
    let base = [1, 0.42, 0.26, 0.09], prog = 0, jitter = base.slice();
    return (dt, t) => {
      prog += dt / 2200; if (prog > 2.6) { prog = 0; jitter = base.map(b => b * rand(0.85, 1.12)); jitter[0] = 1; }
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const n = stages.length, gap = 8, bh = (h - 30 - gap * (n - 1)) / n, maxW = w - 120;
      ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle';
      stages.forEach((s, i) => {
        const e = clamp(prog - i * 0.25, 0, 1); const ease = 1 - Math.pow(1 - e, 3); const bw = maxW * jitter[i] * ease; const y = 15 + i * (bh + gap), x = 100 + (maxW - bw) / 2;
        ctx.fillStyle = alpha(T.accent2, 0.25 + 0.6 * (i / (n - 1))); ctx.beginPath(); ctx.roundRect(x, y, Math.max(2, bw), bh, 5); ctx.fill();
        ctx.fillStyle = T.muted; ctx.textAlign = 'right'; ctx.fillText(s, 90, y + bh / 2);
        if (e > 0.6) { ctx.fillStyle = T.fg; ctx.textAlign = 'center'; ctx.font = '500 11px JetBrains Mono, monospace'; ctx.fillText(Math.round(jitter[i] * 100) + '%', x + bw / 2, y + bh / 2); ctx.font = '11px Inter, system-ui, sans-serif'; }
      });
      ro.textContent = `conversion funnel · ${Math.round(jitter[n - 1] * 100)}% visitor to paid · illustrative`;
    };
  };

  VIZ.forecast = (st, ro) => {
    let hist = [], prog = 0;
    const regen = () => { hist = []; let v = 40; for (let i = 0; i < 40; i++) { v += rand(-3, 3.6) + Math.sin(i / 5) * 1.5; hist.push(v); } prog = 0; };
    regen();
    return (dt, t) => {
      prog += dt / 3000; if (prog > 1.8) regen();
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const N = 40, F = 16, px = i => 12 + i / (N + F - 1) * (w - 24), min = Math.min(...hist) - 10, max = Math.max(...hist) + 25, py = v => h - 14 - (v - min) / (max - min) * (h - 28);
      ctx.strokeStyle = alpha(T.fg, 0.08); for (let i = 0; i < 4; i++) { const y = 14 + i * (h - 28) / 3; ctx.beginPath(); ctx.moveTo(12, y + 0.5); ctx.lineTo(w - 12, y + 0.5); ctx.stroke(); }
      const shown = Math.floor(clamp(prog, 0, 1) * (N - 1));
      ctx.beginPath(); for (let i = 0; i <= shown; i++) i ? ctx.lineTo(px(i), py(hist[i])) : ctx.moveTo(px(i), py(hist[i])); ctx.strokeStyle = T.fg; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
      if (prog > 1) {
        const f = clamp((prog - 1) / 0.6, 0, 1); const last = hist[N - 1]; const slope = (hist[N - 1] - hist[N - 10]) / 9;
        const steps = Math.floor(f * F); const up = [], dn = [], mid = [];
        for (let k = 0; k <= steps; k++) { const m = last + slope * k * 0.8 + Math.sin(k / 3) * 1.2; const s = 2 + k * 1.1; mid.push(m); up.push(m + s); dn.push(m - s); }
        ctx.beginPath(); up.forEach((v, k) => k ? ctx.lineTo(px(N - 1 + k), py(v)) : ctx.moveTo(px(N - 1 + k), py(v))); for (let k = dn.length - 1; k >= 0; k--) ctx.lineTo(px(N - 1 + k), py(dn[k])); ctx.closePath(); ctx.fillStyle = alpha(T.accent2, 0.15); ctx.fill();
        ctx.beginPath(); mid.forEach((v, k) => k ? ctx.lineTo(px(N - 1 + k), py(v)) : ctx.moveTo(px(N - 1 + k), py(v))); ctx.strokeStyle = T.accent2; ctx.lineWidth = 1.8; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = alpha(T.fg, 0.3); ctx.beginPath(); ctx.moveTo(px(N - 1) + 0.5, 10); ctx.lineTo(px(N - 1) + 0.5, h - 10); ctx.stroke();
        ctx.fillStyle = T.muted; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('forecast', px(N - 1) + 5, 18);
      }
      ro.textContent = `client sales history → ${F}-week forecast with widening band · synthetic data`;
    };
  };

  VIZ.latency = (st, ro) => {
    const before = Array.from({ length: 24 }, (_, i) => 2.4 + Math.sin(i / 3) * 0.5 + rand(-0.2, 0.2));
    const after = before.map(v => v * 0.4 + rand(-0.08, 0.08));
    let prog = 0;
    return (dt, t) => {
      prog += dt / 3200; if (prog > 1.9) prog = 0;
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const n = 24, pad = 36, bw = (w - pad - 12) / n, py = v => h - 18 - v / 3.2 * (h - 36);
      ctx.font = '9px JetBrains Mono, monospace'; ctx.fillStyle = T.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; [1, 2, 3].forEach(s => { ctx.fillText(s + 's', pad - 6, py(s)); ctx.strokeStyle = alpha(T.fg, 0.08); ctx.beginPath(); ctx.moveTo(pad, py(s) + 0.5); ctx.lineTo(w - 12, py(s) + 0.5); ctx.stroke(); });
      for (let i = 0; i < n; i++) {
        const x = pad + i * bw, a = clamp(prog * 1.3 - i / n, 0, 1), b = clamp((prog - 0.8) * 1.3 - i / n, 0, 1);
        ctx.fillStyle = alpha(T.fg, 0.18); ctx.fillRect(x + 2, py(before[i] * a), bw - 4, h - 18 - py(before[i] * a));
        if (b > 0) { ctx.fillStyle = T.ok; ctx.fillRect(x + 2, py(after[i] * b), bw - 4, h - 18 - py(after[i] * b)); }
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = T.muted; ctx.fillText('query', pad, h - 5); ctx.fillStyle = T.ok; ctx.fillText('■ after', pad + 40, h - 5); ctx.fillStyle = alpha(T.fg, 0.4); ctx.fillText('■ before', pad + 92, h - 5);
      const red = 1 - after.reduce((a, b) => a + b, 0) / before.reduce((a, b) => a + b, 0);
      ro.textContent = `Snowflake query time · ${prog > 0.8 ? Math.round(red * 100) + '% faster after clustering + pruning' : 'baseline'} · illustrative`;
    };
  };

  VIZ.seismic = (st, ro) => {
    const NT = 28, NS = 160; const traces = [];
    const gen = () => { traces.length = 0; for (let k = 0; k < NT; k++) { const a = []; for (let i = 0; i < NS; i++) { let v = 0; [38, 72, 110, 140].forEach((r, j) => { const d = i - (r + Math.sin(k / 4 + j) * 6); v += Math.exp(-d * d / 18) * Math.cos(d * 0.9) * (1 - j * 0.15); }); v += rand(-0.08, 0.08); a.push(v); } traces.push(a); } };
    gen(); let scroll = 0;
    return (dt, t) => {
      scroll += dt / 40; if (scroll > NS) { scroll = 0; gen(); }
      const { ctx, w, h } = st; const T = theme(); ctx.clearRect(0, 0, w, h);
      const tw = (w - 24) / NT, amp = tw * 0.7, py = i => 8 + i / NS * (h - 16);
      ctx.lineWidth = 0.8;
      traces.forEach((tr, k) => {
        const x0 = 12 + k * tw + tw / 2; const reveal = Math.floor(clamp(scroll, 0, NS));
        ctx.beginPath(); ctx.moveTo(x0, py(0));
        for (let i = 0; i < reveal; i++) ctx.lineTo(x0 + Math.max(0, tr[i]) * amp, py(i));
        ctx.lineTo(x0, py(Math.max(0, reveal - 1))); ctx.closePath(); ctx.fillStyle = alpha(T.accent2, 0.55); ctx.fill();
        ctx.beginPath(); for (let i = 0; i < reveal; i++) { const x = x0 + tr[i] * amp; i ? ctx.lineTo(x, py(i)) : ctx.moveTo(x, py(i)); } ctx.strokeStyle = alpha(T.fg, 0.7); ctx.stroke();
      });
      ctx.fillStyle = T.muted; ctx.font = '9px JetBrains Mono, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('t ↓', 4, h - 4);
      ro.textContent = `SEG-Y wiggle traces, variable-area · ${NT} traces · synthetic reflectors`;
    };
  };

  (function runViz() {
    const canvases = $$('canvas[data-viz]'); if (!canvases.length) return;
    const sims = canvases.map(c => {
      const st = fitCanvas(c); const ro = c.parentElement.querySelector('[data-ro]') || document.createElement('span');
      const card = c.closest('.proj, .xp-pane'); let paused = false, visible = false;
      card.addEventListener('pointerenter', () => { paused = true; }); card.addEventListener('pointerleave', () => { paused = false; });
      const sim = { draw: VIZ[c.dataset.viz] ? VIZ[c.dataset.viz](st, ro) : null, st, get paused() { return paused; }, get visible() { return visible; }, set visible(v) { visible = v; }, t: 0 };
      new IntersectionObserver(e => { sim.visible = e[0].isIntersecting; }).observe(c);
      return sim;
    });
    let last = 0;
    function frame(ts) {
      const dt = last ? Math.min(50, ts - last) : 16; last = ts;
      if (!document.hidden) sims.forEach(s => { if (!s.draw || !s.visible) return; if (s.paused && s.t > 0) return; s.t += dt; try { s.draw(dt, s.t); } catch (e) { s.draw = null; } });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    invalidateOnTheme(() => { last = 0; });
  })();

  // ---------- skills filter + marquee ----------
  (function skills() {
    const keys = $$('.key'), projs = $$('.proj'), msg = $('#skillsMsg'), clear = $('#skillsClear');
    const norm = s => s.toLowerCase().replace(/\s+/g, '-');
    const active = new Set();
    function apply() {
      const hits = projs.map(p => { const tags = p.dataset.tags.split(/\s+/); return active.size === 0 || [...active].some(a => tags.includes(a)); });
      const shown = hits.filter(Boolean).length;
      projs.forEach((p, i) => {
        p.classList.toggle('dim', shown > 0 && !hits[i]);
        $$('.tags span', p).forEach(s => s.classList.toggle('hit', active.has(norm(s.textContent))));
      });
      clear.hidden = active.size === 0;
      const names = [...active].map(a => keys.find(k => norm(k.dataset.skill) === a)?.textContent || a).join(', ');
      msg.textContent = !active.size ? `No filter. Showing all ${projs.length} projects.`
        : shown ? `Showing ${shown} of ${projs.length} projects using ${names}.`
        : `No project tile is tagged ${names}. That work lives in the Texas Capital roles above.`;
    }
    keys.forEach(k => k.addEventListener('click', () => { const id = norm(k.dataset.skill); if (active.has(id)) active.delete(id); else active.add(id); k.classList.toggle('on', active.has(id)); apply(); }));
    clear.addEventListener('click', () => { active.clear(); keys.forEach(k => k.classList.remove('on')); apply(); });
    apply();
    const track = $('#marquee'); const names = keys.map(k => k.textContent);
    track.innerHTML = [...names, ...names].map(n => `<span>${n}</span>`).join('');
  })();

  // ---------- command palette ----------
  (function palette() {
    const box = $('#cmdk'), input = $('#cmdInput'), list = $('#cmdList'); if (!box) return;
    const ico = {
      sec: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
      proj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18"/></svg>',
      link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
      act: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 3-8 11h6l-1 7 8-11h-6z"/></svg>',
    };
    const items = [
      ...[['Work', 'work'], ['Projects', 'projects'], ['Skills', 'skills'], ['Education', 'education'], ['Contact', 'contact']].map(([l, id]) => ({ g: 'Sections', l, sub: '', i: 'sec', run: () => document.getElementById(id).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }) })),
      ...$$('.proj').map(p => ({ g: 'Projects', l: $('h3', p).textContent, sub: $('.role', p)?.textContent || '', kw: p.dataset.tags.replace(/-/g, ' '), i: 'proj', run: () => { p.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); p.animate && p.animate([{ boxShadow: '0 0 0 2px var(--accent-2)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1400 }); } })),
      ...[['Texas Capital, Associate', 'tc2'], ['Texas Capital, Analyst', 'tc1'], ['MediScope AI', 'ms'], ['Lambda AI Solutions', 'la'], ['TS Imagine', 'ts'], ['Ovation Data Services', 'ov']].map(([l, id]) => ({ g: 'Roles', l, sub: '', i: 'sec', run: () => { $(`.xp-item[data-xp="${id}"]`).click(); document.getElementById('work').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); } })),
      { g: 'Links', l: 'GitHub', sub: 'github.com/olivercarleton', i: 'link', run: () => window.open('https://github.com/olivercarleton', '_blank', 'noopener') },
      { g: 'Links', l: 'LinkedIn', sub: 'in/oliver-carleton', i: 'link', run: () => window.open('https://www.linkedin.com/in/oliver-carleton', '_blank', 'noopener') },
      { g: 'Links', l: 'Lambda AI Solutions', sub: 'lambdaaisolutions.com', i: 'link', run: () => window.open('https://www.lambdaaisolutions.com/', '_blank', 'noopener') },
      { g: 'Actions', l: 'Copy email', sub: 'ogcarleton@gmail.com', i: 'act', run: () => copyText('ogcarleton@gmail.com') },
      { g: 'Actions', l: 'Toggle theme', sub: 'light / dark', i: 'act', kb: 'T', run: () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark') },
      { g: 'Actions', l: 'Back to top', sub: '', i: 'act', run: () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }) },
    ];
    let filtered = items, sel = 0;
    const score = (q, s) => { // substring first, then every query token as a word prefix
      q = q.toLowerCase().trim(); s = s.toLowerCase(); if (!q) return 1;
      if (s.includes(q)) return 100 - Math.min(60, s.indexOf(q));
      const words = s.split(/[^a-z0-9+#]+/).filter(Boolean);
      const toks = q.split(/\s+/);
      let sc = 0; for (const tk of toks) { const w = words.find(x => x.startsWith(tk)); if (!w) return 0; sc += 10 + Math.min(5, tk.length); } return sc;
    };
    function render() {
      list.innerHTML = '';
      if (!filtered.length) { list.innerHTML = '<div class="cmdk-empty">Nothing matches. Try "projects", "snowflake" or "email".</div>'; return; }
      let g = null;
      filtered.forEach((it, i) => {
        if (it.g !== g) { g = it.g; const gh = document.createElement('div'); gh.className = 'cmdk-g'; gh.textContent = g; list.appendChild(gh); }
        const b = document.createElement('button'); b.type = 'button'; b.className = 'cmdk-it' + (i === sel ? ' sel' : '');
        b.innerHTML = `${ico[it.i]}<span>${it.l}</span>${it.sub ? `<span class="sub">${it.sub}</span>` : ''}${it.kb ? `<span class="kb"><kbd>${it.kb}</kbd></span>` : ''}`;
        b.addEventListener('click', () => choose(it)); b.addEventListener('pointermove', () => { if (sel !== i) { sel = i; render(); } });
        list.appendChild(b);
      });
      list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
    }
    function filter() {
      const q = input.value.trim();
      filtered = q ? items.map(it => ({ it, s: score(q, it.l + ' ' + it.sub + ' ' + (it.kw || '')) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.it) : items;
      sel = 0; render();
    }
    function open() { box.classList.add('open'); input.value = ''; filter(); setTimeout(() => input.focus(), 10); }
    function close() { box.classList.remove('open'); }
    function choose(it) { close(); it.run(); }
    $('#cmdOpen').addEventListener('click', open);
    box.addEventListener('click', e => { if (e.target === box) close(); });
    input.addEventListener('input', filter);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % filtered.length; render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + filtered.length) % filtered.length; render(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (filtered[sel]) choose(filtered[sel]); }
      else if (e.key === 'Escape') { close(); }
    });
    document.addEventListener('keydown', e => {
      const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName || '');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); box.classList.contains('open') ? close() : open(); }
      else if (e.key === '/' && !typing) { e.preventDefault(); open(); }
      else if (e.key === 'Escape' && box.classList.contains('open')) close();
      else if (e.key.toLowerCase() === 't' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !box.classList.contains('open')) setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  })();

  // ---------- reveal on scroll ----------
  (function reveal() {
    if (reduced) return;
    const targets = $$('.sec-h, .stats, .xp, .proj, .sk, .edu .box, .contact .wrap');
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); en.target.classList.remove('pre'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
    targets.forEach(t => { if (t.getBoundingClientRect().top > innerHeight) { t.classList.add('pre'); io.observe(t); } });
  })();

  onScroll();
})();
