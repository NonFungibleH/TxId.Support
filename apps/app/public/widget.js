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

  // The launcher used to be hardcoded to TxID purple, which sat on a yellow
  // branded widget and clashed badly. data-color themes it immediately with no
  // extra request; the iframe also posts the project's real primary colour once
  // it has loaded config, so embeds using an older snippet correct themselves.
  // Priority: snippet attribute, then the colour LEARNED on a previous visit,
  // then TxID purple as the true first-contact fallback. The cache exists
  // because most snippets in the wild predate data-color, and without it every
  // page load flashed purple for the second or two before the iframe reported
  // the real brand. Hex-validated on read: the value lands in a style prop.
  var PURPLE = script.getAttribute("data-color");
  if (!PURPLE) { try { PURPLE = localStorage.getItem("txid_color_" + key); } catch (e) { /* private mode */ } }
  if (!PURPLE || !/^#[0-9a-fA-F]{3,8}$/.test(PURPLE)) PURPLE = "#6366f1";
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
    /* dvh tracks the VISIBLE viewport on mobile; 100vh includes the area
       behind browser chrome, which clipped the input off-screen. The vh line
       above stays as the fallback for browsers without dvh. */
    "max-height:calc(100dvh - 152px);" +
    "box-shadow:0 8px 48px rgba(0,0,0,.45);" +
    "overflow:hidden;display:none;background-color:#0a0a0f;" +
    "}" +
    "#txid-widget-frame-wrap.open{display:block}" +
    /* Beta spotlight arrival: the panel opens CENTRED over a dimmed page, so
       the introduction is read as a moment rather than noticed in a corner,
       then docks to the launcher so the tester learns where help lives. */
    "#txid-widget-backdrop{position:fixed;inset:0;z-index:2147483644;background:rgba(8,8,16,.5);opacity:0;transition:opacity .3s}" +
    "#txid-widget-backdrop.show{opacity:1}" +
    "#txid-widget-frame-wrap.txid-center{left:50%;top:50%;right:auto;bottom:auto;transform:translate(-50%,-50%);box-shadow:0 24px 80px rgba(0,0,0,.6)}" +
    "#txid-widget-frame-wrap.txid-docking{transition:left .45s cubic-bezier(.2,.8,.2,1),top .45s cubic-bezier(.2,.8,.2,1)}" +
    "#txid-widget-caption{position:fixed;z-index:2147483646;background:#17172a;color:#fff;font:500 13px/1.4 system-ui,-apple-system,sans-serif;padding:8px 12px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.35);opacity:0;transition:opacity .3s;pointer-events:none;max-width:240px}" +
    "#txid-widget-caption.show{opacity:1}" +
    "#txid-widget-frame{width:100%;height:100%;border:none;display:block}" +
    /* Mobile: full-width bottom sheet, respects safe areas */
    "@media(max-width:440px){" +
    "#txid-widget-frame-wrap{" +
    "right:0;left:0;" +
    "bottom:max(80px,calc(env(safe-area-inset-bottom,0px) + 56px));" +
    /* The sheet floats clear of the bottom edge, so it is rounded all round. */
    "width:100%;border-radius:16px;" +
    "max-height:calc(100vh - max(100px,calc(env(safe-area-inset-bottom,0px) + 76px)));" +
    "max-height:calc(100dvh - max(100px,calc(env(safe-area-inset-bottom,0px) + 76px)));" +
    /* Cap the fixed 560px height too: keyboards + short phones otherwise
       push the composer under the browser chrome. */
    "height:min(560px,calc(100dvh - max(100px,calc(env(safe-area-inset-bottom,0px) + 76px))))" +
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
  // HIDDEN UNTIL THE IFRAME CONFIRMS THE PROJECT IS LIVE. An inactive or
  // not-yet-launched project must show NOTHING on the host page, never a
  // "Project inactive" error where a support button should be. Revealed on the
  // "txid-ready" message; the fail-open timer below still shows it if that
  // message never arrives, so a messaging glitch can never hide a working one.
  btn.style.display = "none";
  var launcherDecided = false;

  var wrap = document.createElement("div");
  wrap.id = "txid-widget-frame-wrap";

  var iframe = document.createElement("iframe");
  iframe.id = "txid-widget-frame";
  iframe.setAttribute("allow", "clipboard-write");
  iframe.setAttribute("title", "Support chat");
  // Eager-load: start loading immediately so widget is ready when first opened
  // The dashboard preview injects the loader (not a bare iframe) so that the
  // wallet bridge below exists: a wallet extension cannot show its approval
  // popup for a cross-origin iframe, so the connect has to run up here on the
  // host page. These two carry the signed preview token through.
  var previewToken = script.getAttribute("data-pt");
  // Per-load nonce, minted here and threaded into the iframe URL (?n=) and onto
  // every control message we post into the frame. window.parent is shared by
  // EVERY script on the host page, so `e.source === window.parent` cannot tell
  // OUR loader apart from a co-resident ad tag or analytics snippet. The nonce
  // can: only code that read our iframe's own URL knows it. Not a secret against
  // the frame itself, just against its same-window neighbours.
  var NONCE = (function () {
    try {
      var a = new Uint8Array(16);
      (window.crypto || window.msCrypto).getRandomValues(a);
      var s = ""; for (var i = 0; i < a.length; i++) s += (a[i] + 0x100).toString(16).slice(1);
      return s;
    } catch (e) { return String(new Date().getTime()) + Math.random().toString(16).slice(2); }
  })();
  // Initial theme from the script tag (data-theme="light"|"dark"), threaded
  // into the iframe URL so the first paint already matches the host site.
  // Dynamic switching afterwards goes through window.txid.setTheme below.
  var initialTheme = script.getAttribute("data-theme");
  if (initialTheme !== "light" && initialTheme !== "dark") initialTheme = null;
  iframe.src = BASE + "/widget?key=" + encodeURIComponent(key) +
    "&n=" + encodeURIComponent(NONCE) +
    (initialTheme ? "&t=" + initialTheme : "") +
    (script.getAttribute("data-preview") === "1" ? "&preview=1" : "") +
    // Forwarded so the iframe knows this is a deliberate owner launch: the
    // widget suppresses auto-open in preview mode, and without this flag the
    // preview bookmarklet could never demonstrate the beta arrival at all.
    (script.getAttribute("data-fresh") === "1" ? "&fresh=1" : "") +
    (previewToken ? "&pt=" + encodeURIComponent(previewToken) : "") +
    // The EMBEDDING host. The config fetch inside the iframe is same-origin, so
    // its Referer is always app.txid.support and carries no information about
    // where the widget is actually installed. Only this loader can see that.
    // Client-supplied, therefore a soft control: it stops casual key reuse, not
    // a determined forger, which is what the rate limits are for.
    "&h=" + encodeURIComponent(String(location.host).slice(0, 200));

  wrap.appendChild(iframe);
  root.appendChild(btn);
  root.appendChild(wrap);
  document.body.appendChild(root);

  // FAIL-OPEN: if the iframe never reports ready or inactive (blocked, stale
  // cache, or an error we did not foresee), show the launcher anyway after a
  // grace period. Hiding a working widget is a worse failure than briefly
  // showing an inactive one, so uncertainty defaults to visible.
  setTimeout(function () { if (!launcherDecided) btn.style.display = ""; }, 8000);

  // ── window.txid: host page control API ────────────────────────────────────
  // The embedding site drives the widget from its own code:
  //   window.txid.identify({ wallet, chainId })  — supply the user so they
  //       never connect to us separately (their one connection to your app
  //       stays the only one). An identifier for attribution, not a signature.
  //   window.txid.open({ mode })                 — open the panel; mode "bug" or
  //       "feedback" drops the user straight into that report. Call it from your
  //       transaction-failure handler to pop it at the moment of failure.
  //   window.txid.open() / window.txid.close()   — just open/close.
  // Calls made before the widget has loaded are queued and replayed on ready,
  // so integrators never have to care about timing.
  var iframeReady = false;
  var queuedIdentity = null;
  var queuedOpen = null;
  var queuedTheme = null;
  function sendToFrame(msg) { try { if (msg && typeof msg === "object") msg.nonce = NONCE; iframe.contentWindow.postMessage(msg, BASE); } catch (err) { /* frame gone */ } }
  function flushHostQueue() {
    if (queuedIdentity) { sendToFrame(queuedIdentity); }
    if (queuedTheme) { sendToFrame(queuedTheme); }
    if (queuedOpen) { setOpen(true); sendToFrame(queuedOpen); queuedOpen = null; }
  }
  window.txid = window.txid || {};
  window.txid.identify = function (opts) {
    opts = opts || {};
    var msg = { type: "txid-identify", wallet: (opts.wallet != null ? String(opts.wallet) : null), chainId: (opts.chainId != null ? String(opts.chainId) : null) };
    queuedIdentity = msg; // kept so a later reload still re-sends the identity
    if (iframeReady) sendToFrame(msg);
  };
  window.txid.open = function (opts) {
    opts = opts || {};
    var msg = { type: "txid-open", mode: (opts.mode != null ? String(opts.mode) : null) };
    if (iframeReady) { setOpen(true); sendToFrame(msg); }
    else queuedOpen = msg;
  };
  window.txid.close = function () { setOpen(false); };
  // Drive the widget's palette from the host site's own light/dark toggle.
  //   window.txid.setTheme("dark" | "light" | "auto")
  // Only has an effect when the project designed a dark theme in the dashboard
  // and its theme mode is "auto"; "auto" hands control back to the visitor's
  // OS preference. Kept (like identity) so a frame reload re-applies it.
  window.txid.setTheme = function (theme) {
    var t = theme === "dark" ? "dark" : theme === "light" ? "light" : "auto";
    var msg = { type: "txid-theme", theme: t };
    queuedTheme = msg;
    if (iframeReady) sendToFrame(msg);
  };

  // ── Toggle ───────────────────────────────────────────────────────────────

  var open = false;

  function setOpen(next) {
    open = next;
    if (open) {
      // A normal open is never centred. If a previous spotlight's class
      // survived any path we have not thought of, strip it rather than let
      // the panel reopen mid-screen.
      if (!spotlight) wrap.classList.remove("txid-center");
      wrap.classList.add("open");
      postHostContext();
      positionPanel();
      btn.innerHTML = CLOSE_ICON;
      btn.setAttribute("aria-label", "Close support chat");
    } else {
      // Closing mid-spotlight: no dock animation possible on a hidden panel,
      // so just clean up and still show the caption, which is the lesson.
      if (spotlight) { endSpotlight(); showCaption(); }
      wrap.classList.remove("open");
      btn.innerHTML = CHAT_ICON;
      btn.setAttribute("aria-label", "Open support chat");
      // Closing via the LAUNCHER (or window.txid.close()) never reaches the
      // iframe's own close handler, so a half-answered bug report would be lost.
      // Tell the frame it is closing so it can file what it has.
      sendToFrame({ type: "txid-closing" });
    }
  }

  btn.addEventListener("click", function () {
    // A drag just ended, so swallow the click and leave the panel as it was.
    if (suppressClick) { suppressClick = false; return; }
    setOpen(!open);
  });

  // WHERE the tester is. The iframe cannot see the host page's URL, and a
  // finding that says "the fee display is confusing" without saying WHICH
  // page is a finding the team has to go and reproduce before they can even
  // read it. Sent on load and again on every open, because dapps are SPAs
  // and the URL when the panel opens is the one that matters.
  function postHostContext() {
    try {
      if (!iframe.contentWindow) return;
      iframe.contentWindow.postMessage({
        type: "txid-host-context",
        url: String(location.href).slice(0, 500),
        vw: window.innerWidth,
        vh: window.innerHeight,
        nonce: NONCE,
      }, BASE);
    } catch (e) { /* fine: context is best-effort */ }
  }
  iframe.addEventListener("load", postHostContext);

  /**
   * Opening a panel in someone's face is intrusive, so this is fenced in:
   *  - the widget only ASKS when the project has beta auto-open turned on
   *  - ONCE PER TAB, tracked in sessionStorage, so navigating the site does
   *    not reopen it and a tester is never nagged twice
   *  - never if they already opened it themselves
   *  - never on a phone, where it would cover the whole page
   * If sessionStorage is unavailable (private mode, blocked cookies) the flag
   * cannot be written, so it degrades to not auto-opening rather than to
   * opening every time.
   */
  var AUTO_OPEN_FLAG = "txid_auto_opened_" + key;
  // A bookmarklet click is the OWNER deliberately launching a demo, not a
  // tester browsing, so it always replays the arrival. Without this, testing
  // twice in the same tab silently downgraded the spotlight to a corner open,
  // which reads as broken. Bookmarklets set data-fresh; pasted embeds never do,
  // so real testers keep the once-per-tab guard untouched.
  if (script.getAttribute("data-fresh") === "1") {
    try { sessionStorage.removeItem(AUTO_OPEN_FLAG); } catch (e) { /* keep guard */ }
  }
  function autoOpenOnce() {
    if (open) return;
    if (window.innerWidth <= 440) return;
    try {
      if (sessionStorage.getItem(AUTO_OPEN_FLAG)) return;
      sessionStorage.setItem(AUTO_OPEN_FLAG, "1");
    } catch (e) { return; }
    openSpotlight();
  }

  // ── Beta spotlight arrival ─────────────────────────────────────────────────
  // Centre-stage introduction, then dock to the corner. The dock is the point:
  // watching the panel travel to the launcher teaches the tester where help
  // lives, which one static corner popup never does. Dismissal is the
  // backdrop click or the close button; either way the caption appears by the
  // launcher so the lesson survives even an immediate dismissal.

  var spotlight = false;
  var backdrop = null;

  function openSpotlight() {
    spotlight = true;
    backdrop = document.createElement("div");
    backdrop.id = "txid-widget-backdrop";
    backdrop.addEventListener("click", dockSpotlight);
    root.appendChild(backdrop);
    requestAnimationFrame(function () { if (backdrop) backdrop.classList.add("show"); });
    wrap.classList.add("txid-center");
    setOpen(true);
  }

  function endSpotlight() {
    spotlight = false;
    wrap.classList.remove("txid-center");
    if (backdrop) {
      var bd = backdrop;
      backdrop = null;
      bd.classList.remove("show");
      setTimeout(function () { if (bd.parentNode) bd.parentNode.removeChild(bd); }, 350);
    }
  }

  function dockSpotlight() {
    if (!spotlight) return;
    // FLIP: freeze the centred position in pixels, drop the centering class,
    // then transition to where the stylesheet corner would put it. Inline
    // styles are cleared after the ride so the normal CSS owns it again.
    var r = wrap.getBoundingClientRect();
    endSpotlight();
    wrap.style.left = r.left + "px";
    wrap.style.top = r.top + "px";
    wrap.style.right = "auto";
    wrap.style.bottom = "auto";
    void wrap.offsetWidth; // commit the frozen position before transitioning
    wrap.classList.add("txid-docking");
    wrap.style.left = Math.max(8, window.innerWidth - r.width - 24) + "px";
    wrap.style.top = Math.max(8, window.innerHeight - r.height - 92) + "px";
    setTimeout(function () {
      wrap.classList.remove("txid-docking");
      wrap.style.left = ""; wrap.style.top = ""; wrap.style.right = ""; wrap.style.bottom = "";
      if (customPos) positionPanel();
      showCaption();
    }, 500);
  }

  function showCaption() {
    var r = btn.getBoundingClientRect();
    var cap = document.createElement("div");
    cap.id = "txid-widget-caption";
    cap.textContent = "I'll be here if you need me.";
    // To the LEFT of the launcher, not above it: after the dock the open panel
    // occupies the space above, and a caption on top of the panel reads as a
    // glitch. Left of the launcher is reliably empty.
    cap.style.right = Math.max(8, window.innerWidth - r.left + 10) + "px";
    cap.style.bottom = Math.max(8, window.innerHeight - r.bottom + 14) + "px";
    root.appendChild(cap);
    requestAnimationFrame(function () { cap.classList.add("show"); });
    setTimeout(function () {
      cap.classList.remove("show");
      setTimeout(function () { if (cap.parentNode) cap.parentNode.removeChild(cap); }, 350);
    }, 4500);
  }

  // Base panel size (kept in sync with the CSS above). Text-scale grows it.
  var BASE_W = 380, BASE_H = 560;

  // ── Drag to reposition (desktop only) ──────────────────────────────────────
  // Additive: until the user actually drags, customPos stays null and the CSS
  // defaults (bottom-right) apply untouched, so existing embeds are unchanged.
  var STORE_KEY = "txid-widget-pos:" + key;
  var BTN_SIZE = parseInt(SIZE, 10);
  var customPos = null; // {left, top} of the launcher once the user has moved it
  try {
    var savedPos = localStorage.getItem(STORE_KEY);
    if (savedPos) customPos = JSON.parse(savedPos);
  } catch (e) { /* storage blocked: drag simply won't persist */ }

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
    // While the spotlight holds the panel centred, inline anchoring would
    // silently win over the centering class. Hands off until it docks.
    if (spotlight) return;
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

  // ── Wallet bridge ──────────────────────────────────────────────────────────
  // Injected wallet providers (Petra window.aptos, MetaMask window.ethereum,
  // Phantom) live in THIS host page, not the cross-origin widget iframe, so the
  // iframe can't reach them directly. Relay connect requests on its behalf.
  function txidProvider(kind) {
    // window.aptos first: window.petra is deprecated and current Petra builds
    // throw on connect() through it, so preferring it broke a working wallet.
    if (kind === "aptos")  return window.aptos || window.martian || window.petra || null;
    if (kind === "solana") return (window.phantom && window.phantom.solana) || window.solana || null;
    if (kind === "evm")    return window.ethereum || null;
    return null;
  }

  // Current Petra exposes NO window global at all. Under the Aptos Wallet
  // Standard (AIP-62) a wallet registers itself through an event handshake and
  // the app connects through the wallet's own "aptos:connect" feature. Checking
  // globals alone therefore reports "no Aptos wallet" on a page where Petra is
  // installed and working.
  function txidStandardWallets() {
    var found = [];
    function register(w) {
      var list = Object.prototype.toString.call(w) === "[object Array]" ? w : [w];
      for (var i = 0; i < list.length; i++) if (list[i]) found.push(list[i]);
      return function () {};
    }
    try {
      // Wallets that loaded first answer the register-wallet listener; wallets
      // already registered push themselves when they see app-ready.
      var onRegister = function (e) {
        var cb = e.detail;
        if (typeof cb === "function") {
          try { cb({ register: register }); } catch (err) { /* one bad wallet must not stop the rest */ }
        }
      };
      window.addEventListener("wallet-standard:register-wallet", onRegister);
      window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: { register: register } }));
      window.removeEventListener("wallet-standard:register-wallet", onRegister);
    } catch (err) { /* discovery unavailable */ }
    var direct = window.aptosWallets;
    if (Object.prototype.toString.call(direct) === "[object Array]") {
      for (var j = 0; j < direct.length; j++) found.push(direct[j]);
    }
    return found;
  }

  function txidWalletFeature(w, name) {
    return (w && w.features && w.features[name]) || null;
  }

  function txidHasAptos() {
    if (txidProvider("aptos")) return true;
    var ws = txidStandardWallets();
    for (var i = 0; i < ws.length; i++) if (txidWalletFeature(ws[i], "aptos:connect")) return true;
    return false;
  }

  // An Aptos public key is the same shape as an address (0x + hex), and wallets
  // return both side by side, so an explicit address field must win over any
  // coercion of the container. Getting this backwards yields a plausible but
  // WRONG account. Mirrors readAptosAddress in the widget app.
  function txidReadAptosAddress(acct) {
    function pick(v) {
      if (typeof v === "string") return v.indexOf("0x") === 0 ? v : null;
      if (v && typeof v === "object") {
        if (typeof v.toStringLong === "function") {
          var a = v.toStringLong();
          if (typeof a === "string" && a.indexOf("0x") === 0) return a;
        }
        if (typeof v.toString === "function") {
          var b = v.toString();
          if (typeof b === "string" && b.indexOf("0x") === 0) return b;
        }
      }
      return null;
    }
    var c = acct || {};
    var explicit = pick(c.address) || (c.account ? pick(c.account.address) : null);
    if (explicit) return explicit;
    return typeof acct === "string" && acct.indexOf("0x") === 0 ? acct : null;
  }

  function txidConnectAptos() {
    var ws = txidStandardWallets();
    var chain = [];
    for (var i = 0; i < ws.length; i++) {
      (function (w) {
        var f = txidWalletFeature(w, "aptos:connect");
        if (f && typeof f.connect === "function") {
          // Called off the feature object: detaching it loses `this` and the
          // returned promise then never settles.
          chain.push(function () { return f.connect(); });
        }
      })(ws[i]);
    }
    var legacy = txidProvider("aptos");
    if (legacy && typeof legacy.connect === "function") {
      chain.push(function () { return legacy.connect(); });
    }
    // Try each candidate in turn: a deprecated handle can throw where the
    // wallet-standard feature on the same extension succeeds.
    return chain.reduce(function (prev, attempt) {
      return prev.then(function (found) {
        if (found) return found;
        return Promise.resolve()
          .then(attempt)
          .then(function (res) {
            var payload = (res && res.args) || res;
            var addr = txidReadAptosAddress(payload);
            return addr ? { address: addr, chainId: "aptos" } : null;
          })
          .catch(function () { return null; });
      });
    }, Promise.resolve(null));
  }

  function txidDisconnectAptos() {
    try {
      var ws = txidStandardWallets();
      for (var i = 0; i < ws.length; i++) {
        var f = txidWalletFeature(ws[i], "aptos:disconnect");
        if (f && typeof f.disconnect === "function") {
          try { Promise.resolve(f.disconnect())["catch"](function () {}); } catch (err) { /* ignore */ }
        }
      }
      var legacy = txidProvider("aptos");
      if (legacy && typeof legacy.disconnect === "function") {
        Promise.resolve(legacy.disconnect())["catch"](function () {});
      }
    } catch (err) { /* best effort */ }
  }
  function txidToFrame(msg) {
    try { iframe.contentWindow.postMessage(msg, BASE); } catch (err) { /* frame gone */ }
  }

  window.addEventListener("message", function (e) {
    // AUTHENTICATE FIRST, for every message type. Every message this listener
    // handles (ready/inactive/autoopen/close/resize/brand/wallet) legitimately
    // originates from our own iframe, so pin origin AND source up front. Without
    // this at the top, a co-resident script or a nested ad iframe on the host
    // page could post "txid-ready" (revealing the launcher on an inactive
    // project, undoing that guarantee), "txid-autoopen", "txid-close", etc.
    if (e.origin !== BASE || e.source !== iframe.contentWindow) return;
    // Close when the iframe posts a "txid-close" message
    // The widget has loaded its config and that project runs a beta programme
    // with auto-open on. Asked for by the iframe rather than decided up here,
    // because the loader never sees the project config.
    // Config loaded and the project is live: reveal the launcher, and flush any
    // identify()/open() the host called before the widget was ready.
    if (e.data === "txid-ready") { launcherDecided = true; btn.style.display = ""; iframeReady = true; flushHostQueue(); return; }
    // Project inactive, not found, or config failed: keep it hidden entirely.
    if (e.data === "txid-inactive") { launcherDecided = true; return; }

    if (e.data === "txid-autoopen") { autoOpenOnce(); return; }

    // The tester sent their first message: the introduction has done its job,
    // so the panel docks to the corner on its own and the conversation
    // continues there. No-op outside a spotlight.
    if (e.data === "txid-engaged") { dockSpotlight(); return; }

    // The intro's "Let's go" button: the tester has read the orientation and
    // wants the site. Mid-spotlight, dock first so they SEE where it lands,
    // then close; already in the corner, just close. Either way the caption
    // reinforces where help lives.
    if (e.data === "txid-letsgo") {
      if (spotlight) {
        dockSpotlight();
        setTimeout(function () { setOpen(false); }, 850);
      } else {
        setOpen(false);
        showCaption();
      }
      return;
    }

    if (e.data === "txid-close") {
      // THROUGH setOpen, not a hand-rolled copy of it. This handler predated
      // the spotlight and hid the panel without running its cleanup, so
      // closing via the widget's own X left the centering class and the
      // backdrop orphaned: every reopen was centred, no dock, no caption.
      setOpen(false);
      return;
    }
    // Size the frame. The scale carries BOTH the text scale (so larger fonts
    // don't clip) and the panel-size setting, already multiplied inside the
    // widget. Ceiling is 1.8 because xl text (1.25) x xl panel (1.38) is 1.725;
    // the CSS max-height still caps the result against the viewport.
    if (e.data && e.data.type === "txid-resize" && typeof e.data.scale === "number") {
      var s = Math.max(0.8, Math.min(1.8, e.data.scale));
      // Only widen on desktop; mobile is already a full-width sheet.
      if (window.innerWidth > 440) {
        // Height is capped in CSS against the viewport, width is not, so cap
        // it here: an xl panel in a half-width browser window would otherwise
        // run off the side of the page it is a guest on.
        var maxW = window.innerWidth - 48;
        wrap.style.width = Math.min(Math.round(BASE_W * s), maxW) + "px";
        wrap.style.height = Math.round(BASE_H * s) + "px";
        // Re-anchor to the launcher if the user has dragged it.
        if (open) positionPanel();
      }
      return;
    }

    if (e.data && e.data.type === "txid-brand" && typeof e.data.primaryColor === "string") {
      // Only accept a plain hex colour: this value goes straight into a style
      // property, and the iframe is the one surface allowed to set it.
      if (/^#[0-9a-fA-F]{3,8}$/.test(e.data.primaryColor)) {
        btn.style.background = e.data.primaryColor;
        btn.style.boxShadow = "0 4px 24px " + e.data.primaryColor + "55";
        // Remember it, so the NEXT load themes instantly instead of flashing.
        try { localStorage.setItem("txid_color_" + key, e.data.primaryColor); } catch (e2) { /* fine */ }
      }
      return;
    }

    if (e.data && e.data.type === "txid-wallet-detect") {
      txidToFrame({
        type: "txid-wallet-available",
        aptos: txidHasAptos(),
        evm: !!txidProvider("evm"),
        solana: !!txidProvider("solana"),
      });
      return;
    }

    if (e.data && e.data.type === "txid-wallet-disconnect") {
      txidDisconnectAptos();
      return;
    }

    if (e.data && e.data.type === "txid-wallet-connect") {
      var id = e.data.id;
      var kind = e.data.provider;
      // Aptos is resolved separately: it may have no window global at all.
      var p = kind === "aptos" ? null : txidProvider(kind);
      if (kind !== "aptos" && !p) { txidToFrame({ type: "txid-wallet-result", id: id, ok: false, error: "no-provider" }); return; }
      Promise.resolve()
        .then(function () {
          if (kind === "solana") {
            return p.connect().then(function (r) { return { address: r.publicKey.toString(), chainId: "solana" }; });
          }
          if (kind === "evm") {
            return p.request({ method: "eth_requestAccounts" }).then(function (accts) {
              return p.request({ method: "eth_chainId" }).then(function (cid) {
                return { address: accts && accts[0], chainId: cid };
              });
            });
          }
          return txidConnectAptos();
        })
        .then(function (res) {
          if (res && res.address) {
            txidToFrame({ type: "txid-wallet-result", id: id, ok: true, address: res.address, chainId: res.chainId });
          } else {
            txidToFrame({ type: "txid-wallet-result", id: id, ok: false, error: "no-provider" });
          }
        })
        .catch(function () {
          txidToFrame({ type: "txid-wallet-result", id: id, ok: false, error: "rejected" });
        });
      return;
    }
  });
})();
