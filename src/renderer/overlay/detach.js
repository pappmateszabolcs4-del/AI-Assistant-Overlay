// Detached panel drag + dock behavior.

// Global: main overlay can temporarily show docking targets while dragging a detached panel.
let dockPreviewActive = false;

function getReliableScreenPoint(ev) {
  const sx = Number(ev && ev.screenX);
  const sy = Number(ev && ev.screenY);
  const cx = Number(ev && ev.clientX);
  const cy = Number(ev && ev.clientY);
  const wx = Number(window.screenX);
  const wy = Number(window.screenY);

  const hasClient = Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(wx) && Number.isFinite(wy);
  const fromClient = hasClient ? { x: wx + cx, y: wy + cy } : null;
  const fromScreen = (Number.isFinite(sx) && Number.isFinite(sy)) ? { x: sx, y: sy } : null;

  if (fromClient && fromScreen) {
    // On some Windows/Electron frameless windows, screenX/screenY can be wrong while captured.
    // Prefer the value consistent with the window's screen position.
    const dx = Math.abs(fromScreen.x - fromClient.x);
    const dy = Math.abs(fromScreen.y - fromClient.y);
    if (dx + dy > 8) return fromClient;
    return fromScreen;
  }
  return fromClient || fromScreen || { x: wx, y: wy };
}

// Provide header dock rects (screen coords) for detached panels to dock back.
if (!__isDetachedPanelWindow && !(typeof __isBlockWindow !== 'undefined' && __isBlockWindow)) {
  ipcRenderer.on(IPC_CHANNELS.REQUEST_PANEL_DOCK_RECTS, (_event, requestId) => {
    const offX = window.screenX;
    const offY = window.screenY;
    const rects = {};

    const container = document.getElementById('overlay-container');
    const containerRect = container ? container.getBoundingClientRect() : null;
    const barLeft = containerRect ? (offX + containerRect.left) : offX;
    const barTop = containerRect ? (offY + containerRect.top) : offY;
    const barWidth = containerRect ? containerRect.width : window.innerWidth;
    // Detached slots are collapsed; keep the synthetic dock zone tight so we don't allow
    // docking from the large empty area between the header and the panels.
    const zoneH = 24;
    const dockPanelOrder = (Array.isArray(panelOrder) && panelOrder.length)
      ? panelOrder
      : loadPanelOrder();
    const colW = Math.max(1, barWidth / 3);

    document.querySelectorAll('.collapsible-section[data-panel]').forEach((section) => {
      const pid = (section.getAttribute('data-panel') || '').toLowerCase();
      if (!pid) return;

      const isDetached = section.classList.contains('panel-detached');
      const btn = isDetached ? null : section.querySelector('.section-header');

      if (btn) {
        const r = btn.getBoundingClientRect();
        rects[pid] = { left: offX + r.left, top: offY + r.top, right: offX + r.right, bottom: offY + r.bottom };
        return;
      }

      // Detached slots are collapsed; provide a synthetic docking zone in the top bar.
      const idx = dockPanelOrder.indexOf(pid);
      if (idx === -1) return;
      const left = barLeft + (idx * colW);
      const right = barLeft + ((idx + 1) * colW);
      rects[pid] = { left, top: barTop, right, bottom: barTop + zoneH };
    });
    ipcRenderer.send(IPC_CHANNELS.RESPONSE_PANEL_DOCK_RECTS, requestId, rects);
  });
}

// Detach: drag a currently-open popup out of the header to create a separate BrowserWindow.
if (!__isDetachedPanelWindow) {
  const DETACH_DRAG_THRESHOLD_PX = 2;
  let detachDragState = null;

  function __cancelDetachGestureInternal({ onlyPending } = { onlyPending: false }) {
    try {
      if (!detachDragState) return;
      if (onlyPending && detachDragState.started) return;

      const started = !!detachDragState.started;
      const forcedInteractive = !!detachDragState.forcedInteractive;
      const panelId = detachDragState.panelId;

      try { detachDragState.headerBtn && detachDragState.headerBtn.releasePointerCapture(detachDragState.pointerId); } catch (_) {}
      detachDragState = null;
      isDetachGestureActive = false;
      try { ipcRenderer.send(IPC_CHANNELS.OVERLAY_DETACH_GUARD, false); } catch (_) {}

      if (forcedInteractive) {
        try { popForceInteractive(); } catch (_) {}
      }

      // If we already started and created a detached window, finalize it so it becomes interactive
      // and its bounds are persisted even if the overlay is being hidden.
      if (started && panelId) {
        try { fireAndForget(IPC_CHANNELS.DETACHED_PANEL_END_DRAG, panelId); } catch (_) {}
      }
    } catch (_) {}
  }

  // Cancel only the *pending* (not yet started) detach gesture.
  window.__cancelPendingDetachGesture = function() {
    __cancelDetachGestureInternal({ onlyPending: true });
  };

  // Cancel any detach gesture (pending or started). Safe to call when hiding the overlay.
  window.__cancelAnyDetachGesture = function() {
    __cancelDetachGestureInternal({ onlyPending: false });
  };

  // Compact header-only mode: when all three panels are detached, resize the overlay window down.
  let headerOnlyActive = false;
  let headerOnlyPrevHeight = null;
  let headerOnlyMeasureRaf = null;

  function areAllPanelsDetached() {
    return PANEL_IDS.every((pid) => {
      const section = document.querySelector(`.collapsible-section[data-panel="${pid}"]`);
      return !!(section && section.classList.contains('panel-detached'));
    });
  }

  function requestHeaderOnlyResize() {
    if (headerOnlyMeasureRaf) return;
    headerOnlyMeasureRaf = requestAnimationFrame(() => {
      headerOnlyMeasureRaf = null;
      const container = document.getElementById('overlay-container');
      if (!container) return;
      // Use scrollHeight (not client-rect) and keep the extra padding small.
      // This avoids the ~88px floor caused by min-height(80) + fudge(8).
      const measured = Math.max(60, Math.round((container.scrollHeight || container.getBoundingClientRect().height) + 2));
      sendOverlayResizeBatched({ height: measured });
    });
  }

  function requestDockPreviewResize() {
    if (headerOnlyMeasureRaf) return;
    headerOnlyMeasureRaf = requestAnimationFrame(() => {
      headerOnlyMeasureRaf = null;
      const container = document.getElementById('overlay-container');
      if (!container) return;
      // Use scrollHeight so we measure the full layout height even if the
      // current BrowserWindow is still small (otherwise we get a clipped "sliver").
      const measured = Math.max(110, Math.round((container.scrollHeight || container.getBoundingClientRect().height) + 8));
      sendOverlayResizeBatched({ height: measured });
    });
  }

  function updateHeaderOnlyMode() {
    const should = areAllPanelsDetached();
    const preview = !!(dockPreviewActive && should);

    if (preview) {
      // Functional-only dock preview: keep the overlay in its current
      // compact/header-only height and avoid any BrowserWindow moves.
      // Docking is still computed using synthetic header zones, but the
      // user never sees a size jump while hovering near the overlay.
      document.body.classList.add('dock-preview');
      return;
    }

    document.body.classList.remove('dock-preview');

    if (should) {
      // Ensure header-only is applied (including after a dock-preview ends).
      headerOnlyActive = true;
      // See note above: don't record the small header-only height as our restore target.
      if (headerOnlyPrevHeight == null) headerOnlyPrevHeight = (window.innerHeight >= 200 ? window.innerHeight : 500);
      document.body.classList.add('header-only');
      requestHeaderOnlyResize();
      return;
    }

    // Not all detached -> ensure full layout restored.
    if (headerOnlyActive) {
      headerOnlyActive = false;
      document.body.classList.remove('header-only');
      const restore = Math.max(200, Math.round(headerOnlyPrevHeight || 500));
      headerOnlyPrevHeight = null;
      sendOverlayResizeBatched({ height: restore });
    }
  }

  // IPC from main process: show docking targets while dragging detached panels.
  ipcRenderer.on(IPC_CHANNELS.OVERLAY_DOCK_PREVIEW, (_event, payload) => {
    dockPreviewActive = !!(payload && payload.visible);
    try { updateHeaderOnlyMode(); } catch (_) {}
  });

  function setPanelSlotDetached(panelId, detached) {
    const pid = (panelId || '').toString().toLowerCase();
    if (!pid) return;
    const section = document.querySelector(`.collapsible-section[data-panel="${pid}"]`);
    if (!section) return;
    section.classList.toggle('panel-detached', !!detached);
    try { updateHeaderOnlyMode(); } catch (_) {}
  }

  // Detach UX: avoid a visible “gap” by only hiding the docked slot once the
  // detached BrowserWindow is actually shown.
  const pendingDetachPanels = new Set();

  ipcRenderer.on(IPC_CHANNELS.DETACHED_PANEL_SHOWN, (_event, payload) => {
    try {
      const pid = String(payload && payload.panelId || '').toLowerCase();
      if (!pid) return;
      pendingDetachPanels.delete(pid);
      setPanelSlotDetached(pid, true);
    } catch (_) {}
  });

  // Main-process state sync: after a renderer reload (Ctrl+R), re-apply which panels are detached
  // so we don't "resurrect" docked tabs while detached windows still exist.
  ipcRenderer.on(IPC_CHANNELS.DETACHED_PANELS_STATE, (_event, payload) => {
    try {
      const detached = Array.isArray(payload && payload.detached) ? payload.detached : [];
      const set = new Set(detached.map((x) => String(x || '').toLowerCase()));
      PANEL_IDS.forEach((pid) => {
        setPanelSlotDetached(pid, set.has(pid));
      });
      __bootDetachedReady = true;
      __maybeFinishBoot();
    } catch (_) {}
  });

  function getPanelIdFromHeader(headerBtn) {
    const section = headerBtn && headerBtn.closest('.collapsible-section');
    if (!section) return null;
    return normalizePanelId(section.getAttribute('data-panel'));
  }

  function getOpenPopupForHeader(headerBtn) {
    const section = headerBtn && headerBtn.closest('.collapsible-section');
    if (!section) return { section: null, content: null, toggle: null };
    let content = section.querySelector('.section-content');
    if (!content && section.__floatingContent) content = section.__floatingContent;
    const toggle = headerBtn.querySelector('.section-toggle');
    return { section, content, toggle };
  }

  function pointerToScreen(ev) {
    const x = (typeof ev.screenX === 'number') ? ev.screenX : (window.screenX + ev.clientX);
    const y = (typeof ev.screenY === 'number') ? ev.screenY : (window.screenY + ev.clientY);
    return { x: Math.round(x), y: Math.round(y) };
  }

  function beginDetachDrag(ev) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const headerBtn = ev.currentTarget;
    const panelId = getPanelIdFromHeader(headerBtn);
    if (!panelId) return;

    const { section, content, toggle } = getOpenPopupForHeader(headerBtn);
    if (!section || !content || !toggle) return;
    // Only detach if the popup is currently open.
    if (!content.classList.contains('open')) return;

    // From this point, treat the pointer as part of a detach gesture.
    // This blocks any accidental/stuck window drag from moving the overlay.
    isDetachGestureActive = true;
    // Also guard in main (server-side): ignore any overlay x/y moves while detaching.
    try { ipcRenderer.send(IPC_CHANNELS.OVERLAY_DETACH_GUARD, true); } catch (_) {}

    // If a resize was ever left "stuck" (missed pointerup), cancel it now.
    cancelResize();

    // IMPORTANT: keep the overlay interactive immediately during the detach gesture.
    // If click-through flips before we pass the threshold, pointer capture can be lost and
    // another gesture (like window drag) can "steal" the movement, causing a jump.
    pushForceInteractive();

    // Drop any queued overlay move/resize updates that could flush right as we detach.
    cancelPendingOverlayResize();

    // This is a potential drag gesture; prevent any other drag logic from starting.
    ev.preventDefault();
    ev.stopPropagation();

    // If we ever got stuck in a main window-drag state, cancel it immediately
    // so the overlay cannot move while detaching.
    cancelWindowDrag();

    const pt = pointerToScreen(ev);
    const popupRect = content.getBoundingClientRect();
    const popupScreenLeft = Math.round(window.screenX + popupRect.left);
    const popupScreenTop = Math.round(window.screenY + popupRect.top);

    // When detaching, the detached window includes the panel header.
    // The original popupRect is only the dropdown content, so without adding the header height
    // the bottom (incl. popup resize handle) gets clipped.
    const headerRect = headerBtn.getBoundingClientRect();
    const headerH = Math.max(0, Math.round(headerRect.height || 0));
    // Safety slack: transparent always-on-top windows can clip a few pixels at the edges
    // (DWM/compositor rounding). Give the detached window a little extra room so the
    // bottom resize handle is fully visible.
    const DETACHED_EXTRA_H = 10;
    const windowScreenTop = Math.round(popupScreenTop - headerH);

    detachDragState = {
      pointerId: ev.pointerId,
      headerBtn,
      panelId,
      section,
      content,
      toggle,
      startScreenX: pt.x,
      startScreenY: pt.y,
      started: false,
      forcedInteractive: true,
      offsetX: Math.round(pt.x - popupScreenLeft),
      offsetY: Math.round(pt.y - windowScreenTop),
      bounds: {
        x: popupScreenLeft,
        y: windowScreenTop,
        width: Math.round(popupRect.width),
        height: Math.round(popupRect.height + headerH + DETACHED_EXTRA_H)
      }
    };

    try { headerBtn.setPointerCapture(detachDragState.pointerId); } catch (_) {}
  }

  async function handleDetachMove(ev) {
    if (!detachDragState || ev.pointerId !== detachDragState.pointerId) return;

    // Belt-and-suspenders: never let window drag run while detaching.
    cancelWindowDrag();

    const pt = pointerToScreen(ev);
    const dx = pt.x - detachDragState.startScreenX;
    const dy = pt.y - detachDragState.startScreenY;

    if (!detachDragState.started) {
      if (Math.hypot(dx, dy) < DETACH_DRAG_THRESHOLD_PX) return;
      detachDragState.started = true;
      ev.preventDefault();
      ev.stopPropagation();
      // Already forced interactive on pointerdown.

      // If the main overlay was in any kind of window-drag state, cancel it.
      // This prevents the main overlay from being pulled briefly while detaching.
      cancelWindowDrag();

      // Prevent the header click toggle after a drag.
      detachDragState.headerBtn.__suppressToggleOnce = true;

      // Close the popup immediately so the UI doesn't fight the detach drag.
      // But keep the header slot visible until the detached window is actually shown,
      // otherwise there's a perceived “gap”.
      closePopup(detachDragState.content, detachDragState.section, detachDragState.toggle);

      const openRes = await invokeMain(IPC_CHANNELS.DETACHED_PANEL_OPEN, {
        panelId: detachDragState.panelId,
        bounds: detachDragState.bounds,
        dragging: true
      }).catch(() => null);

      if (!openRes || openRes.success !== true) {
        // Failed to open detached window -> restore panel slot in header.
        detachDragState.started = false;
        return;
      }

      // Wait for main to confirm the detached window is shown before hiding the slot.
      pendingDetachPanels.add(detachDragState.panelId);
    }

    ev.preventDefault();
    const nextX = Math.round(pt.x - detachDragState.offsetX);
    const nextY = Math.round(pt.y - detachDragState.offsetY);
    ipcRenderer.send(IPC_CHANNELS.DETACHED_PANEL_MOVE, detachDragState.panelId, nextX, nextY);
  }

  async function endDetachDrag(ev) {
    if (!detachDragState || ev.pointerId !== detachDragState.pointerId) return;
    try { detachDragState.headerBtn.releasePointerCapture(detachDragState.pointerId); } catch (_) {}
    const started = !!detachDragState.started;
    const forcedInteractive = !!detachDragState.forcedInteractive;
    const panelId = detachDragState.panelId;
    detachDragState = null;

    isDetachGestureActive = false;
    try { ipcRenderer.send(IPC_CHANNELS.OVERLAY_DETACH_GUARD, false); } catch (_) {}

    if (started) {
      ev.preventDefault();
      ev.stopPropagation();
    }

    if (forcedInteractive) {
      popForceInteractive();
    }

    if (started) {
      await invokeMain(IPC_CHANNELS.DETACHED_PANEL_END_DRAG, panelId).catch(() => {});
    }

    try { updateHeaderOnlyMode(); } catch (_) {}
  }

  function cancelDetachDrag(ev) {
    if (!detachDragState || ev.pointerId !== detachDragState.pointerId) return;
    try { detachDragState.headerBtn.releasePointerCapture(detachDragState.pointerId); } catch (_) {}
    const started = !!detachDragState.started;
    const forcedInteractive = !!detachDragState.forcedInteractive;
    detachDragState = null;
    isDetachGestureActive = false;
    try { ipcRenderer.send(IPC_CHANNELS.OVERLAY_DETACH_GUARD, false); } catch (_) {}
    if (forcedInteractive) popForceInteractive();

    try { updateHeaderOnlyMode(); } catch (_) {}
  }

  document.querySelectorAll('.collapsible-section[data-panel] .section-header').forEach((btn) => {
    on(btn, 'pointerdown', beginDetachDrag);
    on(btn, 'pointermove', handleDetachMove);
    on(btn, 'pointerup', endDetachDrag);
    on(btn, 'pointercancel', cancelDetachDrag);
  });

  // Initialize compact mode at startup.
  try { updateHeaderOnlyMode(); } catch (_) {}
}

// If this window is a detached panel, show only one section and enable window dragging + docking.
if (__isDetachedPanelWindow) {
  const activeSection = document.querySelector(`.collapsible-section[data-panel="${__panelId}"]`);
  document.querySelectorAll('.collapsible-section[data-panel]').forEach((section) => {
    if (section === activeSection) section.classList.add('panel-active');
    else section.classList.remove('panel-active');
  });

  let dockPreviewLatestPt = null;
  let dockPreviewInFlight = false;
  let dockPreviewLastReqAt = 0;
  async function requestDockPreviewUpdate(force = false) {
    if (!dockPreviewLatestPt) return;
    const now = Date.now();
    if (!force && (now - dockPreviewLastReqAt) < 60) return;
    if (dockPreviewInFlight) return;
    dockPreviewInFlight = true;
    dockPreviewLastReqAt = now;
    const pt = dockPreviewLatestPt;
    await invokeMain(IPC_CHANNELS.DETACHED_PANEL_DOCK_PREVIEW_AT, {
      pointerScreenX: Math.round(pt.x),
      pointerScreenY: Math.round(pt.y)
    }).catch(() => {});
    dockPreviewInFlight = false;
    // If the pointer moved during the IPC, refresh once immediately.
    if (dockPreviewLatestPt && (dockPreviewLatestPt.x !== pt.x || dockPreviewLatestPt.y !== pt.y)) {
      requestDockPreviewUpdate(true);
    }
  }

  if (activeSection) {
    let headerBtn = activeSection.querySelector('.section-header');
    const content = activeSection.querySelector('.section-content');
    if (headerBtn) {
      // Disable dropdown toggle in detached mode; header acts as window drag bar.
      headerBtn.onclick = null;
      headerBtn.removeAttribute('onclick');

      // Use a plain element for the draggable header in detached windows.
      // (Note panel uses a <div> header; keeping a <button> here can lead to cursor quirks.)
      if (headerBtn.tagName && headerBtn.tagName.toLowerCase() === 'button') {
        const replacement = document.createElement('div');
        replacement.className = headerBtn.className;
        if (headerBtn.id) replacement.id = headerBtn.id;
        replacement.setAttribute('role', 'toolbar');
        replacement.tabIndex = 0;
        while (headerBtn.firstChild) {
          replacement.appendChild(headerBtn.firstChild);
        }
        const parent = headerBtn.parentElement;
        if (parent) {
          parent.replaceChild(replacement, headerBtn);
          headerBtn = replacement;
        }
      }
    }
    if (content) {
      // Ensure inline (non-floating) content.
      if (content.parentElement !== activeSection) activeSection.appendChild(content);
      activeSection.__floatingContent = null;
      content.__anchorBtn = null;
      content.__homeSection = activeSection;
      content.classList.add('open');
      content.style.display = 'flex';
      content.style.left = '';
      content.style.top = '';
      content.style.visibility = 'visible';
      // IMPORTANT: clear any inline popup sizing constraints.
      // The boot-time reset sets an inline maxHeight, which would override
      // `body.panel-mode .section-content { max-height: none; }` and cap the panel.
      content.style.maxHeight = '';
      content.style.height = '';
      content.style.minWidth = '';
      content.style.maxWidth = '';
    }

    if (headerBtn) {
      // Add a dock control (icon-only) to snap back to the main overlay header.
      // IMPORTANT: headerBtn is a <button>. Nesting a <button> inside a <button> is invalid HTML
      // and can cause inconsistent hover/cursor behavior. Use a non-button element instead.
      const dockBtn = document.createElement('div');
      dockBtn.className = 'dock-btn';
      dockBtn.setAttribute('role', 'button');
      dockBtn.tabIndex = 0;
      dockBtn.textContent = t().dockBack || '↩';
      dockBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, true);
      dockBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          invokeMain(IPC_CHANNELS.DETACHED_PANEL_DOCK, __panelId).catch(() => {});
        }
      });
      dockBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        invokeMain(IPC_CHANNELS.DETACHED_PANEL_DOCK, __panelId).catch(() => {});
      });
      headerBtn.appendChild(dockBtn);

      // Window drag: move this BrowserWindow by setting sender bounds.
      let dragState = null;
      const DRAG_THRESHOLD_PX = 2;
      headerBtn.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        pushForceInteractive();
        const pt = getReliableScreenPoint(ev);
        dockPreviewLatestPt = pt;
        requestDockPreviewUpdate(true);
        dragState = {
          pointerId: ev.pointerId,
          offsetX: Math.round(pt.x - window.screenX),
          offsetY: Math.round(pt.y - window.screenY),
          startX: pt.x,
          startY: pt.y,
          moved: false
        };
        try { headerBtn.setPointerCapture(dragState.pointerId); } catch (_) {}
      });

      headerBtn.addEventListener('pointermove', (ev) => {
        if (!dragState || ev.pointerId !== dragState.pointerId) return;
        ev.preventDefault();
        const pt = getReliableScreenPoint(ev);
        if (!dragState.moved) {
          const dx = pt.x - dragState.startX;
          const dy = pt.y - dragState.startY;
          if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
            dragState.moved = true;
          }
        }
        dockPreviewLatestPt = pt;
        requestDockPreviewUpdate(false);
        if (dragState.moved) {
          const nextX = Math.round(pt.x - dragState.offsetX);
          const nextY = Math.round(pt.y - dragState.offsetY);
          ipcRenderer.send(IPC_CHANNELS.DETACHED_PANEL_SET_BOUNDS, { x: nextX, y: nextY });
        }
      });

      headerBtn.addEventListener('pointerup', async (ev) => {
        if (!dragState || ev.pointerId !== dragState.pointerId) return;
        ev.preventDefault();
        try { headerBtn.releasePointerCapture(dragState.pointerId); } catch (_) {}
        const moved = !!dragState.moved;
        dragState = null;
        popForceInteractive();

        if (moved) {
          const pt = getReliableScreenPoint(ev);
          dockPreviewLatestPt = pt;
          await invokeMain(IPC_CHANNELS.DETACHED_PANEL_DROP, {
            panelId: __panelId,
            pointerScreenX: Math.round(pt.x),
            pointerScreenY: Math.round(pt.y),
            winX: window.screenX,
            winY: window.screenY,
            width: window.innerWidth,
            height: window.innerHeight
          }).catch(() => {});
        }

        dockPreviewLatestPt = null;
        await invokeMain(IPC_CHANNELS.DETACHED_PANEL_DOCK_PREVIEW_AT, { visible: false }).catch(() => {});
      });

      headerBtn.addEventListener('pointercancel', (ev) => {
        if (!dragState || ev.pointerId !== dragState.pointerId) return;
        try { headerBtn.releasePointerCapture(dragState.pointerId); } catch (_) {}
        dragState = null;
        popForceInteractive();
        dockPreviewLatestPt = null;
        invokeMain(IPC_CHANNELS.DETACHED_PANEL_DOCK_PREVIEW_AT, { visible: false }).catch(() => {});
      });
    }
  }
}

// Dock event from main: restore the section back to the header dropdown.
if (!__isDetachedPanelWindow) {
  ipcRenderer.on(IPC_CHANNELS.DETACHED_PANEL_DOCKED, (_event, payload) => {
    const pid = payload && payload.panelId ? String(payload.panelId).toLowerCase() : '';
    if (!pid) return;
    const openOnDock = !(payload && payload.open === false);
    const section = document.querySelector(`.collapsible-section[data-panel="${pid}"]`);
    const headerBtn = section ? section.querySelector('.section-header') : null;
    const content = section ? section.querySelector('.section-content') : null;
    if (!headerBtn || !content) return;

    const wasHeaderOnly = document.body.classList.contains('header-only') || document.body.classList.contains('dock-preview');

    // Make the slot visible/interactable again.
    section.classList.remove('panel-detached');

    // If we were in header-only mode, expand back.
    try { updateHeaderOnlyMode(); } catch (_) {}

    // Extra safety: after Ctrl+R reloads in header-only, the BrowserWindow can stay tiny for a moment.
    // Force a sane expanded height before opening so the popup won't be clipped / choose to open upward.
    if (wasHeaderOnly) {
      try {
        if (window.innerHeight < 200) {
          sendOverlayResizeBatched({ height: 500 });
        }
      } catch (_) {}
    }

    // Open if currently closed.
    if (openOnDock && !content.classList.contains('open')) {
      const openPopup = () => {
        try { toggleSection(new Event('click'), headerBtn); } catch (_) {}
      };

      // If we are transitioning out of header-only/dock-preview, opening immediately makes the UI
      // feel responsive. Popup sizing will be corrected on the upcoming window resize via the
      // existing resize/reposition logic.
      if (wasHeaderOnly) {
        let opened = false;
        const openOnce = () => {
          if (opened) return;
          opened = true;
          openPopup();
          try { scheduleRepositionPopups(); } catch (_) {}
        };
        try { requestAnimationFrame(openOnce); } catch (_) { setTimeout(openOnce, 0); }
        setTimeout(openOnce, 60);
        // Fallback: if the resize lands later than expected, retry once more.
        setTimeout(openOnce, 140);
      } else {
        openPopup();
      }
    }
  });
}
