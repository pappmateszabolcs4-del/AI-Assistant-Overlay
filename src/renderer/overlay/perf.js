// Overlay performance HUD (FPS + jank counters).
(function initOverlayPerfHud() {
  if (typeof __isDetachedPanelWindow !== 'undefined' && __isDetachedPanelWindow) return;
  if (typeof __isBlockWindow !== 'undefined' && __isBlockWindow) return;

  const { isDev } = require('./src/shared/app-env');
  if (!isDev()) {
    const blockEl = document.getElementById('block-perf');
    if (blockEl) blockEl.style.display = 'none';
    return;
  }

  const PERF_KEY = STORAGE_KEYS.OVERLAY_PERF_HUD;
  const toggleEl = document.getElementById('perfHudToggle');

  const hud = document.createElement('div');
  hud.id = 'perfHud';
  hud.className = 'perf-hud';
  hud.style.display = 'none';
  document.body.appendChild(hud);

  let enabled = false;
  let rafId = null;
  let lastFrameAt = 0;
  let lastReportAt = 0;
  let frameCount = 0;
  let totalMs = 0;
  let worstMs = 0;
  let jankCount = 0;
  const JANK_THRESHOLD_MS = 34;

  function readEnabled() {
    try {
      const raw = localStorage.getItem(PERF_KEY);
      if (raw === null) return false;
      return raw === '1' || raw === 'true';
    } catch (_) {
      return false;
    }
  }

  function writeEnabled(next) {
    try {
      localStorage.setItem(PERF_KEY, next ? '1' : '0');
    } catch (_) {}
  }

  function resetStats(now) {
    lastFrameAt = now;
    lastReportAt = now;
    frameCount = 0;
    totalMs = 0;
    worstMs = 0;
    jankCount = 0;
  }

  function renderHud(now) {
    const elapsed = Math.max(1, now - lastReportAt);
    const fps = Math.round((frameCount * 1000) / elapsed);
    const avgMs = frameCount > 0 ? Math.round(totalMs / frameCount) : 0;
    const label = (typeof t === 'function' && t().perfHudLabel) ? t().perfHudLabel : 'Performance HUD';
    hud.textContent = `${label}: ${fps} fps | avg ${avgMs} ms | jank ${jankCount} | max ${Math.round(worstMs)} ms`;
    try {
      fireAndForget(IPC_CHANNELS.OVERLAY_PERF_SAMPLE, {
        fps,
        avgMs,
        worstMs: Math.round(worstMs),
        jankCount,
        elapsedMs: Math.round(elapsed),
        sinceStartMs: Math.round(now),
        visibility: document.visibilityState || 'unknown',
        role: 'main'
      });
    } catch (_) {}
    resetStats(now);
  }

  function tick(now) {
    if (!enabled) return;
    const dt = Math.max(0, now - lastFrameAt);
    lastFrameAt = now;
    frameCount += 1;
    totalMs += dt;
    if (dt > worstMs) worstMs = dt;
    if (dt >= JANK_THRESHOLD_MS) jankCount += 1;

    if (now - lastReportAt >= 1000) {
      renderHud(now);
    }

    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (enabled) return;
    enabled = true;
    hud.style.display = 'block';
    const now = performance.now();
    resetStats(now);
    renderHud(now);
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    enabled = false;
    hud.style.display = 'none';
    if (rafId) {
      try { cancelAnimationFrame(rafId); } catch (_) {}
      rafId = null;
    }
  }

  function setEnabled(next) {
    const want = !!next;
    if (want === enabled) return;
    writeEnabled(want);
    if (want) start();
    else stop();
  }

  function syncToggle() {
    if (!toggleEl) return;
    toggleEl.checked = enabled;
  }

  if (toggleEl) {
    toggleEl.addEventListener('change', () => {
      setEnabled(!!toggleEl.checked);
    });
  }

  enabled = readEnabled();
  syncToggle();
  if (enabled) start();

  window.__updatePerfHudLabel = function updatePerfHudLabel() {
    if (!enabled) return;
    renderHud(performance.now());
  };
})();
