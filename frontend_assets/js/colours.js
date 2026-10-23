/* Cintamani — colour swatches on product pages (/collection/<slug>)
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

  // product pages live at /collection/<slug> (older links: art/u-N.html)
  function productId() {
    var last = location.pathname.replace(/\.html$/, "").replace(/\/+$/, "").split("/").pop();
    for (var id in PRODUCTS) if (PRODUCTS[id].slug === last) return id;
    return PRODUCTS[last] ? last : null;
  }

  // "Walaakulu White (Snow White)": the Cintamani name with the plain colour name
  function fullName(c) { return c.shade ? c.name + " (" + c.shade + ")" : c.name; }

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
              ' data-name="' + esc(c.name) + '" title="' + esc(fullName(c)) + '" style="' + swatchStyle(c) + '">' +
              '<span class="cm-sr">' + esc(fullName(c)) + "</span></button></li>";
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
    label.innerHTML = 'Colour <strong></strong><em></em><span>' + COLOURS.length + " colours available</span>";

    place(rail, image);
    var details = document.querySelector(".art_main_details");
    if (details) details.parentNode.insertBefore(label, details.nextSibling);

    select(rail, start, false);
    wire(rail, id);
    // once laid out: align with the photo and centre the selected colour
    // (repeated while the template finishes laying out the page, which can reset the scroll)
    [50, 700, 1600].forEach(function (ms) {
      setTimeout(function () { if (rail.isConnected) { place(rail, image); scrollToSelected(rail); } }, ms);
    });
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
    var shade = document.querySelector(".cm-colour_label em");
    var c = COLOURS.find(function (x) { return x.name === name; });
    if (shade) shade.textContent = c && c.shade ? "(" + c.shade + ")" : "";
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
      (c.shade ? c.shade + " · " : "") + (COLOURS.indexOf(c) + 1) + " / " + COLOURS.length + (btn.classList.contains("is-selected") ? " · selected" : "");
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

/* Scroll hint on product pages — on tablets/desktops the page moves sideways (the wheel or trackpad
 * drives it), which isn't obvious at first glance. A small "Scroll to explore" cue sits at the bottom
 * right and fades away once the visitor scrolls. Hidden on phones (CSS), where the page scrolls down.
 */
(function () {
  "use strict";
  var hint = null;

  function make() {
    var el = document.createElement("div");
    el.className = "cm-scrollhint";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<span class="cm-scrollhint_text">Scroll to explore</span>' +
      '<span class="cm-scrollhint_text--phone">Scroll for more details</span>' +
      '<span class="cm-scrollhint_line"><span class="cm-scrollhint_dot"></span></span>';
    return el;
  }
  function onProduct() { return !!document.querySelector(".section_art_hero"); }
  function update() {
    if (!hint) return;
    hint.classList.toggle("is-gone", window.scrollY > 40);
  }
  function check() {
    if (onProduct()) {
      if (!hint) {
        hint = make();
        document.body.appendChild(hint);
        update();
        setTimeout(function () { if (hint) hint.classList.add("is-shown"); }, 1400);
      }
    } else if (hint) {
      hint.remove();
      hint = null;
    }
  }
  window.addEventListener("scroll", update, { passive: true });
  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; check(); }, 80);
  }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", check);
  else check();
})();


/* Size chart: a vertical "Size chart" tab on the left of the product photo (mirroring the colour
 * rail on the right; a plain link under the photo on phones) and a dialog with the client's chart
 * from shop-data.js, in inches or centimetres. Other scripts open it with
 * window.CintamaniSizeChart.open({ size: "M" }) — the cart uses this beside its size buttons.
 */
(function () {
  "use strict";

  var SHOP = window.CINTAMANI_SHOP;
  var CHART = SHOP && SHOP.sizeChart;
  if (!CHART || !CHART.length) return;

  var UNIT_KEY = "cintamani_size_unit";
  var unit = "in";
  try { if (localStorage.getItem(UNIT_KEY) === "cm") unit = "cm"; } catch (e) { /* storage blocked */ }

  var dialog = null, lastFocus = null, highlight = null;

  var fmt = function (inches) {
    return unit === "in" ? String(inches) : String(Math.round(inches * 2.54));
  };

  function rows() {
    return CHART.map(function (r) {
      var on = r.size === highlight;
      return '<tr' + (on ? ' class="is-current" aria-current="true"' : "") + '><th scope="row">' + r.size + "</th>" +
        "<td>" + fmt(r.bust) + "</td><td>" + fmt(r.waist) + "</td><td>" + fmt(r.hip) + "</td></tr>";
    }).join("");
  }

  function paint() {
    if (!dialog) return;
    dialog.querySelector("tbody").innerHTML = rows();
    dialog.querySelector(".cm-size_unitname").textContent = unit === "in" ? "inches" : "centimetres";
    dialog.querySelectorAll("[data-unit]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-unit") === unit));
    });
  }

  function make() {
    dialog = document.createElement("div");
    dialog.className = "cm-size";
    dialog.setAttribute("data-lenis-prevent", "");
    dialog.innerHTML =
      '<div class="cm-size_backdrop" data-size-close></div>' +
      '<div class="cm-size_panel" role="dialog" aria-modal="true" aria-labelledby="cm-size-title">' +
        '<button type="button" class="cm-size_close" data-size-close aria-label="Close the size chart">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<p class="cm-size_eyebrow">Tailored to order</p>' +
        '<h2 class="cm-size_title" id="cm-size-title">Size <em>chart</em></h2>' +
        '<p class="cm-size_lead">Body measurements in <span class="cm-size_unitname">inches</span>. Measure over light clothing and pick the size that matches.</p>' +
        '<div class="cm-size_units" role="group" aria-label="Units">' +
          '<button type="button" data-unit="in" aria-pressed="true">Inches</button>' +
          '<button type="button" data-unit="cm" aria-pressed="false">Centimetres</button>' +
        "</div>" +
        '<div class="cm-size_tablewrap"><table class="cm-size_table">' +
          '<thead><tr><th scope="col">Size</th><th scope="col">Bust</th><th scope="col">Waist</th><th scope="col">Hip</th></tr></thead>' +
          "<tbody></tbody>" +
        "</table></div>" +
        '<dl class="cm-size_how">' +
          "<div><dt>Bust</dt><dd>Around the fullest part of your chest, tape level under the arms.</dd></div>" +
          "<div><dt>Waist</dt><dd>Around the narrowest part of your waist.</dd></div>" +
          "<div><dt>Hip</dt><dd>Around the fullest part of your hips, feet together.</dd></div>" +
        "</dl>" +
        '<p class="cm-size_note">Between two sizes? Choose the larger one, or add your measurements in the order note — every piece is tailored for you, so we can adjust.</p>' +
      "</div>";

    dialog.addEventListener("click", function (e) {
      if (e.target.closest("[data-size-close]")) { close(); return; }
      var u = e.target.closest("[data-unit]");
      if (u) {
        unit = u.getAttribute("data-unit");
        try { localStorage.setItem(UNIT_KEY, unit); } catch (err) { /* storage blocked */ }
        paint();
      }
    });
    dialog.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); return; }
      if (e.key !== "Tab") return;
      // keep keyboard focus inside the dialog
      var f = dialog.querySelectorAll("button");
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function open(opts) {
    highlight = (opts && opts.size) || null;
    if (!dialog) make();
    paint();
    lastFocus = document.activeElement;
    if (!document.body.contains(dialog)) document.body.appendChild(dialog);
    requestAnimationFrame(function () { dialog.classList.add("is-open"); });
    setTimeout(function () { dialog.classList.add("is-open"); }, 30);
    dialog.querySelector(".cm-size_close").focus({ preventScroll: true });
  }

  function close() {
    if (!dialog) return;
    dialog.classList.remove("is-open");
    setTimeout(function () { if (!dialog.classList.contains("is-open")) dialog.remove(); }, 450);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  window.CintamaniSizeChart = { open: open, close: close };

  // --- the tab beside the product photo -------------------------------------------------------
  function addTab() {
    var image = document.querySelector(".art_main_image");
    if (!image || document.querySelector(".cm-sizetab")) return;
    var tab = document.createElement("button");
    tab.type = "button";
    tab.className = "cm-sizetab";
    tab.setAttribute("aria-haspopup", "dialog");
    tab.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18v8H3zM7 8v3M11 8v4M15 8v3M19 8v4"/></svg>' +
      "<span>Size chart</span>";
    tab.addEventListener("click", function () { open(); });
    // after the colour rail when it's there (phones show both under the photo, rail first)
    var rail = image.parentNode.querySelector(".cm-colours");
    var after = rail || image;
    after.parentNode.insertBefore(tab, after.nextSibling);
  }

  var pending = null;
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () { pending = null; addTab(); }, 120);
  }
  addTab();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();

/* Product photo gallery: the main photo plus the extra photos listed in shop-data.js (gallery),
 * with ‹ › arrows on the photo, dots, swipe on phones and arrow keys. The extra photos are
 * portrait; they fill the square frame (cropped a little top and bottom).
 */
(function () {
  "use strict";

  var SHOP = window.CINTAMANI_SHOP;
  if (!SHOP) return;
  var PRODUCTS = {};
  SHOP.products.forEach(function (p) { PRODUCTS[p.id] = p; });

  function productId() {
    var last = location.pathname.replace(/\.html$/, "").replace(/\/+$/, "").split("/").pop();
    for (var id in PRODUCTS) if (PRODUCTS[id].slug === last) return id;
    return PRODUCTS[last] ? last : null;
  }
  var asset = function (p) { return "/" + p.split("/").map(encodeURIComponent).join("/"); };
  var CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';

  function build() {
    var id = productId();
    var product = id && PRODUCTS[id];
    if (!product || !product.gallery || !product.gallery.length) return;
    var box = document.querySelector(".section_art_hero .art_main_image") || document.querySelector(".art_main_image");
    if (!box || box.querySelector(".cm-gal")) return;

    var photos = product.gallery;
    var total = photos.length + 1;
    var gal = document.createElement("div");
    gal.className = "cm-gal";
    gal.innerHTML =
      photos.map(function (photo, i) {
        // a photo is a path, or { src, y } where y (0-100) picks which band of the portrait shows
        var src = photo.src || photo;
        var pos = photo.y != null ? ' style="object-position:50% ' + photo.y + '%"' : "";
        return '<div class="cm-gal_slide" data-i="' + (i + 1) + '" aria-hidden="true">' +
          '<img class="cm-gal_img" alt="' + product.name + ', photo ' + (i + 2) + " of " + total + '" loading="lazy" src="' + asset(src) + '"' + pos + '>' +
        "</div>";
      }).join("") +
      '<button type="button" class="cm-gal_arrow is-prev" aria-label="Previous photo">' + CHEVRON + "</button>" +
      '<button type="button" class="cm-gal_arrow is-next" aria-label="Next photo">' + CHEVRON + "</button>" +
      '<div class="cm-gal_dots" role="tablist" aria-label="Photos">' +
        Array.apply(null, { length: total }).map(function (_, i) {
          return '<button type="button" class="cm-gal_dot" role="tab" data-go="' + i + '" aria-label="Photo ' + (i + 1) + " of " + total + '"></button>';
        }).join("") +
      "</div>" +
      '<p class="cm-gal_count" aria-live="polite"></p>';
    box.appendChild(gal);
    box.classList.add("has-gallery");

    var at = 0;
    function show(i) {
      at = (i + total) % total;
      gal.querySelectorAll(".cm-gal_slide").forEach(function (s) {
        var on = Number(s.getAttribute("data-i")) === at;
        s.classList.toggle("is-on", on);
        s.setAttribute("aria-hidden", String(!on));
      });
      gal.querySelectorAll(".cm-gal_dot").forEach(function (d, k) { d.setAttribute("aria-selected", String(k === at)); });
      gal.querySelector(".cm-gal_count").textContent = "Photo " + (at + 1) + " of " + total;
    }
    show(0);

    gal.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;
      e.preventDefault();
      e.stopPropagation(); // never reaches "Add to cart" or the photo's own click
      if (t.classList.contains("is-prev")) show(at - 1);
      else if (t.classList.contains("is-next")) show(at + 1);
      else if (t.hasAttribute("data-go")) show(Number(t.getAttribute("data-go")));
    });
    gal.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1); }
    });
    // swipe on touch screens
    var x0 = null, y0 = null;
    box.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) show(at + (dx < 0 ? 1 : -1));
      x0 = y0 = null;
    }, { passive: true });
  }

  var pending = null;
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () { pending = null; build(); }, 120);
  }
  build();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();

/* Phones: an "Add to cart" bar pinned to the bottom of product pages. It shows while the page's
 * own Add to cart button is off screen and steps aside once that button is in view. The button
 * carries the same .art_cart class, so cart.js adds the piece in the colour picked on the rail.
 */
(function () {
  "use strict";

  var SHOP = window.CINTAMANI_SHOP;
  if (!SHOP || !window.IntersectionObserver) return;
  var PRODUCTS = {};
  SHOP.products.forEach(function (p) { PRODUCTS[p.id] = p; });
  var phone = window.matchMedia("(max-width: 767px)");

  function productId() {
    var last = location.pathname.replace(/\.html$/, "").replace(/\/+$/, "").split("/").pop();
    for (var id in PRODUCTS) if (PRODUCTS[id].slug === last) return id;
    return PRODUCTS[last] ? last : null;
  }
  var lkr = function (n) { return "LKR " + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  var bar = null, watch = null, inView = false;

  function update() {
    if (!bar) return;
    bar.classList.toggle("is-shown", phone.matches && !inView);
  }

  function build() {
    var id = productId();
    var own = document.querySelector(".art_cart--button");
    if (!id || !own) { teardown(); return; }
    if (bar && bar.getAttribute("data-id") === id && document.body.contains(bar)) return;
    teardown();
    var p = PRODUCTS[id];
    bar = document.createElement("div");
    bar.className = "cm-buybar";
    bar.setAttribute("data-id", id);
    bar.innerHTML =
      '<span class="cm-buybar_info"><span class="cm-buybar_name">' + p.name + '</span><span class="cm-buybar_price">' + lkr(p.price) + "</span></span>" +
      '<button type="button" class="art_cart cm-buybar_btn">Add to cart</button>';
    document.body.appendChild(bar);
    inView = false;
    watch = new IntersectionObserver(function (entries) {
      inView = entries.some(function (e) { return e.isIntersecting; });
      update();
    });
    watch.observe(own);
    setTimeout(update, 600);
  }

  function teardown() {
    if (watch) { watch.disconnect(); watch = null; }
    if (bar) { bar.remove(); bar = null; }
  }

  if (phone.addEventListener) phone.addEventListener("change", update);
  var pending = null;
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () { pending = null; build(); }, 150);
  }
  build();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();


/* Phones turned sideways: a calm "turn your phone upright" screen (styles in cart.css, shown only
 * for touch screens in landscape under 500px tall). "Continue anyway" hides it for this visit.
 */
(function () {
  "use strict";
  var KEY = "cintamani_rotate_ok";
  try { if (sessionStorage.getItem(KEY)) document.documentElement.classList.add("cm-rotate-ok"); } catch (e) { /* storage blocked */ }
  function add() {
    if (document.querySelector(".cm-rotate") || !document.body) return;
    var logo = document.querySelector(".navbar_logo, .nav_logo_wrap img");
    var el = document.createElement("div");
    el.className = "cm-rotate";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Turn your phone upright");
    el.innerHTML =
      '<div class="cm-rotate_box">' +
        (logo ? '<img class="cm-rotate_logo" alt="" src="' + logo.getAttribute("src") + '">' : "") +
        '<span class="cm-rotate_phone" aria-hidden="true"></span>' +
        '<p class="cm-rotate_title">Turn your phone <em>upright</em></p>' +
        '<p class="cm-rotate_text">Cintamani is designed to be explored with your phone held upright.</p>' +
        '<button type="button" class="cm-rotate_skip">Continue anyway</button>' +
      "</div>";
    el.querySelector(".cm-rotate_skip").addEventListener("click", function () {
      document.documentElement.classList.add("cm-rotate-ok");
      try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* storage blocked */ }
    });
    document.body.appendChild(el);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add);
  else add();
})();

/* Images below the fold (data-cm-src, see the pages): the template's intro downloads every <img>
 * on the page before it finishes, so those images carry a same-sized stand-in until needed.
 * Each one gets its real photo as it nears the screen, and any left over a few seconds after
 * the page is ready (marquees slide in from off-screen, so they can't wait to be seen).
 */
(function () {
  "use strict";

  function show(img) {
    var src = img.getAttribute("data-cm-src");
    if (!src) return;
    img.removeAttribute("data-cm-src");
    img.src = src;
  }

  var near = window.IntersectionObserver
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          near.unobserve(e.target);
          show(e.target);
        });
      }, { rootMargin: "900px 0px" })
    : null;

  var restTimer = null;
  function showRest() {
    restTimer = null;
    document.querySelectorAll("img[data-cm-src]").forEach(show);
  }

  var pending = false;
  function scan() {
    pending = false;
    var found = false;
    document.querySelectorAll("img[data-cm-src]:not([data-cm-watched])").forEach(function (img) {
      img.setAttribute("data-cm-watched", "");
      found = true;
      if (near) near.observe(img);
      else show(img);
    });
    // the rest follow once the page (and its intro) has had its turn
    if (found && !restTimer) {
      restTimer = setTimeout(function () {
        if (window.requestIdleCallback) requestIdleCallback(showRest, { timeout: 2000 });
        else showRest();
      }, document.readyState === "complete" ? 3500 : 6000);
    }
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(scan);
  }

  scan();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
