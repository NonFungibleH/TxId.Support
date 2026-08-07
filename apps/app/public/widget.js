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
  var PURPLE = script.getAttribute("data-color") || "#6366f1";
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
  iframe.src = BASE + "/widget?key=" + encodeURIComponent(key) +
    (script.getAttribute("data-preview") === "1" ? "&preview=1" : "") +
    (previewToken ? "&pt=" + encodeURIComponent(previewToken) : "");

  wrap.appendChild(iframe);
  root.appendChild(btn);
  root.appendChild(wrap);
  document.body.appendChild(root);

  // ── Toggle ───────────────────────────────────────────────────────────────

  var open = false;

  function setOpen(next) {
    open = next;
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
  }

  btn.addEventListener("click", function () {
    // A drag just ended, so swallow the click and leave the panel as it was.
    if (suppressClick) { suppressClick = false; return; }
    setOpen(!open);
  });

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
  function autoOpenOnce() {
    if (open) return;
    if (window.innerWidth <= 440) return;
    try {
      if (sessionStorage.getItem(AUTO_OPEN_FLAG)) return;
      sessionStorage.setItem(AUTO_OPEN_FLAG, "1");
    } catch (e) { return; }
    setOpen(true);
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
    // Close when the iframe posts a "txid-close" message
    // The widget has loaded its config and that project runs a beta programme
    // with auto-open on. Asked for by the iframe rather than decided up here,
    // because the loader never sees the project config.
    if (e.data === "txid-autoopen") { autoOpenOnce(); return; }

    if (e.data === "txid-close") {
      // Force-close regardless of open state to guard against any state drift
      open = false;
      wrap.classList.remove("open");
      btn.innerHTML = CHAT_ICON;
      btn.setAttribute("aria-label", "Open support chat");
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

    // Wallet messages are sensitive: only ever honour them from OUR own iframe.
    if (e.origin !== BASE || e.source !== iframe.contentWindow) return;

    if (e.data && e.data.type === "txid-brand" && typeof e.data.primaryColor === "string") {
      // Only accept a plain hex colour: this value goes straight into a style
      // property, and the iframe is the one surface allowed to set it.
      if (/^#[0-9a-fA-F]{3,8}$/.test(e.data.primaryColor)) {
        btn.style.background = e.data.primaryColor;
        btn.style.boxShadow = "0 4px 24px " + e.data.primaryColor + "55";
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
