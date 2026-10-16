/* Cintamani — colour swatches on product pages (art/u-N.html)
 *
 * Every piece comes in the colours listed in shop-data.js. Desktop: a vertical rail beside the
 * photo, five swatches at a time with ▲/▼; hovering one shows a larger swatch and its name to the
 * side; clicking selects it. Phones: a swipeable row under the photo; tapping selects.
 * The selected colour is read by cart.js when "Add to cart" is pressed (data-selected).
 *
 * Product pages are often reached through Barba (no page load), so this watches the DOM and builds
 * the rail whenever a product page appears.
 */
(function () {
  "use strict";

  var SHOP = window.CINTAMANI_SHOP;
  if (!SHOP || !SHOP.colours || !SHOP.colours.length) return;
  var COLOURS = SHOP.colours;
  var PRODUCTS = {};
  SHOP.products.forEach(function (p) { PRODUCTS[p.id] = p; });

  var mobile = window.matchMedia("(max-width: 767px)");
  var chosen = {}; // product id -> colour name (kept while browsing)

  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  function productId() {
    var m = location.pathname.match(/u-(\d+)(\.html)?\/?$/);
    return m && PRODUCTS["u-" + m[1]] ? "u-" + m[1] : null;
  }

  function swatchStyle(c) {
    return c.image ? "background-image:url('" + c.image + "')" : "--swatch:" + c.hex;
  }

  function build() {
    var id = productId();
    var image = document.querySelector(".art_main_image");
    if (!id || !image || document.querySelector(".cm-colours")) return;

    var product = PRODUCTS[id];
    var start = chosen[id] || product.colour;
    if (!COLOURS.some(function (c) { return c.name === start; })) start = COLOURS[0].name;

    var rail = document.createElement("div");
    rail.className = "cm-colours";
    rail.setAttribute("data-selected", start);
    rail.innerHTML =
      '<button type="button" class="cm-colours_arrow is-up" data-dir="-1" aria-label="Previous colours">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>' +
      '<div class="cm-colours_viewport">' +
        '<ul class="cm-colours_list" role="listbox" aria-label="Colours for ' + esc(product.name) + '">' +
          COLOURS.map(function (c) {
            var sel = c.name === start;
            return '<li><button type="button" role="option" class="cm-colour' + (sel ? " is-selected" : "") + '" aria-selected="' + sel + '"' +
              ' data-name="' + esc(c.name) + '" title="' + esc(c.name) + '" style="' + swatchStyle(c) + '">' +
              '<span class="cm-sr">' + esc(c.name) + "</span></button></li>";
          }).join("") +
        "</ul>" +
      "</div>" +
      '<button type="button" class="cm-colours_arrow is-down" data-dir="1" aria-label="More colours">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '<div class="cm-colours_preview" aria-hidden="true"><span class="cm-colours_preview_swatch"></span>' +
        '<span class="cm-colours_preview_name"></span><span class="cm-colours_preview_meta"></span></div>';

    // "Colour: …" line with the details under the name and price
    var label = document.createElement("div");
    label.className = "cm-colour_label";
    label.innerHTML = 'Colour <strong></strong><span>· ' + COLOURS.length + " colours available</span>";

    place(rail, image);
    var details = document.querySelector(".art_main_details");
    if (details) details.parentNode.insertBefore(label, details.nextSibling);

    select(rail, start, false);
    wire(rail, id);
    // once laid out: align with the photo and centre the selected colour
    setTimeout(function () { place(rail, image); scrollToSelected(rail); }, 50);
  }

  // right after the photo: CSS puts it beside the photo on desktop and in a row below it on phones
  // (kept out of the photo box so hovering swatches doesn't trigger the photo's own hover overlay)
  function place(rail, image) {
    if (rail.previousElementSibling !== image) image.parentNode.insertBefore(rail, image.nextSibling);
    // line up with the photo's top edge
    rail.style.top = mobile.matches ? "" : (image.getBoundingClientRect().top - image.parentNode.getBoundingClientRect().top) + "px";
  }

  function select(rail, name, remember) {
    rail.setAttribute("data-selected", name);
    rail.querySelectorAll(".cm-colour").forEach(function (b) {
      var on = b.getAttribute("data-name") === name;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-selected", String(on));
    });
    var label = document.querySelector(".cm-colour_label strong");
    if (label) label.textContent = name;
    var id = productId();
    if (remember && id) chosen[id] = name;
  }

  function preview(rail, btn) {
    var box = rail.querySelector(".cm-colours_preview");
    if (!btn || mobile.matches) { box.classList.remove("is-shown"); return; }
    var c = COLOURS.find(function (x) { return x.name === btn.getAttribute("data-name"); });
    var sw = box.querySelector(".cm-colours_preview_swatch");
    sw.setAttribute("style", swatchStyle(c));
    box.querySelector(".cm-colours_preview_name").textContent = c.name;
    box.querySelector(".cm-colours_preview_meta").textContent =
      (COLOURS.indexOf(c) + 1) + " / " + COLOURS.length + (btn.classList.contains("is-selected") ? " · selected" : "");
    // line the preview up with the hovered swatch
    var r = btn.getBoundingClientRect(), rr = rail.getBoundingClientRect();
    box.style.top = (r.top - rr.top + r.height / 2) + "px";
    // not enough room on the right (tablets, narrow laptops)? open it to the left of the rail instead
    box.classList.toggle("is-left", rr.right + 16 + box.offsetWidth > window.innerWidth - 12);
    box.classList.add("is-shown");
  }

  function scrollToSelected(rail) {
    var vp = rail.querySelector(".cm-colours_viewport");
    var sel = rail.querySelector(".cm-colour.is-selected");
    if (!sel) return;
    var li = sel.parentNode;
    // positions relative to the scrolling area itself (not the whole rail with its arrows)
    var lr = li.getBoundingClientRect(), vr = vp.getBoundingClientRect();
    if (mobile.matches) vp.scrollLeft += lr.left - vr.left - vp.clientWidth / 2 + lr.width / 2;
    else vp.scrollTop += lr.top - vr.top - vp.clientHeight / 2 + lr.height / 2;
    updateArrows(rail);
  }

  // ▲/▼ on desktop, ◀/▶ on phones (same buttons, turned sideways in CSS)
  function updateArrows(rail) {
    var vp = rail.querySelector(".cm-colours_viewport");
    var pos = mobile.matches ? vp.scrollLeft : vp.scrollTop;
    var size = mobile.matches ? vp.clientWidth : vp.clientHeight;
    var total = mobile.matches ? vp.scrollWidth : vp.scrollHeight;
    rail.querySelector(".is-up").disabled = pos <= 2;
    rail.querySelector(".is-down").disabled = pos + size >= total - 2;
  }

  function wire(rail, id) {
    var vp = rail.querySelector(".cm-colours_viewport");
    rail.addEventListener("click", function (e) {
      var sw = e.target.closest(".cm-colour");
      if (sw) { e.stopPropagation(); select(rail, sw.getAttribute("data-name"), true); preview(rail, sw); return; }
      var arrow = e.target.closest(".cm-colours_arrow");
      if (arrow) {
        e.stopPropagation();
        var li = rail.querySelector(".cm-colours_list li");
        var dir = Number(arrow.getAttribute("data-dir"));
        if (mobile.matches) vp.scrollBy({ left: li.offsetWidth * 3 * dir, behavior: "smooth" });
        else vp.scrollBy({ top: li.offsetHeight * 3 * dir, behavior: "smooth" });
      }
    });
    rail.addEventListener("mouseover", function (e) { var sw = e.target.closest(".cm-colour"); if (sw) preview(rail, sw); });
    rail.addEventListener("focusin", function (e) { var sw = e.target.closest(".cm-colour"); if (sw) preview(rail, sw); });
    rail.addEventListener("mouseleave", function () { preview(rail, null); });
    rail.addEventListener("focusout", function () { setTimeout(function () { if (!rail.contains(document.activeElement)) preview(rail, null); }, 0); });
    vp.addEventListener("scroll", function () { updateArrows(rail); preview(rail, null); }, { passive: true });
    // keep the page's smooth-scroll from swallowing wheel/touch on the rail
    ["wheel", "touchstart", "touchmove"].forEach(function (t) {
      vp.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
    });
    // arrow keys move through the colours
    rail.addEventListener("keydown", function (e) {
      var sw = e.target.closest(".cm-colour");
      if (!sw) return;
      var keys = mobile.matches ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
      var dir = e.key === keys[0] ? -1 : e.key === keys[1] ? 1 : 0;
      if (!dir) return;
      e.preventDefault();
      var all = Array.prototype.slice.call(rail.querySelectorAll(".cm-colour"));
      var next = all[all.indexOf(sw) + dir];
      if (next) { next.focus(); next.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    });
    var realign = function () {
      var image = document.querySelector(".art_main_image");
      if (image && rail.isConnected) { place(rail, image); scrollToSelected(rail); }
    };
    mobile.addEventListener("change", realign);
    window.addEventListener("resize", realign);
  }

  // build now and whenever Barba swaps a product page in
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; build(); }, 60);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
