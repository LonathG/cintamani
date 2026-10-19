/* Cintamani — "Close-up Details" on product pages (art/u-N.html)
 *
 * Replaces the template's decorative dots (which all opened the same full photo) with hotspots on
 * the dress itself. Clicking one opens a lightbox with a real close-up: the full-resolution studio
 * photo, zoomed in on that spot. The last slide is the fabric close-up for the piece (its swatch
 * photo in shop-data.js).
 *
 * Points are fractions of the original photo (x, y from the top-left). A product can override them
 * in shop-data.js with `closeups: [{ label, x, y }]`.
 *
 * Like colours.js, this watches the DOM because product pages are often reached through Barba.
 */
(function () {
  "use strict";

  var SHOP = window.CINTAMANI_SHOP;
  if (!SHOP) return;
  var PRODUCTS = {};
  SHOP.products.forEach(function (p) { PRODUCTS[p.id] = p; });
  var ROOT = /\/art\//.test(location.pathname) ? "../" : "";

  var DEFAULT_POINTS = [
    { label: "Neckline", x: 0.5, y: 0.22 },
    { label: "Waist", x: 0.5, y: 0.44 },
    { label: "Hem & drape", x: 0.5, y: 0.78 },
  ];
  var ZOOM_SHOW = 0.36; // a close-up shows about a third of the photo's width

  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  function productId() {
    var m = location.pathname.match(/u-(\d+)(\.html)?\/?$/);
    return m && PRODUCTS["u-" + m[1]] ? "u-" + m[1] : null;
  }

  // ---------- hotspots on the section's photo ----------
  function build() {
    var id = productId();
    var section = document.querySelector(".section_art_details");
    if (!id || !section || section.querySelector(".cm-spots")) return;
    var frame = section.querySelector(".art_details_main_image");
    var img = frame && frame.querySelector(".art_main_img");
    if (!img) return;
    if (!img.complete || !img.naturalWidth) { img.addEventListener("load", build, { once: true }); return; }

    var product = PRODUCTS[id];
    var points = product.closeups || DEFAULT_POINTS;
    var slides = points.map(function (p) { return { label: p.label, x: p.x, y: p.y, src: img.currentSrc || img.src }; });
    if (product.swatch) slides.push({ label: "The fabric", fabric: true, src: ROOT + product.swatch });

    var layer = document.createElement("div");
    layer.className = "cm-spots";
    layer.innerHTML = points.map(function (p, i) {
      return '<button type="button" class="cm-spot" data-i="' + i + '" aria-label="Close-up: ' + esc(p.label) + '">' +
        '<span class="cm-spot_dot" aria-hidden="true"></span><span class="cm-spot_label">' + esc(p.label) + "</span></button>";
    }).join("");
    frame.appendChild(layer);

    var hint = document.createElement("p");
    hint.className = "cm-spots_hint";
    hint.textContent = "Tap a point to see it up close";
    frame.parentNode.insertBefore(hint, frame.nextSibling);

    function placeSpots() {
      var box = img.getBoundingClientRect(), fr = frame.getBoundingClientRect();
      points.forEach(function (p, i) {
        var at = toBox(img, p.x, p.y);
        var spot = layer.children[i];
        spot.style.left = (at.x + box.left - fr.left) + "px";
        spot.style.top = (at.y + box.top - fr.top) + "px";
      });
    }
    placeSpots();
    window.addEventListener("resize", placeSpots);
    setTimeout(placeSpots, 600);

    layer.addEventListener("click", function (e) {
      var spot = e.target.closest(".cm-spot");
      if (!spot) return;
      e.preventDefault();
      e.stopPropagation(); // keep the template's own lightbox out of it
      openLightbox(product, slides, Number(spot.getAttribute("data-i")));
    }, true);
  }

  // where a point of the original photo lands inside an object-fit: cover <img>
  function toBox(img, fx, fy) {
    var box = img.getBoundingClientRect();
    var nw = img.naturalWidth, nh = img.naturalHeight;
    var scale = Math.max(box.width / nw, box.height / nh);
    var w = nw * scale, h = nh * scale;
    var pos = getComputedStyle(img).objectPosition.split(" ").map(function (v) { return parseFloat(v) / 100; });
    var ox = (box.width - w) * (isNaN(pos[0]) ? 0.5 : pos[0]);
    var oy = (box.height - h) * (isNaN(pos[1]) ? 0.5 : pos[1]);
    return { x: ox + fx * w, y: oy + fy * h };
  }

  // ---------- lightbox ----------
  var box = null, state = null, lastFocus = null;

  function ensureBox() {
    if (box) { if (!document.body.contains(box)) document.body.appendChild(box); return box; }
    box = document.createElement("div");
    box.className = "cm-zoom";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Close-up details");
    box.setAttribute("data-lenis-prevent", "");
    box.innerHTML =
      '<div class="cm-zoom_backdrop" data-z="close"></div>' +
      '<button type="button" class="cm-zoom_close" data-z="close" aria-label="Close"><span></span><span></span></button>' +
      '<figure class="cm-zoom_stage">' +
        '<div class="cm-zoom_view"><img class="cm-zoom_img" alt=""></div>' +
        '<figcaption class="cm-zoom_caption"><span class="cm-zoom_name"></span><span class="cm-zoom_label"></span><span class="cm-zoom_count"></span></figcaption>' +
        '<button type="button" class="cm-zoom_arrow is-prev" data-z="prev" aria-label="Previous close-up"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>' +
        '<button type="button" class="cm-zoom_arrow is-next" data-z="next" aria-label="Next close-up"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>' +
      "</figure>" +
      '<div class="cm-zoom_thumbs" role="tablist" aria-label="Close-ups"></div>';
    document.body.appendChild(box);

    box.addEventListener("click", function (e) {
      var t = e.target.closest("[data-z], .cm-zoom_thumb");
      if (!t) return;
      if (t.classList.contains("cm-zoom_thumb")) return show(Number(t.getAttribute("data-i")));
      var z = t.getAttribute("data-z");
      if (z === "close") close();
      if (z === "prev") show(state.i - 1);
      if (z === "next") show(state.i + 1);
    });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "ArrowLeft") show(state.i - 1);
      if (e.key === "ArrowRight") show(state.i + 1);
    });
    ["wheel", "touchstart", "touchmove"].forEach(function (t) {
      box.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
    });
    window.addEventListener("resize", function () { if (state && box.classList.contains("is-open")) frame(); });
    return box;
  }

  function openLightbox(product, slides, i) {
    ensureBox();
    lastFocus = document.activeElement;
    state = { product: product, slides: slides, i: 0 };
    box.querySelector(".cm-zoom_name").textContent = product.name;
    box.querySelector(".cm-zoom_thumbs").innerHTML = slides.map(function (s, k) {
      return '<button type="button" class="cm-zoom_thumb" role="tab" data-i="' + k + '" aria-label="' + esc(s.label) + '">' +
        '<span class="cm-zoom_thumb_img" style="background-image:url(\'' + s.src + "')" + (s.fabric ? "" : ";background-size:" + (100 / ZOOM_SHOW) + "% auto;background-position:" + (s.x * 100) + "% " + (s.y * 100) + "%") + '"></span>' +
        "<span>" + esc(s.label) + "</span></button>";
    }).join("");
    box.classList.add("is-open");
    document.documentElement.style.overflow = "hidden";
    show(i);
    setTimeout(function () { box.querySelector(".cm-zoom_close").focus({ preventScroll: true }); }, 50);
  }

  function close() {
    box.classList.remove("is-open");
    document.documentElement.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function show(i) {
    var n = state.slides.length;
    state.i = (i + n) % n;
    var s = state.slides[state.i];
    var img = box.querySelector(".cm-zoom_img");
    box.querySelector(".cm-zoom_label").textContent = s.label;
    box.querySelector(".cm-zoom_count").textContent = (state.i + 1) + " / " + n;
    box.querySelectorAll(".cm-zoom_thumb").forEach(function (t, k) {
      t.classList.toggle("is-active", k === state.i);
      t.setAttribute("aria-selected", String(k === state.i));
    });
    box.classList.add("is-changing");
    var apply = function () { frame(); requestAnimationFrame(function () { box.classList.remove("is-changing"); }); setTimeout(function () { box.classList.remove("is-changing"); }, 60); };
    if (img.getAttribute("src") === s.src && img.complete) apply();
    else { img.onload = apply; img.setAttribute("src", s.src); }
    img.alt = state.product.name + " — " + s.label;
  }

  // size and position the photo so the chosen point fills the square viewport
  function frame() {
    var s = state.slides[state.i];
    var view = box.querySelector(".cm-zoom_view");
    var img = box.querySelector(".cm-zoom_img");
    var V = view.clientWidth, H = view.clientHeight;
    var nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
    if (s.fabric) {
      // the fabric photo is already a close-up: just fill the frame
      var k = Math.max(V / nw, H / nh);
      img.style.width = nw * k + "px";
      img.style.transform = "translate(" + (V - nw * k) / 2 + "px," + (H - nh * k) / 2 + "px)";
      return;
    }
    var z = V / (nw * ZOOM_SHOW);
    var w = nw * z, h = nh * z;
    var left = Math.min(0, Math.max(V - w, V / 2 - s.x * w));
    var top = Math.min(0, Math.max(H - h, H / 2 - s.y * h));
    img.style.width = w + "px";
    img.style.transform = "translate(" + left + "px," + top + "px)";
  }

  // build now and whenever Barba swaps a product page in
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; build(); }, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
