/**
 * The embeddable widget loader, served at /widget.js. Plain JavaScript in a
 * string so it ships with no build step and no dependencies: it draws a
 * launcher button, then opens the bot in an iframe pointed at this origin's
 * embed page. The host page never sees a provider key, and the widget never
 * touches the host page's DOM beyond its own two elements.
 */
export function widgetScript(origin: string): string {
  return `(function () {
  "use strict";
  if (window.GixxerWidget) return;
  var script = document.currentScript;
  var key = script && script.getAttribute("data-bot");
  if (!key || !/^gx_[A-Za-z0-9_-]{16,32}$/.test(key)) { console.warn("[Gixxer] missing or invalid data-bot attribute"); return; }
  var ORIGIN = ${JSON.stringify(origin)};
  var host = encodeURIComponent(window.location.origin);
  var open = false, loaded = false, config = null;

  var root = document.createElement("div");
  root.setAttribute("data-gixxer-widget", key);
  root.style.cssText = "position:fixed;z-index:2147483000;bottom:20px;right:20px;font-family:system-ui,sans-serif";

  var button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Open chat");
  button.setAttribute("aria-expanded", "false");
  button.style.cssText = "width:56px;height:56px;border-radius:9999px;border:0;cursor:pointer;background:#030000;color:#fff;box-shadow:0 12px 32px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;transition:transform .2s ease";
  button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  var frame = document.createElement("iframe");
  frame.title = "Chat";
  frame.setAttribute("allow", "clipboard-write");
  frame.style.cssText = "position:absolute;bottom:72px;right:0;width:min(380px,calc(100vw - 32px));height:min(600px,calc(100vh - 110px));border:0;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.3);background:#fff;display:none;opacity:0;transform:translateY(8px);transition:opacity .22s ease,transform .22s ease";

  function applyConfig(c) {
    config = c;
    if (c && c.theme) {
      button.style.background = c.theme.accent || "#030000";
      if (c.theme.position === "left") { root.style.right = "auto"; root.style.left = "20px"; frame.style.right = "auto"; frame.style.left = "0"; }
    }
  }

  function setOpen(next) {
    open = next;
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    if (open) {
      if (!loaded) { frame.src = ORIGIN + "/embed/" + encodeURIComponent(key) + "?host=" + host; loaded = true; }
      frame.style.display = "block";
      requestAnimationFrame(function () { frame.style.opacity = "1"; frame.style.transform = "translateY(0)"; });
    } else {
      frame.style.opacity = "0"; frame.style.transform = "translateY(8px)";
      setTimeout(function () { if (!open) frame.style.display = "none"; }, 220);
    }
  }

  button.addEventListener("click", function () { setOpen(!open); });
  window.addEventListener("message", function (event) {
    if (event.origin !== ORIGIN || !event.data || event.data.source !== "gixxer-widget") return;
    if (event.data.type === "close") setOpen(false);
  });

  root.appendChild(frame);
  root.appendChild(button);
  (document.body || document.documentElement).appendChild(root);

  try {
    fetch(ORIGIN + "/api/widget/" + encodeURIComponent(key) + "/config", { mode: "cors" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(applyConfig)
      .catch(function () {});
  } catch (e) {}

  window.GixxerWidget = { open: function () { setOpen(true); }, close: function () { setOpen(false); }, key: key };
})();`;
}
