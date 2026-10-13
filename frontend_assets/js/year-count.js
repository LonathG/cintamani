// The hosted template script (lumen-artspace.vercel.app/dist/main.js) animates the
// ".zoom_count" year from 10 to 25 on scroll. Keep it fixed so the section always
// reads "Crafting Linen since ©2026".
var YEAR_SUFFIX = "26";

document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".zoom_count").forEach(function (el) {
    var options = { childList: true, characterData: true, subtree: true };
    var observer = new MutationObserver(function () {
      if (el.textContent.trim() === YEAR_SUFFIX) return;
      // Pause observing so our own write doesn't retrigger the observer
      observer.disconnect();
      el.textContent = YEAR_SUFFIX;
      observer.observe(el, options);
    });
    observer.observe(el, options);
  });
});
