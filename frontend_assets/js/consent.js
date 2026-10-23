/* Cintamani — cookie notice
 *
 * Essential storage (cart, sign-in, checkout details) always works: the shop can't run without it.
 * Analytics cookies only run after "Accept all". Each page's <head> starts Google's Consent Mode
 * with analytics "denied" (or "granted" if already accepted) before the Analytics tag loads; this
 * file shows the notice and updates the choice. A "Cookie settings" link in the footer reopens it.
 */
(function () {
  "use strict";

  var KEY = "cintamani_consent_v1";

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function write(analytics) {
    try { localStorage.setItem(KEY, JSON.stringify({ analytics: analytics, at: new Date().toISOString() })); } catch (e) { /* storage blocked */ }
    if (typeof window.gtag === "function") {
      window.gtag("consent", "update", { analytics_storage: analytics ? "granted" : "denied" });
    }
  }

  var el = null;
  function show() {
    if (!el) {
      el = document.createElement("div");
      el.className = "cm-consent";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-live", "polite");
      el.setAttribute("aria-label", "Cookie preferences");
      el.innerHTML =
        '<p class="cm-consent_title">A note on <em>cookies</em></p>' +
        '<p class="cm-consent_text">We use essential storage to keep your selection, sign-in and checkout details working. ' +
          "With your permission we'd also use analytics cookies to understand how the site is used. " +
          // the Terms page sits outside the page-transition system, so this must be a plain page load
          '<a href="/terms#cookies" data-barba-prevent="self">Read our cookie policy</a></p>' +
        '<div class="cm-consent_actions">' +
          '<button type="button" class="cm-consent_btn is-primary" data-consent="all">Accept all</button>' +
          '<button type="button" class="cm-consent_btn" data-consent="essential">Essential only</button>' +
        "</div>";
      el.addEventListener("click", function (e) {
        var b = e.target.closest("[data-consent]");
        if (!b) return;
        write(b.getAttribute("data-consent") === "all");
        hide();
      });
    }
    if (!document.body.contains(el)) document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("is-shown"); });
    setTimeout(function () { el.classList.add("is-shown"); }, 30);
  }
  function hide() {
    if (el) el.classList.remove("is-shown");
  }

  window.CintamaniCookies = { open: show };

  // styles live here so the notice looks right on every page, whatever else the page loads
  var CSS =
    ".cm-consent{position:fixed;left:1.5rem;bottom:1.5rem;z-index:3100;max-width:26rem;padding:1.3rem 1.4rem 1.2rem;" +
      "border:1px solid rgba(201,180,109,.35);border-radius:6px;background:rgba(18,15,11,.9);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);" +
      "box-shadow:0 20px 50px rgba(0,0,0,.5);color:#f2ede4;font-family:var(--font--secondary-family,'LA Neue Montreal',Arial,sans-serif);" +
      "opacity:0;transform:translateY(1rem);pointer-events:none;transition:opacity .5s ease,transform .6s cubic-bezier(.22,1,.36,1)}" +
    ".cm-consent.is-shown{opacity:1;transform:none;pointer-events:auto}" +
    // the cart / checkout is a full-screen dialog: the notice steps aside while it is open
    // (it covered the checkout buttons) and comes back when it closes
    "body:has(.cm-cart.is-open) .cm-consent{z-index:2900;opacity:0;pointer-events:none}" +
    ".cm-consent_title{margin:0 0 .5rem;font-family:var(--font--primary-family,'La Ivyprestodisplay','Times New Roman',serif);font-size:1.35rem;font-weight:300;line-height:1.1}" +
    ".cm-consent_title em{color:#e2d3a8}" +
    ".cm-consent_text{margin:0 0 1rem;font-size:.85rem;line-height:1.55;color:rgba(255,255,255,.72)}" +
    ".cm-consent_text a{color:#e2d3a8;text-underline-offset:3px}" +
    ".cm-consent_actions{display:flex;gap:.6rem;flex-wrap:wrap}" +
    ".cm-consent_btn{padding:.6rem 1.1rem;border:1px solid rgba(255,255,255,.3);border-radius:999px;background:transparent;color:#f2ede4;" +
      "font:inherit;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:background-color .3s,color .3s,border-color .3s}" +
    ".cm-consent_btn:hover,.cm-consent_btn:focus-visible{border-color:#c9b46d;color:#e2d3a8;outline:none}" +
    ".cm-consent_btn.is-primary{background:#c9b46d;border-color:#c9b46d;color:#120d08}" +
    ".cm-consent_btn.is-primary:hover,.cm-consent_btn.is-primary:focus-visible{background:#e2d3a8;border-color:#e2d3a8;color:#120d08}" +
    "@media (max-width:767px){.cm-consent{left:1rem;right:1rem;bottom:1rem;max-width:none}}";
  function addStyles() {
    if (document.getElementById("cm-consent-css")) return;
    var st = document.createElement("style");
    st.id = "cm-consent-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function init() {
    addStyles();
    // shown straight away: on phones the notice is the largest text on screen, so a delayed
    // fade-in became the page's "largest paint" in Google's speed test
    if (!read()) show();
  }
  // the script sits at the end of <body>, so it can show the notice without waiting for the rest
  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
