// Visual debug map for display/layout diagnostics.
(function initDebugMap() {
  if (typeof __isDetachedPanelWindow !== 'undefined' && __isDetachedPanelWindow) return;
  if (typeof __isBlockWindow !== 'undefined' && __isBlockWindow) return;

  const { isDev } = require('../../shared/app-env');
  if (!isDev()) {
    const blockEl = document.getElementById('block-debug-map');
    if (blockEl) blockEl.style.display = 'none';
    const overlayEl = document.getElementById('debugMapOverlay');
    if (overlayEl) overlayEl.style.display = 'none';
    return;
  }

  const overlayEl = document.getElementById('debugMapOverlay');
  const toggleBtn = document.getElementById('debugMapToggleBtn');
  const refreshBtn = document.getElementById('debugMapRefreshBtn');
  const closeBtn = document.getElementById('debugMapCloseBtn');
  const titleEl = document.getElementById('debugMapTitle');
  const issuesTitleEl = document.getElementById('debugMapIssuesTitle');
  const issuesListEl = document.getElementById('debugMapIssuesList');
  const canvas = document.getElementById('debugMapCanvas');
  const panelEl = overlayEl ? overlayEl.querySelector('.debug-map-panel') : null;
  const headerEl = overlayEl ? overlayEl.querySelector('.debug-map-header') : null;

  if (!overlayEl || !toggleBtn || !canvas || !issuesListEl || !panelEl || !headerEl) return;

  let visible = false;
  let lastMap = null;
  let dragState = null;

  const windowColors = {
    overlay: '#5b9eff',
    'note-panel': '#7fd1ff',
    'info-panel': '#ffb347',
    detached: '#ff7eb6',
    pinned: '#b28dff',
    block: '#7fd1b9',
    other: '#d2d6dc'
  };

  function setOverlayVisible(next) {
    visible = !!next;
    overlayEl.style.display = visible ? 'block' : 'none';
    updateDebugMapText();
    if (visible) {
      centerPanel();
      requestAndRender();
    }
  }
  
  on(window, 'resize', () => {
    if (!visible) return;
    centerPanel();
    requestAndRender();
  });

  function centerPanel() {
    if (!panelEl) return;
    const panelRect = panelEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(10, Math.round((vw - panelRect.width) / 2));
    const top = Math.max(10, Math.round((vh - panelRect.height) / 2));
    panelEl.style.left = `${left}px`;
    panelEl.style.top = `${top}px`;
  }

  function updateDebugMapText() {
    const labels = (typeof t === 'function') ? t() : {};
    const labelText = labels.debugMapLabel || '🧭 Debug map';
    const showText = labels.debugMapShow || '🧭 Show debug map';
    const hideText = labels.debugMapHide || 'Hide debug map';
    const titleText = labels.debugMapTitle || '🧭 Display debug map';
    const refreshText = labels.debugMapRefresh || '↻ Refresh';
    const issuesText = labels.debugMapIssuesTitle || 'Issues';

    const labelEl = document.getElementById('debugMapLabel');
    if (labelEl) labelEl.textContent = labelText;
    if (toggleBtn) toggleBtn.textContent = visible ? hideText : showText;
    if (titleEl) titleEl.textContent = titleText;
    if (refreshBtn) refreshBtn.textContent = refreshText;
    if (issuesTitleEl) issuesTitleEl.textContent = issuesText;
  }

  window.__updateDebugMapText = updateDebugMapText;

  function issueLabel(issue) {
    if (!issue || typeof issue !== 'object') return '';
    let suffix = '';
    if (issue.key) suffix = ` (${issue.key})`;
    else if (issue.displayId != null) suffix = ` (display ${issue.displayId})`;
    return `${issue.code || 'issue'}${suffix}`;
  }

  function renderIssues(map) {
    issuesListEl.innerHTML = '';
    const labels = (typeof t === 'function') ? t() : {};
    if (!map || !Array.isArray(map.issues)) {
      const empty = document.createElement('div');
      empty.className = 'debug-map-issue-item ok';
      empty.textContent = labels.debugMapUnavailable || 'Debug map not available.';
      issuesListEl.appendChild(empty);
      return;
    }
    if (map.issues.length === 0) {
      const ok = document.createElement('div');
      ok.className = 'debug-map-issue-item ok';
      ok.textContent = labels.debugMapNoIssues || 'No issues detected.';
      issuesListEl.appendChild(ok);
      return;
    }

    map.issues.forEach((issue) => {
      const item = document.createElement('div');
      item.className = 'debug-map-issue-item';
      item.textContent = issueLabel(issue);
      issuesListEl.appendChild(item);
    });
  }

  function getWindowColor(key) {
    if (!key) return windowColors.other;
    if (key === 'overlay') return windowColors.overlay;
    if (key === 'note-panel') return windowColors['note-panel'];
    if (key === 'info-panel') return windowColors['info-panel'];
    if (key.startsWith('detached:')) return windowColors.detached;
    if (key.startsWith('pinned:')) return windowColors.pinned;
    if (key.startsWith('block:')) return windowColors.block;
    return windowColors.other;
  }

  function resizeCanvasToHost(ctx) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: rect.width, height: rect.height };
  }

  function renderMap(map) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = resizeCanvasToHost(ctx);
    ctx.clearRect(0, 0, width, height);

    if (!map || !Array.isArray(map.displays) || map.displays.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '12px Segoe UI, sans-serif';
      ctx.fillText('No display data', 12, 22);
      return;
    }

    const boundsList = map.displays
      .map((d) => d && d.bounds)
      .filter((b) => b && Number.isFinite(b.x) && Number.isFinite(b.y));

    if (!boundsList.length) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    boundsList.forEach((b) => {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });

    const padding = 12;
    const virtualW = Math.max(1, maxX - minX);
    const virtualH = Math.max(1, maxY - minY);
    const scale = Math.min((width - padding * 2) / virtualW, (height - padding * 2) / virtualH);
    const offsetX = padding + Math.max(0, (width - padding * 2 - virtualW * scale) / 2);
    const offsetY = padding + Math.max(0, (height - padding * 2 - virtualH * scale) / 2);

    function toScreenRect(rect) {
      return {
        x: offsetX + (rect.x - minX) * scale,
        y: offsetY + (rect.y - minY) * scale,
        w: rect.width * scale,
        h: rect.height * scale
      };
    }

    map.displays.forEach((display) => {
      if (!display || !display.bounds) return;
      const outer = toScreenRect(display.bounds);
      ctx.strokeStyle = display.isPrimary ? 'rgba(91, 158, 255, 0.9)' : 'rgba(145, 170, 210, 0.65)';
      ctx.lineWidth = 2;
      ctx.strokeRect(outer.x, outer.y, outer.w, outer.h);

      if (display.workArea) {
        const inner = toScreenRect(display.workArea);
        ctx.fillStyle = 'rgba(91, 158, 255, 0.08)';
        ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
        ctx.strokeStyle = 'rgba(91, 158, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '11px Segoe UI, sans-serif';
      ctx.fillText(`D${display.id}`, outer.x + 6, outer.y + 14);
    });

    if (Array.isArray(map.windows)) {
      map.windows.forEach((win) => {
        if (!win || !win.bounds) return;
        const rect = {
          x: win.bounds.x,
          y: win.bounds.y,
          width: win.bounds.width,
          height: win.bounds.height
        };
        if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) return;

        const screenRect = toScreenRect(rect);
        const color = getWindowColor(win.key || '');
        ctx.fillStyle = `${color}22`;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.fillRect(screenRect.x, screenRect.y, screenRect.w, screenRect.h);
        ctx.strokeRect(screenRect.x, screenRect.y, screenRect.w, screenRect.h);

        ctx.fillStyle = color;
        ctx.font = '10px Segoe UI, sans-serif';
        const label = String(win.key || '').replace(/^detached:/, 'det:').replace(/^pinned:/, 'pin:').replace(/^block:/, 'blk:');
        ctx.fillText(label, screenRect.x + 4, screenRect.y + 12);
      });
    }
  }

  async function requestAndRender() {
    renderIssues(null);
    try {
      const result = await invokeMain(IPC_CHANNELS.GET_DISPLAY_DEBUG_MAP);
      if (result && result.success && result.map) {
        lastMap = result.map;
        renderIssues(lastMap);
        renderMap(lastMap);
        return;
      }
    } catch (_) {}

    renderIssues(null);
    renderMap(lastMap);
  }

  if (toggleBtn) {
    on(toggleBtn, 'click', () => {
      setOverlayVisible(!visible);
      try { window.__holdInteractive && window.__holdInteractive(400); } catch (_) {}
    });
  }

  if (refreshBtn) {
    on(refreshBtn, 'click', () => {
      if (!visible) return;
      requestAndRender();
      try { window.__holdInteractive && window.__holdInteractive(300); } catch (_) {}
    });
  }

  if (closeBtn) {
    on(closeBtn, 'click', () => setOverlayVisible(false));
  }

  function beginDrag(ev) {
    if (!visible) return;
    if (!panelEl) return;
    if (ev.button !== 0) return;
    if (ev.target && ev.target.closest && ev.target.closest('.debug-map-actions')) return;
    dragState = {
      pointerId: ev.pointerId,
      startX: ev.clientX,
      startY: ev.clientY,
      startLeft: panelEl.offsetLeft,
      startTop: panelEl.offsetTop
    };
    try { headerEl.setPointerCapture(ev.pointerId); } catch (_) {}
    ev.preventDefault();
  }

  function moveDrag(ev) {
    if (!dragState || ev.pointerId !== dragState.pointerId) return;
    const dx = ev.clientX - dragState.startX;
    const dy = ev.clientY - dragState.startY;
    const left = Math.max(0, dragState.startLeft + dx);
    const top = Math.max(0, dragState.startTop + dy);
    panelEl.style.left = `${left}px`;
    panelEl.style.top = `${top}px`;
  }

  function endDrag(ev) {
    if (!dragState || ev.pointerId !== dragState.pointerId) return;
    try { headerEl.releasePointerCapture(ev.pointerId); } catch (_) {}
    dragState = null;
  }

  on(headerEl, 'pointerdown', beginDrag);
  on(headerEl, 'pointermove', moveDrag);
  on(headerEl, 'pointerup', endDrag);
  on(headerEl, 'pointercancel', endDrag);

  updateDebugMapText();
})();
