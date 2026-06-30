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
    "position:fixed;bottom:24px;right:24px;z-index:2147483646;" +
    "width:" + SIZE + ";height:" + SIZE + ";border-radius:50%;" +
    "background:" + PURPLE + ";border:none;cursor:pointer;" +
    "box-shadow:0 4px 24px rgba(99,102,241,.45);" +
    "display:flex;align-items:center;justify-content:center;" +
    "transition:transform .15s,box-shadow .15s;" +
    "}" +
    "#txid-widget-btn:hover{transform:scale(1.07);box-shadow:0 6px 28px rgba(99,102,241,.55)}" +
    "#txid-widget-btn svg{display:block}" +
    "#txid-widget-frame-wrap{" +
    "position:fixed;bottom:92px;right:24px;z-index:2147483645;" +
    "width:380px;height:420px;max-height:calc(100vh - 152px);border-radius:16px;" +
    "box-shadow:0 8px 48px rgba(0,0,0,.45);" +
    "overflow:hidden;display:none;background-color:#0a0a0f;" +
    "}" +
    "#txid-widget-frame-wrap.open{display:block}" +
    "#txid-widget-frame{width:100%;height:100%;border:none;display:block}" +
    "@media(max-width:440px){" +
    "#txid-widget-frame-wrap{right:0;bottom:80px;width:100%;border-radius:16px 16px 0 0;max-height:calc(100vh - 100px)}" +
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
  // Lazy-load: only set src when first opened
  var loaded = false;

  wrap.appendChild(iframe);
  root.appendChild(btn);
  root.appendChild(wrap);
  document.body.appendChild(root);

  // ── Toggle ───────────────────────────────────────────────────────────────

  var open = false;

  btn.addEventListener("click", function () {
    open = !open;
    if (open) {
      if (!loaded) {
        iframe.src = BASE + "/widget?key=" + encodeURIComponent(key);
        loaded = true;
      }
      wrap.classList.add("open");
      btn.innerHTML = CLOSE_ICON;
      btn.setAttribute("aria-label", "Close support chat");
    } else {
      wrap.classList.remove("open");
      btn.innerHTML = CHAT_ICON;
      btn.setAttribute("aria-label", "Open support chat");
    }
  });

  // Close when iframe posts a "txid-close" message
  window.addEventListener("message", function (e) {
    if (e.data === "txid-close" && open) {
      btn.click();
    }
  });
})();
