(function () {
  var script =
    document.getElementById("txid-widget-script") || document.currentScript;
  if (!script) return;

  var key = script.getAttribute("data-key");
  if (!key) return;

  var BASE =
    script.src
      .replace(/\/widget\.js.*$/, "")
      .replace(/^(https?:\/\/[^/]+).*/, "$1") ||
    "https://app.txid.support";

  // Avoid double-init
  if (document.getElementById("txid-widget-root")) return;

  var PURPLE = "#6366f1";
  var SIZE = "56px";

  // ── Styles ──────────────────────────────────────────────────────────────────

  var style = document.createElement("style");
  style.textContent =
    "#txid-widget-root *{box-sizing:border-box;margin:0;padding:0}" +
    "#txid-widget-btn{" +
    "position:fixed;" +
    "bottom:max(24px,env(safe-area-inset-bottom,0px));" +
    "right:max(24px,env(safe-area-inset-right,0px));" +
    "z-index:2147483646;" +
    "width:" + SIZE + ";height:" + SIZE + ";border-radius:50%;" +
    "background:" + PURPLE + ";border:none;cursor:pointer;" +
    "box-shadow:0 4px 24px rgba(99,102,241,.45);" +
    "display:flex;align-items:center;justify-content:center;" +
    "transition:transform .15s,box-shadow .15s;" +
    "}" +
    "#txid-widget-btn:hover{transform:scale(1.07);box-shadow:0 6px 28px rgba(99,102,241,.55)}" +
    "#txid-widget-btn svg{display:block}" +
    "#txid-widget-frame-wrap{" +
    "position:fixed;" +
    "bottom:max(92px,calc(env(safe-area-inset-bottom,0px) + 68px));" +
    "right:max(24px,env(safe-area-inset-right,0px));" +
    "z-index:2147483645;" +
    "width:380px;height:560px;max-height:calc(100vh - 152px);border-radius:16px;" +
    "box-shadow:0 8px 48px rgba(0,0,0,.45);" +
    "overflow:hidden;display:none;background-color:#0a0a0f;" +
    "}" +
    "#txid-widget-frame-wrap.open{display:block}" +
    "#txid-widget-frame{width:100%;height:100%;border:none;display:block}" +
    /* Mobile: full-width bottom sheet, respects safe areas */
    "@media(max-width:440px){" +
    "#txid-widget-frame-wrap{" +
    "right:0;left:0;" +
    "bottom:max(80px,calc(env(safe-area-inset-bottom,0px) + 56px));" +
    "width:100%;border-radius:16px 16px 0 0;" +
    "max-height:calc(100vh - max(100px,calc(env(safe-area-inset-bottom,0px) + 76px)))" +
    "}" +
    "#txid-widget-btn{" +
    "bottom:max(16px,env(safe-area-inset-bottom,0px));" +
    "right:max(16px,env(safe-area-inset-right,0px))" +
    "}" +
    "}";
  document.head.appendChild(style);

  // ── Chat icon (open) ─────────────────────────────────────────────────────

  var CHAT_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">' +
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
    "</svg>";

  var CLOSE_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24">' +
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
    "</svg>";

  // ── DOM ──────────────────────────────────────────────────────────────────

  var root = document.createElement("div");
  root.id = "txid-widget-root";

  var btn = document.createElement("button");
  btn.id = "txid-widget-btn";
  btn.setAttribute("aria-label", "Open support chat");
  btn.innerHTML = CHAT_ICON;

  var wrap = document.createElement("div");
  wrap.id = "txid-widget-frame-wrap";

  var iframe = document.createElement("iframe");
  iframe.id = "txid-widget-frame";
  iframe.setAttribute("allow", "clipboard-write");
  iframe.setAttribute("title", "Support chat");
  // Eager-load: start loading immediately so widget is ready when first opened
  iframe.src = BASE + "/widget?key=" + encodeURIComponent(key);

  wrap.appendChild(iframe);
  root.appendChild(btn);
  root.appendChild(wrap);
  document.body.appendChild(root);

  // ── Toggle ───────────────────────────────────────────────────────────────

  var open = false;

  btn.addEventListener("click", function () {
    // A drag just ended — swallow the click so the panel doesn't toggle.
    if (suppressClick) { suppressClick = false; return; }
    open = !open;
    if (open) {
      wrap.classList.add("open");
      positionPanel();
      btn.innerHTML = CLOSE_ICON;
      btn.setAttribute("aria-label", "Close support chat");
    } else {
      wrap.classList.remove("open");
      btn.innerHTML = CHAT_ICON;
      btn.setAttribute("aria-label", "Open support chat");
    }
  });

  // Base panel size (kept in sync with the CSS above). Text-scale grows it.
  var BASE_W = 380, BASE_H = 560;

  // ── Drag to reposition (desktop only) ──────────────────────────────────────
  // Additive: until the user actually drags, customPos stays null and the CSS
  // defaults (bottom-right) apply untouched — existing embeds are unchanged.
  var STORE_KEY = "txid-widget-pos:" + key;
  var BTN_SIZE = parseInt(SIZE, 10);
  var customPos = null; // {left, top} of the launcher once the user has moved it
  try {
    var savedPos = localStorage.getItem(STORE_KEY);
    if (savedPos) customPos = JSON.parse(savedPos);
  } catch (e) { /* storage blocked — drag simply won't persist */ }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  // Position the launcher. On mobile, or before any drag, hand back to the CSS.
  function applyButtonPos() {
    if (window.innerWidth <= 440 || !customPos) {
      btn.style.left = ""; btn.style.top = ""; btn.style.right = ""; btn.style.bottom = "";
      return;
    }
    customPos.left = clamp(customPos.left, 8, window.innerWidth - BTN_SIZE - 8);
    customPos.top = clamp(customPos.top, 8, window.innerHeight - BTN_SIZE - 8);
    btn.style.left = customPos.left + "px";
    btn.style.top = customPos.top + "px";
    btn.style.right = "auto";
    btn.style.bottom = "auto";
  }

  // Anchor the open panel to the launcher's nearest corner. On mobile, or
  // before any drag, clear inline positioning so the CSS (bottom-right on
  // desktop, full-width sheet on mobile) takes over.
  function positionPanel() {
    if (window.innerWidth <= 440 || !customPos) {
      wrap.style.left = ""; wrap.style.top = ""; wrap.style.right = ""; wrap.style.bottom = "";
      return;
    }
    var r = btn.getBoundingClientRect();
    var w = wrap.offsetWidth || BASE_W;
    var h = wrap.offsetHeight || BASE_H;
    var gap = 12;
    // Horizontal: align the panel edge with the button's nearest side.
    var left = (r.left + r.width / 2 > window.innerWidth / 2) ? r.right - w : r.left;
    // Vertical: prefer above the button; drop below if there isn't room.
    var top = (r.top - gap - h >= 8) ? r.top - gap - h : r.bottom + gap;
    wrap.style.left = clamp(left, 8, window.innerWidth - w - 8) + "px";
    wrap.style.top = clamp(top, 8, window.innerHeight - h - 8) + "px";
    wrap.style.right = "auto";
    wrap.style.bottom = "auto";
  }

  var dragState = null;
  var suppressClick = false;

  btn.addEventListener("pointerdown", function (e) {
    if (window.innerWidth <= 440) return;            // no drag on the mobile sheet
    if (e.button !== undefined && e.button !== 0) return; // left button / touch only
    var r = btn.getBoundingClientRect();
    dragState = { startX: e.clientX, startY: e.clientY, offsetX: e.clientX - r.left, offsetY: e.clientY - r.top, moved: false };
  });

  window.addEventListener("pointermove", function (e) {
    if (!dragState) return;
    if (!dragState.moved && Math.abs(e.clientX - dragState.startX) + Math.abs(e.clientY - dragState.startY) < 6) return;
    dragState.moved = true;
    customPos = {
      left: clamp(e.clientX - dragState.offsetX, 8, window.innerWidth - BTN_SIZE - 8),
      top: clamp(e.clientY - dragState.offsetY, 8, window.innerHeight - BTN_SIZE - 8),
    };
    applyButtonPos();
    if (open) positionPanel();
  });

  window.addEventListener("pointerup", function () {
    if (!dragState) return;
    if (dragState.moved) {
      suppressClick = true; // the trailing click must not toggle the panel
      try { localStorage.setItem(STORE_KEY, JSON.stringify(customPos)); } catch (e) { /* ignore */ }
    }
    dragState = null;
  });

  // Keep everything on-screen when the host window resizes.
  window.addEventListener("resize", function () {
    applyButtonPos();
    if (open) positionPanel();
  });

  // Apply any saved position on load.
  applyButtonPos();

  window.addEventListener("message", function (e) {
    // Close when the iframe posts a "txid-close" message
    if (e.data === "txid-close") {
      // Force-close regardless of open state to guard against any state drift
      open = false;
      wrap.classList.remove("open");
      btn.innerHTML = CHAT_ICON;
      btn.setAttribute("aria-label", "Open support chat");
      return;
    }
    // Grow the frame to fit the chosen text scale so larger fonts don't clip.
    if (e.data && e.data.type === "txid-resize" && typeof e.data.scale === "number") {
      var s = Math.max(0.8, Math.min(1.5, e.data.scale));
      // Only widen on desktop; mobile is already a full-width sheet.
      if (window.innerWidth > 440) {
        wrap.style.width = Math.round(BASE_W * s) + "px";
        wrap.style.height = Math.round(BASE_H * s) + "px";
        // Re-anchor to the launcher if the user has dragged it.
        if (open) positionPanel();
      }
    }
  });
})();
