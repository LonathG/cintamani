// Cintamani cart — receipt-paper popup.
//   Step 1 (plain paper):  confirm pieces, size, quantity and delivery details
//   Step 2 (same paper):  bank-transfer details + slip upload
//   Step 3 (same paper):  order received
//   Account (glass panel): sign in / create account / saved details + orders.
//   Visitors must be signed in to add to cart and to pay.
// Needs js/shop-data.js loaded first. Public API: window.CintamaniCart.add(productId), .open(), .account()
(function () {
  "use strict";

  var SHOP = window.CINTAMANI_SHOP;
  if (!SHOP) return;

  var script = document.currentScript;
  var ROOT = new URL("..", script ? script.src : location.href).href; // frontend_assets/
  var CART_KEY = "cintamani_cart_v1";
  var DETAILS_KEY = "cintamani_checkout_v1";
  var ACCOUNT_KEY = "cintamani_account_v1";
  var KNOWN_KEY = "cintamani_returning_v1";
  var MAX_SLIP = 5 * 1024 * 1024;
  var PRODUCTS = {};
  SHOP.products.forEach(function (p) { PRODUCTS[p.id] = p; });

  var asset = function (rel) { return ROOT + rel.split("/").map(encodeURIComponent).join("/"); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var lkr = function (n) {
    return "LKR " + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var read = function (key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  };
  var write = function (key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: cart lives for this page only */ }
  };

  // calls the order API; adds the customer session when signed in
  function apiFetch(path, options) {
    options = options || {};
    var headers = options.headers || {};
    if (account && account.token) headers.authorization = "Bearer " + account.token;
    if (options.json) {
      headers["content-type"] = "application/json";
      options.body = JSON.stringify(options.json);
    }
    if (location.protocol === "file:") {
      return Promise.reject(new Error("Accounts and checkout need the live site (or npm run dev)."));
    }
    return fetch(location.origin + "/api" + path, { method: options.method || "GET", headers: headers, body: options.body })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (res.status === 401 && account && path.indexOf("/account/") === 0 && path.indexOf("/login") < 0) signOut(true);
          if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
          return data;
        });
      }, function () {
        throw new Error("We couldn't reach the shop — please check your connection and try again.");
      });
  }

  // ---------- cart state ----------
  var cart = read(CART_KEY, []).filter(function (l) { return PRODUCTS[l.id]; });
  var details = read(DETAILS_KEY, {});
  var account = read(ACCOUNT_KEY, null); // { token, profile } while signed in
  var slipFile = null;
  var highlight = null;
  var confirmRemove = -1;   // index of the piece asking "Remove this piece?"
  var confirmClear = false; // "Clear selection" asking for confirmation
  var busy = false;

  function save() { write(CART_KEY, cart); updateTrigger(); }
  function pieces() { return cart.reduce(function (n, l) { return n + l.qty; }, 0); }
  // island-wide delivery for what's in the cart, by parcel weight (shop-data.js -> parcelFor)
  function delivery() {
    return SHOP.parcelFor(cart.map(function (l) { return { id: l.id, qty: l.qty }; }));
  }
  function kg(grams) { return (Math.round(grams / 100) / 10).toFixed(1) + " kg"; }

  function subtotal() { return cart.reduce(function (s, l) { return s + PRODUCTS[l.id].price * l.qty; }, 0); }

  var pendingAdd = null; // piece chosen while signed out; added right after sign-in
  var pendingColour = null;

  // colours every piece can be made in (shop-data.js); a line without one uses the photographed colour
  var COLOURS = SHOP.colours || [];
  function colourOf(line) {
    var name = line.colour || PRODUCTS[line.id].colour;
    var c = COLOURS.find(function (x) { return x.name === name; });
    return { name: name, hex: c ? c.hex : "transparent" };
  }

  function add(id, colour) {
    if (!PRODUCTS[id]) return;
    colour = colour || PRODUCTS[id].colour;
    if (!account) {
      pendingAdd = id;
      pendingColour = colour;
      open(4, { view: "signin", reason: "add" });
      return;
    }
    var line = cart.find(function (l) { return l.id === id && !l.size && colourOf(l).name === colour; });
    if (line) line.qty = Math.min(SHOP.maxQtyPerLine, line.qty + 1);
    else { line = { id: id, colour: colour, size: null, qty: 1 }; cart.push(line); }
    highlight = line;
    save();
    bumpTrigger();
    toast(PRODUCTS[id].name + " · " + colour);
  }

  // small note under the nav: the piece is in the selection, the cart stays closed
  var toastEl = null;
  var toastTimer = null;
  function toast(name) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "cm-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      toastEl.addEventListener("click", function (e) {
        if (!e.target.closest("[data-toast-view]")) return;
        hideToast();
        open(1);
      });
    }
    if (!document.body.contains(toastEl)) document.body.appendChild(toastEl);
    toastEl.innerHTML =
      '<span class="cm-toast_text"><em>' + esc(name) + "</em> added to your selection</span>" +
      '<button type="button" class="cm-toast_btn" data-toast-view>View</button>';
    toastEl.classList.remove("is-shown");
    void toastEl.offsetWidth;
    toastEl.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 3200);
  }
  function hideToast() {
    clearTimeout(toastTimer);
    if (toastEl) toastEl.classList.remove("is-shown");
  }

  // ---------- fonts ----------
  if (!document.querySelector("link[data-cm-fonts]")) {
    var font = document.createElement("link");
    font.rel = "stylesheet";
    font.href = "https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap";
    font.setAttribute("data-cm-fonts", "");
    document.head.appendChild(font);
  }

  // ---------- nav cart button ----------
  var trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "cm-cart-trigger";
  trigger.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
    '<path d="M5.5 8h13l-1 12.5h-11z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>' +
    '<span class="cm-cart-trigger_count" aria-hidden="true">0</span>';
  trigger.addEventListener("click", function () { open(1); });

  var accountBtn = document.createElement("button");
  accountBtn.type = "button";
  accountBtn.className = "cm-cart-trigger cm-account-trigger";
  accountBtn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">' +
    '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/></svg>' +
    '<span class="cm-account-trigger_dot" aria-hidden="true"></span>';
  accountBtn.addEventListener("click", function () { open(4); });

  // Homepage: inside the nav's button group, left of CONTACT. Other pages: floating top-right.
  // Barba swaps the nav when moving between pages, so this re-runs whenever the DOM changes.
  function placeTrigger() {
    var group = document.querySelector(".nav_wrapper .btn-group");
    var floating = !group;
    [accountBtn, trigger].forEach(function (b) { b.classList.toggle("is-floating", floating); });
    if (group) {
      if (trigger.parentNode !== group) group.insertBefore(trigger, group.firstChild);
      if (accountBtn.parentNode !== group || accountBtn.nextSibling !== trigger) group.insertBefore(accountBtn, trigger);
    } else {
      if (accountBtn.parentNode !== document.body) document.body.appendChild(accountBtn);
      if (trigger.parentNode !== document.body) document.body.appendChild(trigger);
    }
    alignFloating();
    updateTrigger();
  }

  // phones: line the floating pair up with the page's menu button (same row, same margin)
  function alignFloating() {
    var burger = Array.prototype.find.call(document.querySelectorAll(".nav_wrapper .nav_hamburger"), function (b) { return b.offsetParent; });
    var mobile = window.matchMedia("(max-width: 767px)").matches;
    [accountBtn, trigger].forEach(function (b) {
      if (!b.classList.contains("is-floating") || !mobile || !burger) { b.style.removeProperty("--cm-float-top"); b.style.removeProperty("--cm-float-edge"); return; }
      var r = burger.getBoundingClientRect();
      if (r.top < 0 || r.top > 120) return; // menu not in its resting place (scrolled or animating)
      b.style.setProperty("--cm-float-top", Math.round(r.top + (r.height - 40) / 2) + "px");
      b.style.setProperty("--cm-float-edge", Math.round(r.left) + "px");
    });
  }

  function triggerMisplaced() {
    var group = document.querySelector(".nav_wrapper .btn-group");
    var home = group || document.body;
    return trigger.parentNode !== home || accountBtn.parentNode !== home;
  }

  function updateTrigger() {
    var n = pieces();
    trigger.querySelector(".cm-cart-trigger_count").textContent = n;
    trigger.classList.toggle("has-items", n > 0);
    trigger.setAttribute("aria-label", n ? "Open cart, " + n + (n === 1 ? " piece" : " pieces") : "Open cart");
    accountBtn.classList.toggle("is-signed-in", Boolean(account));
    accountBtn.setAttribute("aria-label", account ? "Your account" : "Sign in");
  }

  function bumpTrigger() {
    trigger.classList.remove("is-bumped");
    void trigger.offsetWidth;
    trigger.classList.add("is-bumped");
  }

  // ---------- overlay ----------
  var root = document.createElement("div");
  root.className = "cm-cart";
  root.setAttribute("data-lenis-prevent", "");
  root.innerHTML =
    '<div class="cm-cart_backdrop" data-act="close"></div>' +
    '<button type="button" class="cm-cart_close" data-act="close" aria-label="Close"><span></span><span></span></button>' +
    '<div class="cm-cart_stage">' +
      paper("normal", 1) +
      paper("normal", 2) +
    "</div>" +
    '<div class="cm-auth" role="dialog" aria-modal="true" aria-labelledby="cm-auth-title">' +
      '<div class="cm-auth_glow" aria-hidden="true"><span></span><span></span><span></span></div>' +
      '<div class="cm-auth_card">' +
        '<figure class="cm-auth_media" aria-hidden="true">' +
          '<img alt="" src="' + asset("Images/Home/hero-2-cws8.jpg") + '">' +
          '<figcaption><span>Cintamani</span>Artistry <em>in Linen</em></figcaption>' +
        "</figure>" +
        '<div class="cm-auth_panel" data-lenis-prevent></div>' +
      "</div>" +
    "</div>";

  // a plain postcard: cream card, brown ink (all drawn in CSS, no paper images)
  function paper(kind, step) {
    return (
      '<section class="cm-receipt is-' + kind + '" data-step="' + step + '" role="dialog" aria-modal="true" aria-labelledby="cm-r-title-' + step + '">' +
        '<div class="cm-receipt_body"></div>' +
      "</section>"
    );
  }

  var receipts = function () { return root.querySelectorAll(".cm-receipt"); };
  var currentStep = 0;
  var lastFocus = null;

  function open(step, opts) {
    confirmRemove = -1;
    confirmClear = false;
    if (!root.classList.contains("is-open")) {
      lastFocus = document.activeElement;
      root.classList.add("is-open");
      document.documentElement.style.overflow = "hidden";
    }
    go(step || 1, opts);
  }

  function close(force) {
    if (busy && !force) return;
    root.classList.remove("is-open", "is-auth");
    root.querySelector(".cm-auth").classList.remove("is-active");
    pendingAdd = null;
    accountReason = null;
    accountReturn = null;
    receipts().forEach(function (r) { r.classList.remove("is-active", "is-leaving"); });
    currentStep = 0;
    document.documentElement.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function go(step, opts) {
    var isAuth = step === 4;
    var target = isAuth ? root.querySelector(".cm-auth") : root.querySelector('.cm-receipt[data-step="' + (step === 3 ? 2 : step) + '"]');
    render(step, opts || {});
    receipts().forEach(function (r) {
      if (r === target) return;
      if (r.classList.contains("is-active")) {
        r.classList.add("is-leaving");
        setTimeout(function () { r.classList.remove("is-leaving"); }, 900);
      }
      r.classList.remove("is-active");
    });
    root.classList.toggle("is-auth", isAuth);
    if (!isAuth) root.querySelector(".cm-auth").classList.remove("is-active");
    target.classList.add("is-active");
    if (step !== currentStep) root.scrollTop = 0; // phones scroll the whole sheet: start each step at its top
    currentStep = step;
    updateFades();
    setTimeout(function () {
      var first = target.querySelector("[data-autofocus]") || target.querySelector("button, input, a[href]");
      if (first) first.focus({ preventScroll: true });
    }, 450);
  }

  var TRASH_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 7h16"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7l1 12.5h9l1-12.5"/><path d="M10.3 10.5v6"/><path d="M13.7 10.5v6"/></svg>';

  // ---------- rendering ----------
  function head(step, eyebrow, metaRight) {
    var today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
    return (
      '<header class="cm-r_head">' +
        '<div class="cm-r_head_text">' +
          '<p class="cm-r_eyebrow">' + eyebrow + "</p>" +
          '<h2 class="cm-r_brand" id="cm-r-title-' + (step === 3 ? 2 : step) + '">Cintamani <em>Linens</em></h2>' +
          '<p class="cm-r_meta">' + metaRight + "</p>" +
        "</div>" +
        // postcard corner: a stamp with the Cintamani mark, and a postmark with today's date
        '<div class="cm-r_post" aria-hidden="true">' +
          '<span class="cm-r_postage"><img alt="" src="' + asset("downloaded_images/logo.png") + '"></span>' +
          '<span class="cm-r_postmark"><span>Colombo</span><span>' + today + "</span></span>" +
        "</div>" +
      "</header>"
    );
  }

  function field(name, label, opts) {
    opts = opts || {};
    var value = esc(opts.value !== undefined ? opts.value : details[name] || "");
    var limits = ' maxlength="' + (opts.max || 120) + '"' + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : "");
    var saved = (opts.lockable || opts.fixed) && account && account.profile ? account.profile[name] : "";
    var fixed = Boolean(saved && opts.fixed); // name + email: always the account's own
    var editing = Boolean(saved && !fixed && editingNow[name]);
    var locked = Boolean(saved && !editing);
    if (locked) limits += " readonly";
    var tool = !saved || fixed ? "" : '<span class="cm-r_tools">' + fieldTools(name, editing, opts.labelText || name) + "</span>";
    var control = opts.multiline
      ? '<textarea id="cm-f-' + name + '" name="' + name + '" rows="2" autocomplete="' + (opts.auto || "off") + '" placeholder="' + esc(opts.placeholder || "") + '" aria-describedby="cm-e-' + name + '"' + limits + ">" + value + "</textarea>"
      : '<input id="cm-f-' + name + '" name="' + name + '" type="' + (opts.type || "text") + '" autocomplete="' + (opts.auto || "off") + '" placeholder="' + esc(opts.placeholder || "") + '" value="' + value + '" aria-describedby="cm-e-' + name + '"' + limits + ">";
    return (
      '<div class="cm-r_field' + ((opts.value !== undefined ? opts.value : details[name]) ? " is-filled" : "") + (saved && !fixed ? " has-tool" : "") + (locked ? " is-locked" : "") + (fixed ? " is-fixed" : "") + (editing ? " is-editing" : "") + '" data-field="' + name + '" data-label="' + esc(opts.labelText || name) + '">' +
        '<label for="cm-f-' + name + '">' + label + "</label>" + control + tool +
        '<p class="cm-r_fielderr" id="cm-e-' + name + '" aria-live="polite"></p>' +
      "</div>"
    );
  }

  function render(step, opts) {
    var body = step === 4 ? null : root.querySelector('.cm-receipt[data-step="' + (step === 3 ? 2 : step) + '"] .cm-receipt_body');
    if (step === 1) body.innerHTML = renderSelection();
    if (step === 2) body.innerHTML = renderPayment();
    if (step === 3) body.innerHTML = renderDone(opts.order);
    if (step === 4) {
      var panel = root.querySelector(".cm-auth_panel");
      accountView = account ? "profile" : opts.view || (accountView === "register" ? "register" : "signin");
      if (opts.returnTo !== undefined) accountReturn = opts.returnTo;
      if (opts.reason !== undefined) accountReason = opts.reason;
      panel.innerHTML = renderAccount();
      panel.scrollTop = 0;
      setProfileEditing(panel, false); // saved details start locked
      if (accountView === "profile") loadOrders(panel);
    }
  }

  // Signed-in customers: delivery fields come from the saved profile. A field the customer
  // unlocks (pencil) and changes is kept for this order only; the profile itself never changes.
  var PROFILE_FIELDS = ["name", "phone", "address", "email"];

  function editedFields() {
    if (!details._editedFields || typeof details._editedFields !== "object") details._editedFields = {};
    return details._editedFields;
  }

  function applyProfile(forceReset) {
    if (!account || !account.profile) return;
    var p = account.profile;
    if (forceReset) details._editedFields = {};
    var edited = editedFields();
    PROFILE_FIELDS.forEach(function (f) {
      if (f === "name" || f === "email" || !edited[f]) { details[f] = p[f] || ""; delete edited[f]; }
    });
    delete details._edited;
    write(DETAILS_KEY, details);
  }

  var PENCIL_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
  var RESTORE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/></svg>';

  var editingNow = {}; // fields currently unlocked with the pencil (not saved anywhere)
  var CHECK_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function fieldTools(name, editing, labelText) {
    if (editing) {
      return '<button type="button" class="cm-r_pen is-done" data-act="lock-field" data-name="' + name + '" aria-label="Done editing ' + esc(labelText) + '" title="Done">' + CHECK_ICON + "</button>";
    }
    var changed = editedFields()[name];
    return (
      (changed ? '<button type="button" class="cm-r_pen is-restore" data-act="restore-field" data-name="' + name + '" aria-label="Use my saved ' + esc(labelText) + '" title="Use my saved details">' + RESTORE_ICON + "</button>" : "") +
      '<button type="button" class="cm-r_pen" data-act="edit-field" data-name="' + name + '" aria-label="Edit ' + esc(labelText) + ' for this order" title="Edit for this order">' + PENCIL_ICON + "</button>"
    );
  }

  // switch a field between editing and locked in place (no re-render, so clicks elsewhere aren't lost)
  function setFieldEditing(fieldEl, editing) {
    var name = fieldEl.getAttribute("data-field");
    var input = fieldEl.querySelector("input, textarea");
    if (editing) {
      editingNow[name] = true;
      input.removeAttribute("readonly");
    } else {
      delete editingNow[name];
      input.setAttribute("readonly", "");
      var saved = account && account.profile ? account.profile[name] || "" : "";
      if (input.value.trim() === saved) delete editedFields()[name];
      details[name] = input.value.trim();
      write(DETAILS_KEY, details);
    }
    fieldEl.classList.toggle("is-editing", editing);
    fieldEl.classList.toggle("is-locked", !editing);
    fieldEl.querySelector(".cm-r_tools").innerHTML = fieldTools(name, editing, fieldEl.getAttribute("data-label"));
    if (editing) {
      input.focus();
      var end = input.value.length;
      try { input.setSelectionRange(end, end); } catch (err) { /* not supported on every input type */ }
    }
  }

  // ✓ / Enter / clicking away: lock the change in if it's valid
  function finishEditing(fieldEl) {
    if (!fieldEl.classList.contains("is-editing")) return true;
    fieldEl.setAttribute("data-touched", "");
    if (!checkField(fieldEl)) return false;
    setFieldEditing(fieldEl, false);
    return true;
  }

  function renderSelection() {
    applyProfile(false);
    var n = pieces();
    // two columns on the landscape card (selection | delivery); they stack on phones
    var html = '<div class="cm-receipt_scroll" data-lenis-prevent>' + (cart.length ? '<div class="cm-r_col">' : "") +
      head(1, "Your selection", n + (n === 1 ? " piece" : " pieces")) + '<hr class="cm-r_rule">';

    if (!cart.length) {
      return html +
        '<div class="cm-r_empty"><p>Your selection is quietly waiting.</p>' +
        '<a class="cm-r_btn" href="/gallery">View collection</a></div></div>';
    }

    html += '<ul class="cm-r_items">' + cart.map(function (line, i) {
      var p = PRODUCTS[line.id];
      var sizes = SHOP.sizes.map(function (s) {
        return '<button type="button" class="cm-r_size" data-act="size" data-i="' + i + '" data-size="' + s + '" aria-pressed="' + (line.size === s) + '">' + s + "</button>";
      }).join("");
      return (
        '<li class="cm-r_item' + (line === highlight ? " is-new" : "") + (confirmRemove === i ? " is-confirming" : "") + '" data-i="' + i + '">' +
          '<img class="cm-r_thumb" alt="" src="' + asset(p.image) + '">' +
          "<div>" +
            '<div class="cm-r_item_top">' +
              "<div>" +
                '<p class="cm-r_name">' + esc(p.name) + "</p>" +
                '<span class="cm-r_colour"><i style="background:' + colourOf(line).hex + '"></i>' + esc(colourOf(line).name) + "</span>" +
              "</div>" +
              '<div class="cm-r_price">' + lkr(p.price * line.qty) +
                '<button type="button" class="cm-r_remove" data-act="remove" data-i="' + i + '" aria-label="Remove ' + esc(p.name) + '" title="Remove">' + TRASH_ICON + "</button>" +
              "</div>" +
            "</div>" +
            '<div class="cm-r_controls">' +
              '<fieldset class="cm-r_sizes"><legend>Size for ' + esc(p.name) + "</legend>" + sizes + "</fieldset>" +
              (line.size ? "" : '<span class="cm-r_sizehint">Select a size</span>') +
              (window.CintamaniSizeChart ? '<button type="button" class="cm-r_sizeguide" data-act="sizeguide" data-i="' + i + '">Size chart</button>' : "") +
              '<div class="cm-r_qty">' +
                '<button type="button" data-act="dec" data-i="' + i + '" aria-label="One fewer ' + esc(p.name) + '"' + (line.qty <= 1 ? " disabled" : "") + ">−</button>" +
                "<output>" + line.qty + "</output>" +
                '<button type="button" data-act="inc" data-i="' + i + '" aria-label="One more ' + esc(p.name) + '"' + (line.qty >= SHOP.maxQtyPerLine ? " disabled" : "") + ">+</button>" +
              "</div>" +
            "</div>" +
            (confirmRemove === i
              ? '<div class="cm-r_confirm" role="alert"><span>Remove this piece?</span>' +
                  '<button type="button" class="cm-r_confirm_yes" data-act="remove-yes" data-i="' + i + '" data-autofocus>Remove</button>' +
                  '<button type="button" class="cm-r_confirm_no" data-act="remove-no" data-i="' + i + '">Keep</button></div>'
              : "") +
          "</div>" +
        "</li>"
      );
    }).join("") + "</ul>";

    var n = pieces();
    html += confirmClear
      ? '<div class="cm-r_confirm is-clear" role="alert"><span>Remove all ' + n + (n === 1 ? " piece" : " pieces") + " from your selection?</span>" +
          '<button type="button" class="cm-r_confirm_yes" data-act="clear-yes" data-autofocus>Clear all</button>' +
          '<button type="button" class="cm-r_confirm_no" data-act="clear-no">Cancel</button></div>'
      : '<button type="button" class="cm-r_clear" data-act="clear">Clear selection</button>';

    var sub = subtotal();
    var parcel = delivery();
    html +=
      '<hr class="cm-r_rule">' +
      '<dl class="cm-r_totals">' +
        "<dt>Subtotal</dt><dd>" + lkr(sub) + "</dd>" +
        "<dt>Delivery <small>" + esc(SHOP.delivery.courier) + " · " + kg(parcel.grams) + "</small></dt><dd>" + lkr(parcel.fee) + "</dd>" +
        '<dt class="is-total">Total</dt><dd class="is-total">' + lkr(sub + parcel.fee) + "</dd>" +
      "</dl>" +
      "</div>" + // end of the order summary
      '<div class="cm-r_col cm-r_col--form">' +
      '<h3 class="cm-r_title">Where shall we <em>send it?</em></h3>' +
      (account ? "" : '<p class="cm-r_note">Have an account? <button type="button" class="cm-r_inline" data-act="acc-open">Sign in</button> to fill these in.</p>') +
      '<div class="cm-r_fields">' +
        field("name", "Full name", { auto: "name", max: 80, fixed: true, labelText: "full name" }) +
        field("phone", "Contact number", { type: "tel", auto: "tel", placeholder: "077 123 4567", max: 16, inputmode: "tel", lockable: true, labelText: "contact number" }) +
        field("address", "Delivery address", { multiline: true, auto: "street-address", max: 300, lockable: true, labelText: "delivery address" }) +
        field("email", account ? "Email" : "Email (optional)", { type: "email", auto: "email", max: 120, fixed: true, labelText: "email" }) +
      "</div>" +
      '<p class="cm-r_hint">Each piece is tailored to order. We will contact you on this number to confirm.</p>' +
      '<p class="cm-r_error" role="alert"></p>' +
      '<div class="cm-r_actions">' +
        '<button type="button" class="cm-r_btn" data-act="to-pay">Proceed to payment</button>' +
        '<button type="button" class="cm-r_link" data-act="close">Continue browsing</button>' +
      "</div></div></div>";
    return html;
  }

  function renderPayment() {
    var total = subtotal() + delivery().fee;
    var b = SHOP.bank;
    return (
      '<div class="cm-receipt_scroll" data-lenis-prevent>' +
        '<div class="cm-r_col">' +
        head(2, "Settle by bank transfer", pieces() + (pieces() === 1 ? " piece" : " pieces")) +
        '<hr class="cm-r_rule">' +
        '<p class="cm-r_due"><span class="cm-r_label">Amount due</span><strong>' + lkr(total) + "</strong></p>" +
        '<hr class="cm-r_rule">' +
        '<span class="cm-r_label">Pay into</span>' +
        '<dl class="cm-r_bank">' +
          "<dt>Bank</dt><dd>" + esc(b.bankName) + "</dd>" +
          "<dt>Account</dt><dd>" + esc(b.accountName) + "</dd>" +
          "<dt>Number</dt><dd>" + esc(b.accountNumber) + "</dd>" +
          "<dt>Branch</dt><dd>" + esc(b.branch) + "</dd>" +
          "<dt>Reference</dt><dd>Your name</dd>" +
        "</dl>" +
        "</div>" +
        '<div class="cm-r_col cm-r_col--form">' +
        '<h3 class="cm-r_title">Attach your <em>transfer slip</em></h3>' +
        '<label class="cm-r_slip" data-slip>' + slipInner() +
          '<input type="file" name="slip" accept="image/*,application/pdf" aria-label="Upload bank transfer slip" data-autofocus>' +
        "</label>" +
        '<div class="cm-r_fields" style="margin-top:calc(2 * var(--u))">' +
          field("payerBank", "Bank you paid from (optional)", { max: 80 }) +
          field("reference", "Transfer reference (optional)", { max: 60 }) +
        "</div>" +
        '<p class="cm-r_error" role="alert"></p>' +
        '<div class="cm-r_actions">' +
          '<button type="button" class="cm-r_btn" data-act="place">Place order</button>' +
          '<button type="button" class="cm-r_link" data-act="back">Back to selection</button>' +
        "</div>" +
        "</div>" +
      "</div>"
    );
  }

  function slipInner() {
    if (!slipFile) {
      return '<span class="cm-r_slip_layer is-shown"><span class="cm-r_slip_title">Upload slip</span><span class="cm-r_slip_note">Photo or PDF · up to 5 MB</span></span>';
    }
    var preview = /^image\/(jpeg|png|webp)$/.test(slipFile.type)
      ? '<img alt="" src="' + URL.createObjectURL(slipFile) + '">'
      : '<span class="cm-r_slip_pdf">PDF</span>';
    return '<span class="cm-r_slip_layer is-shown"><span class="cm-r_slip_preview">' + preview + "<span>" + esc(slipFile.name) + "<br>Tap to replace</span></span></span>";
  }

  var accountView = "signin";
  var accountReturn = null;

  var accountReason = null; // "add" | "pay" — why we're asking them to sign in

  // floating-label field for the glass panel (same validation hooks as the receipt fields)
  function aField(name, label, opts) {
    opts = opts || {};
    var v = esc(opts.value || "");
    var common = ' id="cm-f-' + name + '" name="' + name + '" placeholder=" " autocomplete="' + (opts.auto || "off") +
      '" maxlength="' + (opts.max || 120) + '" aria-describedby="cm-e-' + name + '"' + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : "");
    var control = opts.multiline
      ? "<textarea" + common + ' rows="2">' + v + "</textarea>"
      : '<input type="' + (opts.type || "text") + '"' + common + ' value="' + v + '">';
    return (
      '<div class="cm-r_field cm-a_field' + (opts.value ? " is-filled" : "") + '" data-field="' + name + '">' +
        control + '<label for="cm-f-' + name + '">' + label + "</label><span class=\"cm-a_line\"></span>" +
        '<p class="cm-r_fielderr" id="cm-e-' + name + '" aria-live="polite"></p>' +
      "</div>"
    );
  }

  function renderAccount() {
    var brand =
      '<div class="cm-a_brand"><img alt="" src="' + asset("downloaded_images/logo.png") + '"><span>Cintamani Linens</span></div>';

    if (accountView === "profile" && account) {
      var p = account.profile || {};
      var first = (p.name || "").split(" ")[0] || "patron";
      var n = pieces();
      return (
        brand +
        '<h2 class="cm-a_title" id="cm-auth-title">Welcome, <em>' + esc(first) + "</em></h2>" +
        '<p class="cm-a_lede">' + esc(p.email) + "</p>" +
        '<h3 class="cm-a_section">Your orders</h3>' +
        '<div class="cm-a_orders">' +
          (n
            ? '<div class="cm-a_card is-selection">' +
                '<div class="cm-a_order_top"><span>Your selection</span><span>' + lkr(subtotal() + delivery().fee) + "</span></div>" +
                '<div class="cm-a_order_meta"><span>' + n + (n === 1 ? " piece" : " pieces") + " · not yet paid</span></div>" +
                tracker(0) +
                '<button type="button" class="cm-a_btn cm-a_btn--ghost" data-act="acc-to-cart">Continue to checkout</button>' +
              "</div>"
            : "") +
          '<div data-orders><p class="cm-a_note">Loading your orders…</p></div>' +
        "</div>" +
        '<h3 class="cm-a_section">Saved details</h3>' +
        '<div class="cm-a_fields" data-profile>' +
          aField("acc_name", "Full name", { auto: "name", max: 80, value: p.name }) +
          aField("acc_phone", "Contact number", { type: "tel", auto: "tel", max: 16, inputmode: "tel", value: p.phone }) +
          aField("acc_address", "Delivery address", { multiline: true, auto: "street-address", max: 300, value: p.address }) +
        "</div>" +
        '<p class="cm-a_note">Used for your delivery at checkout.</p>' +
        '<p class="cm-r_error" role="alert"></p>' +
        '<button type="button" class="cm-a_btn" data-act="acc-save">Edit details</button>' +
        '<button type="button" class="cm-a_link cm-a_cancel" data-act="acc-cancel-edit" hidden>Cancel</button>' +
        '<button type="button" class="cm-a_link" data-act="acc-signout">Sign out</button>'
      );
    }

    var isRegister = accountView === "register";
    var reason = "";
    if (accountReason === "add" && pendingAdd && PRODUCTS[pendingAdd]) {
      reason = "Sign in or create an account to add the <strong>" + esc(PRODUCTS[pendingAdd].name) + "</strong> to your selection.";
    } else if (accountReason === "pay") {
      reason = "Sign in or create an account to continue to payment.";
    }

    return (
      brand +
      '<div class="cm-a_tabs" role="tablist" data-view="' + (isRegister ? "register" : "signin") + '">' +
        '<button type="button" role="tab" aria-selected="' + !isRegister + '" data-act="acc-view-signin">Sign in</button>' +
        '<button type="button" role="tab" aria-selected="' + isRegister + '" data-act="acc-view-register">Create account</button>' +
        '<span class="cm-a_tabline" aria-hidden="true"></span>' +
      "</div>" +
      '<h2 class="cm-a_title" id="cm-auth-title">' + (isRegister ? "Join the <em>atelier</em>" : read(KNOWN_KEY, false) ? "Welcome <em>back</em>" : "Welcome") + "</h2>" +
      (reason ? '<p class="cm-a_lede">' + reason + "</p>" : '<p class="cm-a_lede">' + (isRegister
        ? "Save your details once and they are filled in whenever you order."
        : "Sign in to shop, check out and follow your orders.") + "</p>") +
      '<div class="cm-a_fields">' +
        (isRegister ? aField("acc_name", "Full name", { auto: "name", max: 80 }) : "") +
        aField("acc_email", "Email", { type: "email", auto: isRegister ? "email" : "username", max: 160 }) +
        aField("acc_password", isRegister ? "Password · 8+ characters" : "Password", { type: "password", auto: isRegister ? "new-password" : "current-password", max: 128 }) +
      "</div>" +
      (isRegister
        ? '<div class="cm-r_field cm-a_agree" data-field="acc_terms">' +
            '<label class="cm-a_check"><input type="checkbox" name="acc_terms"><span class="cm-a_box" aria-hidden="true"></span>' +
            '<span>I have read and agree to the <a href="/terms" target="_blank" rel="noopener">Terms &amp; Conditions</a></span></label>' +
            '<p class="cm-r_fielderr" aria-live="polite"></p>' +
          "</div>"
        : "") +
      '<p class="cm-r_error" role="alert"></p>' +
      '<button type="button" class="cm-a_btn" data-act="' + (isRegister ? "acc-register" : "acc-signin") + '">' + (isRegister ? "Create account" : "Sign in") + "</button>" +
      '<p class="cm-a_note">' + (isRegister
        ? 'Already a patron? <button type="button" class="cm-a_inline" data-act="acc-view-signin">Sign in</button>'
        : 'New to Cintamani? <button type="button" class="cm-a_inline" data-act="acc-view-register">Create an account</button>' +
          '<br>Forgot your password? Contact us and we will reset it.') + "</p>"
    );
  }

  // in selection -> payment review -> accepted -> tailoring -> packed -> dispatched
  var TRACK = ["In selection", "Payment review", "Accepted", "Tailoring", "Packed", "Dispatched"];
  var ORDER_STATUSES = ["Payment Pending", "Accepted", "In Production", "Packed & Ready", "Dispatched"];
  // finished orders: no tracker, and the customer can remove them from their list
  var CLOSED_LABEL = { "Completed": "Delivered", "Cancelled": "Cancelled" };

  function tracker(step) {
    return (
      '<ol class="cm-a_track" style="--progress:' + (step / (TRACK.length - 1)) + '" aria-label="Progress: ' + TRACK[step] + '">' +
        TRACK.map(function (label, i) {
          return '<li class="' + (i < step ? "is-done" : i === step ? "is-current" : "") + '"' + (i === step ? ' aria-current="step"' : "") + "><span></span>" + label + "</li>";
        }).join("") +
      "</ol>"
    );
  }

  function loadOrders(panel) {
    var box = panel.querySelector("[data-orders]");
    if (!box) return;
    apiFetch("/account/orders").then(function (data) {
      if (!data.orders.length) {
        box.innerHTML = pieces() ? "" : '<p class="cm-a_note">No orders yet — your selection will appear here.</p>';
        return;
      }
      // orders still on their way first, then dispatched, then finished ones
      var rank = function (o) { return CLOSED_LABEL[o.status] ? 2 : o.status === "Dispatched" ? 1 : 0; };
      var list = data.orders.slice().sort(function (a, b) { return rank(a) - rank(b); });
      // own scroll box (wheel stays inside it) so a long order history doesn't stretch the panel
      box.innerHTML = '<div class="cm-a_orders' + (list.length > 2 ? " is-scroll" : "") + '" data-lenis-prevent>' + list.map(function (o) {
        var step = ORDER_STATUSES.indexOf(o.status) + 1;
        var closed = CLOSED_LABEL[o.status];
        return (
          '<div class="cm-a_card' + (closed ? " is-closed" : "") + (o.status === "Cancelled" ? " is-cancelled" : "") + '" data-order="' + esc(o.orderId) + '">' +
            '<div class="cm-a_order_top"><span>' + esc(o.orderId) + "</span><span>" + esc(o.amount) + "</span></div>" +
            '<div class="cm-a_order_meta"><span>' + esc(o.orderDate) + '</span><span class="cm-a_order_tags"><span class="cm-a_status">' + esc(closed || TRACK[step] || o.status) + "</span>" +
              (closed ? '<button type="button" class="cm-a_trash" data-act="order-remove" aria-label="Remove ' + esc(o.orderId) + ' from your list" title="Remove from your list">' +
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg></button>' : "") +
            "</span></div>" +
            (closed ? "" : tracker(Math.max(1, step))) +
            '<div class="cm-a_order_items">' + o.items.map(function (i) { return esc(i.name) + " · " + esc(i.size) + (i.qty > 1 ? " ×" + i.qty : ""); }).join("<br>") + "</div>" +
            (o.deliveryBarcode ? '<div class="cm-a_order_items">Tracking · ' + esc(o.deliveryBarcode) + "</div>" : "") +
          "</div>"
        );
      }).join("") + "</div>";
      wireOrderRemoval(box);
    }).catch(function (err) {
      box.innerHTML = '<p class="cm-a_note">' + esc(err.message) + "</p>";
    });
  }

  // trash on a delivered / cancelled order: ask first, then hide it from this customer's list
  function wireOrderRemoval(box) {
    if (box.hasAttribute("data-wired")) return; // orders can reload into the same box
    box.setAttribute("data-wired", "");
    box.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-act]");
      if (!btn || !box.contains(btn)) return;
      var card = btn.closest("[data-order]");
      var id = card && card.getAttribute("data-order");
      var act = btn.getAttribute("data-act");
      if (act === "order-remove") {
        box.querySelectorAll(".cm-a_confirm").forEach(function (c) { c.remove(); });
        var ask = document.createElement("div");
        ask.className = "cm-a_confirm";
        ask.setAttribute("role", "alert");
        ask.innerHTML = "<span>Remove " + esc(id) + " from your list?</span>" +
          '<button type="button" class="cm-a_confirm_yes" data-act="order-remove-yes">Remove</button>' +
          '<button type="button" class="cm-a_confirm_no" data-act="order-remove-no">Keep</button>';
        card.appendChild(ask);
        ask.querySelector(".cm-a_confirm_no").focus({ preventScroll: true });
        // bring the question into view inside the scrolling list (clear of the bottom fade)
        var list = card.parentNode;
        var below = ask.getBoundingClientRect().bottom - list.getBoundingClientRect().bottom + 44;
        if (below > 0) list.scrollTop += below;
      } else if (act === "order-remove-no") {
        btn.closest(".cm-a_confirm").remove();
      } else if (act === "order-remove-yes") {
        btn.disabled = true;
        btn.textContent = "Removing…";
        apiFetch("/account/orders/" + encodeURIComponent(id), { method: "DELETE" }).then(function () {
          card.classList.add("is-removing");
          setTimeout(function () {
            var list = card.parentNode;
            card.remove();
            if (list && !list.children.length) box.innerHTML = '<p class="cm-a_note">No orders yet — your selection will appear here.</p>';
            else if (list && list.children.length <= 2) list.classList.remove("is-scroll");
          }, 350);
        }, function (err) {
          var c = btn.closest(".cm-a_confirm");
          if (c) c.querySelector("span").textContent = err.message;
          btn.remove();
        });
      }
    });
  }

  function setAccount(data) {
    account = { token: data.token || (account && account.token), profile: data.profile };
    write(ACCOUNT_KEY, account);
    write(KNOWN_KEY, true); // this device has signed in before
    updateTrigger();
  }

  function signOut(silent) {
    account = null;
    try { localStorage.removeItem(ACCOUNT_KEY); } catch (e) {}
    // don't leave someone's address or selection behind on a shared device
    details = {};
    write(DETAILS_KEY, details);
    cart = [];
    save();
    updateTrigger();
    if (!silent && currentStep === 4) go(4, { view: "signin" });
  }

  // profile form: "Edit details" until something differs from the saved profile, then "Save details"
  var PROFILE_INPUTS = { acc_name: "name", acc_phone: "phone", acc_address: "address" };
  function profileDirty(scope) {
    var p = (account && account.profile) || {};
    return Object.keys(PROFILE_INPUTS).some(function (n) {
      var el = scope.querySelector('[name="' + n + '"]');
      return el && el.value.trim() !== (p[PROFILE_INPUTS[n]] || "");
    });
  }
  function syncProfileButton(scope) {
    var btn = scope.querySelector('[data-act="acc-save"]');
    if (btn && !btn.disabled) btn.textContent = isProfileEditing(scope) ? "Save details" : "Edit details";
  }

  // saved details are greyed out and locked until "Edit details" is pressed
  function isProfileEditing(scope) {
    var box = scope.querySelector("[data-profile]");
    return Boolean(box && box.classList.contains("is-editing"));
  }
  function setProfileEditing(scope, on) {
    var box = scope.querySelector("[data-profile]");
    if (!box) return;
    box.classList.toggle("is-editing", on);
    box.querySelectorAll("input, textarea").forEach(function (el) {
      if (on) el.removeAttribute("readonly"); else el.setAttribute("readonly", "");
      el.tabIndex = on ? 0 : -1;
    });
    var cancel = scope.querySelector('[data-act="acc-cancel-edit"]');
    if (cancel) cancel.hidden = !on;
    syncProfileButton(scope);
    if (on) {
      var first = box.querySelector('[name="acc_phone"]') || box.querySelector("input");
      if (first) {
        first.focus({ preventScroll: true });
        var end = first.value.length;
        try { first.setSelectionRange(end, end); } catch (err) { /* not supported on every input type */ }
        revealInReceipt(first.closest(".cm-r_field"));
      }
    }
  }
  // Cancel: put the saved values back and lock again
  function cancelProfileEdit(scope) {
    var p = (account && account.profile) || {};
    Object.keys(PROFILE_INPUTS).forEach(function (n) {
      var el = scope.querySelector('[name="' + n + '"]');
      if (!el) return;
      el.value = p[PROFILE_INPUTS[n]] || "";
      var f = el.closest(".cm-r_field");
      f.classList.toggle("is-filled", Boolean(el.value));
      f.classList.remove("is-invalid");
      var err = f.querySelector(".cm-r_fielderr");
      if (err) err.textContent = "";
    });
    showError(scope, "");
    setProfileEditing(scope, false);
  }

  function accountSubmit(act, scope, btn) {
    if (act === "acc-save" && !isProfileEditing(scope)) { setProfileEditing(scope, true); return; }
    if (act === "acc-save" && !profileDirty(scope)) { setProfileEditing(scope, false); return; } // nothing changed
    var fields = Array.prototype.slice.call(scope.querySelectorAll(".cm-r_field"));
    var ok = fields.map(function (f) { f.setAttribute("data-touched", ""); return checkField(f); }).every(Boolean);
    if (!ok) {
      showError(scope, "Please check the highlighted details.");
      var firstBad = scope.querySelector(".cm-r_field.is-invalid");
      if (firstBad) { revealInReceipt(firstBad); firstBad.querySelector("input, textarea").focus({ preventScroll: true }); }
      return;
    }
    var val = function (n) { var el = scope.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ""; };
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "One moment…";
    showError(scope, "");

    var request;
    if (act === "acc-signin") request = apiFetch("/account/login", { method: "POST", json: { email: val("acc_email"), password: scope.querySelector('[name="acc_password"]').value } });
    if (act === "acc-register") request = apiFetch("/account/register", { method: "POST", json: { name: val("acc_name"), email: val("acc_email"), password: scope.querySelector('[name="acc_password"]').value, acceptTerms: scope.querySelector('[name="acc_terms"]').checked } });
    if (act === "acc-save") request = apiFetch("/account/me", { method: "PUT", json: { name: val("acc_name"), phone: val("acc_phone"), address: val("acc_address") } });

    request.then(function (data) {
      setAccount(data);
      if (act === "acc-save") {
        applyProfile(false);
        btn.disabled = false;
        setProfileEditing(scope, false);
        btn.textContent = "Saved ✓";
        setTimeout(function () { syncProfileButton(scope); }, 1800);
        return;
      }
      applyProfile(true);
      accountReason = null;
      if (pendingAdd) {
        var id = pendingAdd;
        var chosenColour = pendingColour;
        pendingAdd = null;
        pendingColour = null;
        close(true);
        add(id, chosenColour); // now signed in: adds the piece and confirms with a note
      } else if (accountReturn === 1 && cart.length) go(1);
      else go(4, { view: "profile" });
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = label;
      showError(scope, err.message);
    });
  }

  function renderDone(order) {
    return (
      '<div class="cm-receipt_scroll cm-r_done" data-lenis-prevent>' +
        '<h2 id="cm-r-title-2">Thank <em>you</em></h2>' +
        '<span class="cm-r_label">Order received</span>' +
        '<p class="cm-r_name" style="font-size:calc(5 * var(--u))">' + esc(order.orderId) + "</p>" +
        '<span class="cm-r_stamp">Payment under review</span>' +
        '<p class="cm-r_hint">We will verify your slip and confirm your order on WhatsApp or by phone. Your pieces will then be tailored and dispatched.</p>' +
        '<div class="cm-r_actions"><button type="button" class="cm-r_btn" data-act="close" data-autofocus>Continue browsing</button></div>' +
      "</div>"
    );
  }

  // ---------- validation ----------
  function readDetails(scope) {
    scope.querySelectorAll(".cm-r_field input, .cm-r_field textarea").forEach(function (el) {
      if (el.name.indexOf("acc_") !== 0) details[el.name] = el.value.trim();
    });
    write(DETAILS_KEY, details);
  }

  function showError(scope, message) {
    var box = scope.querySelector(".cm-r_error");
    if (box) box.textContent = message || "";
  }

  var digits = function (v) { return String(v || "").replace(/\D/g, ""); };
  var RULES = {
    name: function (v) { return v.length >= 2 ? "" : "Please enter your full name."; },
    phone: function (v) {
      if (!v) return "Please enter a contact number.";
      var d = digits(v);
      return /^\+?[0-9 ()-]+$/.test(v) && d.length >= 9 && d.length <= 12 ? "" : "Please enter a valid phone number, e.g. 077 123 4567.";
    },
    address: function (v) { return v.length >= 5 ? "" : "Please enter your delivery address."; },
    email: function (v) { return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Please check your email address."; },
  };
  RULES.acc_name = RULES.name;
  RULES.acc_phone = function (v) { return v ? RULES.phone(v) : ""; }; // optional in the profile
  RULES.acc_address = function () { return ""; };
  RULES.acc_terms = function (v, el) { return el && el.checked ? "" : "Please agree to the Terms & Conditions to create your account."; };
  RULES.acc_email = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Please enter your email address."; };
  RULES.acc_password = function (v) {
    if (accountView === "register") return v.length >= 8 ? "" : "Please use at least 8 characters.";
    return v ? "" : "Please enter your password.";
  };

  // scroll only the receipt's own list (scrolling the element into view would also move
  // the page and the fixed overlay, knocking the paper out of place)
  function scrollParent(el) {
    for (var n = el.parentElement; n; n = n.parentElement) {
      if (n.matches(".cm-r_col, .cm-receipt_scroll, .cm-auth_panel") && n.scrollHeight > n.clientHeight + 1) return n;
      if (n.matches(".cm-auth_panel")) return n;
    }
    return root.scrollHeight > root.clientHeight + 1 ? root : null; // phones: the overlay scrolls the whole sheet
  }

  function scrollState(scope) {
    return Array.prototype.map.call(scope.querySelectorAll(".cm-receipt_scroll, .cm-r_col"), function (n) { return n.scrollTop; });
  }
  function restoreScroll(scope, state) {
    Array.prototype.forEach.call(scope.querySelectorAll(".cm-receipt_scroll, .cm-r_col"), function (n, k) { if (state[k]) n.scrollTop = state[k]; });
    updateFades();
  }

  // landscape card: fade a column's text into the paper on whichever side has more to scroll
  function fadeColumn(col) {
    col.classList.toggle("has-more-above", col.scrollTop > 2);
    col.classList.toggle("has-more-below", col.scrollTop + col.clientHeight < col.scrollHeight - 2);
  }
  function updateFades() {
    // once right away and again after the card's entrance animation has settled
    [30, 950].forEach(function (ms) {
      setTimeout(function () { root.querySelectorAll(".cm-receipt.is-active .cm-r_col").forEach(fadeColumn); }, ms);
    });
  }

  function revealInReceipt(el) {
    var scroller = scrollParent(el);
    if (!scroller) return;
    var top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top - scroller.clientHeight / 3), behavior: "smooth" });
  }

  // show/clear one field's warning; returns true when valid
  function checkField(fieldEl) {
    var name = fieldEl.getAttribute("data-field");
    if (!RULES[name]) return true;
    var control = fieldEl.querySelector("input, textarea");
    var message = RULES[name](control.value.trim(), control);
    fieldEl.classList.toggle("is-invalid", Boolean(message));
    control.setAttribute("aria-invalid", message ? "true" : "false");
    fieldEl.querySelector(".cm-r_fielderr").textContent = message;
    return !message;
  }

  function validateSelection(scope) {
    readDetails(scope);
    var missingSize = 0;
    cart.forEach(function (line, i) {
      var item = scope.querySelector('.cm-r_item[data-i="' + i + '"]');
      if (item) item.classList.toggle("needs-size", !line.size);
      if (!line.size) missingSize++;
    });
    var badFields = 0;
    scope.querySelectorAll(".cm-r_field").forEach(function (f) {
      f.setAttribute("data-touched", "");
      if (!checkField(f)) badFields++;
    });
    var parts = [];
    if (missingSize) parts.push(missingSize === 1 ? "choose a size" : "choose sizes for " + missingSize + " pieces");
    if (badFields) parts.push("complete the " + badFields + " highlighted detail" + (badFields === 1 ? "" : "s"));
    showError(scope, parts.length ? "Please " + parts.join(" and ") + " above." : "");
    var firstBad = scope.querySelector(".needs-size, .cm-r_field.is-invalid");
    if (firstBad) {
      revealInReceipt(firstBad);
      var focusable = firstBad.querySelector("input, textarea, .cm-r_size");
      if (focusable) setTimeout(function () { focusable.focus({ preventScroll: true }); }, 450);
    }
    return parts.length === 0;
  }

  // ---------- slip ----------
  function compressImage(file) {
    // shrink large phone photos so uploads stay quick (keeps PDFs/HEIC as they are)
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 1.2 * 1024 * 1024) return Promise.resolve(file);
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 2000 / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (blob) {
          resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file);
        }, "image/jpeg", 0.85);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = function () { resolve(file); };
      img.src = URL.createObjectURL(file);
    });
  }

  function takeSlip(file, scope) {
    if (!file) return;
    compressImage(file).then(function (f) {
      if (f.size > MAX_SLIP) { showError(scope, "That file is over 5 MB — please upload a smaller photo or a PDF."); return; }
      slipFile = f;
      // cross-fade: new layer fades in over the old one in the same spot, then the old is removed
      var zone = scope.querySelector("[data-slip]");
      var input = zone.querySelector("input");
      var old = zone.querySelectorAll(".cm-r_slip_layer");
      var holder = document.createElement("span");
      holder.innerHTML = slipInner();
      var layer = holder.firstChild;
      layer.classList.remove("is-shown");
      zone.insertBefore(layer, input);
      void layer.offsetWidth;
      layer.classList.add("is-shown");
      old.forEach(function (el) {
        el.classList.remove("is-shown");
        setTimeout(function () { el.remove(); }, 650);
      });
      zone.classList.remove("is-invalid");
      showError(scope, "");
    });
  }

  // ---------- submit ----------
  function placeOrder(scope) {
    readDetails(scope);
    if (!slipFile) {
      var zone = scope.querySelector("[data-slip]");
      zone.classList.add("is-invalid");
      revealInReceipt(zone);
      showError(scope, "Please upload your bank transfer slip.");
      return;
    }
    if (location.protocol === "file:") { showError(scope, "Checkout needs the live site (or npm run dev) — it can't send from a file preview."); return; }

    var form = new FormData();
    form.append("items", JSON.stringify(cart.map(function (l) { return { id: l.id, colour: colourOf(l).name, size: l.size, qty: l.qty }; })));
    ["name", "phone", "address", "email", "payerBank", "reference"].forEach(function (k) { form.append(k, details[k] || ""); });
    form.append("slip", slipFile, slipFile.name);

    var btn = scope.querySelector('[data-act="place"]');
    busy = true;
    btn.disabled = true;
    btn.textContent = "Sending…";
    showError(scope, "");

    var headers = account && account.token ? { authorization: "Bearer " + account.token } : {};
    fetch(location.origin + "/api/orders", { method: "POST", body: form, headers: headers })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        busy = false;
        if (!r.ok) throw new Error(r.data.error || "We couldn't place your order. Please try again.");
        cart = [];
        slipFile = null;
        delete details.payerBank;
        delete details.reference;
        details._editedFields = {}; // next order starts from the saved profile again
        write(DETAILS_KEY, details);
        save();
        go(3, { order: r.data });
      })
      .catch(function (err) {
        busy = false;
        btn.disabled = false;
        btn.textContent = "Place order";
        showError(scope, err.message === "Failed to fetch" ? "We couldn't reach the shop — please check your connection and try again." : err.message);
      });
  }

  // ---------- events ----------
  root.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act");
    var scope = el.closest(".cm-receipt, .cm-auth") || root;
    var i = Number(el.getAttribute("data-i"));
    var line = cart[i];

    if (act === "close") return close();
    if (act === "sizeguide") return window.CintamaniSizeChart.open({ size: line && line.size });
    if (act === "acc-signin" || act === "acc-register" || act === "acc-save") return accountSubmit(act, scope, el);
    if (act === "acc-cancel-edit") return cancelProfileEdit(scope);
    if (act === "acc-view-register") return go(4, { view: "register" });
    if (act === "acc-view-signin") return go(4, { view: "signin" });
    if (act === "acc-open") { readDetails(scope); return go(4, { returnTo: 1, reason: null }); }
    if (act === "acc-to-cart") return go(1);
    if (act === "acc-signout") return signOut(false);
    if (act === "edit-field") {
      // only one field open at a time: lock any other open one first (if it's valid)
      var others = Array.prototype.slice.call(scope.querySelectorAll(".cm-r_field.is-editing"));
      if (!others.every(finishEditing)) return;
      setFieldEditing(el.closest(".cm-r_field"), true);
      return;
    }
    if (act === "lock-field") {
      finishEditing(el.closest(".cm-r_field"));
      return;
    }
    if (act === "restore-field") {
      var nm = el.getAttribute("data-name");
      delete editingNow[nm];
      delete editedFields()[nm];
      details[nm] = (account && account.profile && account.profile[nm]) || "";
      write(DETAILS_KEY, details);
      var keep0 = scrollState(scope);
      render(1, {});
      restoreScroll(scope, keep0);
      return;
    }
    if (act === "use-saved") {
      applyProfile(true);
      var keep = scrollState(scope);
      render(1, {});
      restoreScroll(scope, keep);
      return;
    }
    if (act === "back") { readDetails(scope); return go(1); }
    if (act === "to-pay") {
      if (!Array.prototype.slice.call(scope.querySelectorAll(".cm-r_field.is-editing")).every(finishEditing)) return;
      if (!validateSelection(scope)) return;
      if (!account) return go(4, { view: "signin", returnTo: 1, reason: "pay" });
      return go(2);
    }
    if (act === "place") return placeOrder(scope);
    if (act === "clear" || act === "clear-no" || act === "clear-yes") {
      readDetails(scope);
      confirmRemove = -1;
      confirmClear = act === "clear";
      if (act === "clear-yes") { cart = []; highlight = null; save(); }
      var keepClear = scrollState(scope);
      render(1, {});
      restoreScroll(scope, keepClear);
      var focusClear = scope.querySelector(act === "clear" ? '[data-act="clear-yes"]' : '[data-act="clear"]');
      if (focusClear) focusClear.focus({ preventScroll: true });
      return;
    }
    if (!line) return;

    readDetails(scope);
    highlight = null;
    confirmClear = false;
    // the trash icon asks first; "Remove" confirms, "Keep" cancels
    if (act === "remove") confirmRemove = i;
    else if (act === "remove-no") confirmRemove = -1;
    else if (act === "remove-yes") { cart.splice(i, 1); confirmRemove = -1; }
    else confirmRemove = -1;
    if (act === "size") {
      var size = el.getAttribute("data-size");
      var twin = cart.find(function (l) { return l !== line && l.id === line.id && l.size === size && colourOf(l).name === colourOf(line).name; });
      if (twin) { twin.qty = Math.min(SHOP.maxQtyPerLine, twin.qty + line.qty); cart.splice(i, 1); }
      else line.size = size;
    }
    if (act === "inc") line.qty = Math.min(SHOP.maxQtyPerLine, line.qty + 1);
    if (act === "dec") line.qty = Math.max(1, line.qty - 1);
    save();

    // re-render step 1 in place, keeping the scroll position and focus
    var top = scrollState(scope);
    render(1, {});
    restoreScroll(scope, top);
    var focusAct = act === "remove" ? "remove-yes" : act === "remove-no" ? "remove" : act === "remove-yes" ? "remove" : act;
    var again = scope.querySelector('[data-act="' + focusAct + '"][data-i="' + Math.min(i, cart.length - 1) + '"]' + (act === "size" ? '[data-size="' + el.getAttribute("data-size") + '"]' : ""));
    if (again) again.focus({ preventScroll: true });
  });

  // The pages' own scroll scripts (Lenis smooth scroll, the product pages' horizontal
  // scroll) listen for wheel/touch on window and cancel them. Keep these events inside the
  // popup so the receipt can scroll natively.
  ["wheel", "touchstart", "touchmove"].forEach(function (type) {
    root.addEventListener(type, function (e) { e.stopPropagation(); }, { passive: true });
  });

  function cleanPhone(v) {
    var out = "", count = 0;
    for (var k = 0; k < v.length; k++) {
      var c = v[k];
      if (/[0-9]/.test(c)) { if (count >= 12) continue; count++; out += c; }
      else if (c === "+" && out === "") out += c;
      else if (/[ ()-]/.test(c) && out !== "") out += c;
    }
    return out.slice(0, 16);
  }

  root.addEventListener("input", function (e) {
    if (e.target.name === "phone" || e.target.name === "acc_phone") {
      var cleaned = cleanPhone(e.target.value);
      if (cleaned !== e.target.value) e.target.value = cleaned;
    }
    if (e.target.matches(".cm-r_field input, .cm-r_field textarea") && e.target.type !== "checkbox") {
      if (e.target.name.indexOf("acc_") !== 0) {
        details[e.target.name] = e.target.value.trim();
        if (account && PROFILE_FIELDS.indexOf(e.target.name) >= 0) editedFields()[e.target.name] = true;
        write(DETAILS_KEY, details);
      }
      var f = e.target.closest(".cm-r_field");
      f.classList.toggle("is-filled", Boolean(e.target.value.trim()));
      if (f.classList.contains("is-invalid")) checkField(f);
    }
  });

  root.addEventListener("focusout", function (e) {
    if (!e.target.matches(".cm-r_field input, .cm-r_field textarea") || e.target.type === "checkbox") return;
    var f = e.target.closest(".cm-r_field");
    if (e.target.value.trim() || f.hasAttribute("data-touched")) checkField(f);
  });

  root.addEventListener("change", function (e) {
    if (e.target.matches('input[type="file"]')) takeSlip(e.target.files[0], e.target.closest(".cm-receipt"));
    if (e.target.name === "acc_terms" && e.target.checked) checkField(e.target.closest(".cm-r_field"));
  });

  ["dragenter", "dragover"].forEach(function (type) {
    root.addEventListener(type, function (e) {
      var zone = e.target.closest && e.target.closest("[data-slip]");
      if (zone) { e.preventDefault(); zone.classList.add("is-dragging"); }
    });
  });
  ["dragleave", "drop"].forEach(function (type) {
    root.addEventListener(type, function (e) {
      var zone = e.target.closest && e.target.closest("[data-slip]");
      if (!zone) return;
      zone.classList.remove("is-dragging");
      if (type === "drop") { e.preventDefault(); takeSlip(e.dataTransfer.files[0], zone.closest(".cm-receipt")); }
    });
  });

  root.addEventListener("keydown", function (e) {
    var editingField = e.target.closest && e.target.closest(".cm-r_field.is-editing");
    if (editingField && e.key === "Enter" && !(e.target.tagName === "TEXTAREA" && e.shiftKey)) {
      e.preventDefault();
      finishEditing(editingField);
      return;
    }
    if (editingField && e.key === "Escape") e.stopPropagation();
  });

  root.addEventListener("focusout", function (e) {
    var editingField = e.target.closest && e.target.closest(".cm-r_field.is-editing");
    if (!editingField) return;
    setTimeout(function () {
      if (!editingField.isConnected || editingField.contains(document.activeElement)) return;
      if (editingField.querySelector(".cm-r_fielderr").textContent) return; // keep it open while invalid
      finishEditing(editingField);
    }, 120);
  });

  root.addEventListener("input", function (e) {
    if (e.target.name && PROFILE_INPUTS[e.target.name]) syncProfileButton(e.target.closest(".cm-auth"));
  });

  root.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT" || e.target.name.indexOf("acc_") !== 0) return;
    var btn = e.target.closest(".cm-receipt, .cm-auth").querySelector('[data-act="acc-signin"], [data-act="acc-register"], [data-act="acc-save"]');
    if (btn) { e.preventDefault(); btn.click(); }
  });

  document.addEventListener("keydown", function (e) {
    if (!root.classList.contains("is-open")) return;
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    // keep keyboard focus inside the popup
    var active = root.querySelector(".cm-auth.is-active, .cm-receipt.is-active");
    var items = [root.querySelector(".cm-cart_close")].concat(
      Array.prototype.slice.call(active.querySelectorAll("button:not([disabled]), input, textarea, a[href]"))
    );
    var first = items[0];
    var last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // keep the badge in sync across tabs
  window.addEventListener("storage", function (e) {
    if (e.key === CART_KEY) { cart = read(CART_KEY, []).filter(function (l) { return PRODUCTS[l.id]; }); updateTrigger(); }
  });

  // product pages live at /collection/<slug> (older links: art/u-N.html)
  function pageProductId() {
    var last = location.pathname.replace(/\.html$/, "").replace(/\/+$/, "").split("/").pop();
    for (var id in PRODUCTS) if (PRODUCTS[id].slug === last) return id;
    return PRODUCTS[last] ? last : null;
  }

  // "Add to cart" on product pages (works however the page was reached)
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest(".art_cart");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var id = pageProductId();
    var rail = document.querySelector(".cm-colours");
    if (id) add(id, rail && rail.getAttribute("data-selected"));
  }, true);

  // following a link from inside the popup (e.g. "View collection") closes it
  root.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest("a[href]");
    if (link) close(true);
  });

  // links to the home page skip Barba's transition and load the page fully
  function markHomeLinks() {
    document.querySelectorAll("a[href]").forEach(function (a) {
      if (a.hasAttribute("data-barba-prevent")) return;
      var url;
      try { url = new URL(a.getAttribute("href"), location.href); } catch (e) { return; }
      if (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname)) a.setAttribute("data-barba-prevent", "self");
    });
  }

  // the page we're on (path only, no #section) — Barba swaps update it below
  var pagePath = location.pathname + location.search;

  function init() {
    document.body.appendChild(root);
    root.addEventListener("scroll", function (e) {
      if (e.target.classList && e.target.classList.contains("cm-r_col")) fadeColumn(e.target);
    }, true);
    window.addEventListener("resize", updateFades);
    window.addEventListener("resize", alignFloating);
    setTimeout(alignFloating, 600); // after the page's own nav has settled
    // the home page's loading screen is for the first visit only (see the inline check in index.html)
    try { sessionStorage.setItem("cintamani_intro_seen", "1"); } catch (e) { /* storage blocked */ }
    placeTrigger();

    // Barba swaps page content without a reload: keep the buttons in the nav and close the
    // popup whenever the page changes underneath it.
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () {
        pending = false;
        if (!document.body.contains(root)) document.body.appendChild(root);
        if (triggerMisplaced()) placeTrigger();
        markHomeLinks();
        pagePath = location.pathname + location.search;
      }, 30);
    }).observe(document.body, { childList: true, subtree: true });

    // Back/forward through Barba's in-page history leaves the home page half-initialised
    // (its hero, marquee and scroll animations only start on a real load), so reload instead.
    // Registered before Barba's own listener, so it wins.
    // Jumping to a section on the same page (#faq, #message…) also fires popstate: leave those alone.
    window.addEventListener("popstate", function () {
      if (location.pathname + location.search === pagePath) return;
      close(true);
      location.reload();
    });
    markHomeLinks();
    window.addEventListener("load", function () {
      if (window.barba && window.barba.hooks) {
        window.barba.hooks.before(function () { close(true); });
        window.barba.hooks.after(function () { placeTrigger(); });
      }
    });

    // refresh the saved profile for a returning signed-in customer
    if (account && account.token) {
      apiFetch("/account/me").then(function (data) { setAccount(data); }).catch(function () {});
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.CintamaniCart = { add: add, open: function () { open(1); }, account: function () { open(4); }, count: pieces };
})();
