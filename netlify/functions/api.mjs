// Cintamani order API (Netlify Function, served at /api/*)
//
//   POST  /api/orders                    customer checkout: cart + delivery details + bank slip
//   POST  /api/admin/login               { email, password } -> { token }
//   GET   /api/admin/orders              all orders, newest first          (admin)
//   PATCH /api/admin/orders/:id          { status?, deliveryBarcode? }     (admin)
//   GET   /api/admin/orders/:id/slip     the uploaded bank slip file       (admin)
//   DELETE /api/admin/orders/:id         remove a Completed / Cancelled order (kept in the export) (admin)
//   GET   /api/admin/export.xlsx         Excel workbook: orders, pieces, customers, activity log (admin)
//
//   POST  /api/account/register          { name, email, password, acceptTerms } -> { token, profile }
//   POST  /api/account/login             { email, password } -> { token, profile }
//   GET   /api/account/me                saved profile                      (customer)
//   PUT   /api/account/me                { name, phone, address }           (customer)
//   GET   /api/account/orders            the customer's orders + status     (customer)
//   DELETE /api/account/orders/:id       hide a Completed / Cancelled order from the list (customer)
import shop from "../../frontend_assets/js/shop-data.js";
import { openStore } from "../lib/store.mjs";
import { authConfigured, login, verify } from "../lib/auth.mjs";
import {
  accountsConfigured, checkLogin, getCustomer, issueToken, normaliseEmail,
  publicProfile, registerCustomer, saveCustomer, sessionEmail,
} from "../lib/customers.mjs";
import { buildXlsx } from "../lib/xlsx.mjs";

export const config = { path: "/api/*" };

const STATUSES = ["Payment Pending", "Accepted", "In Production", "Packed & Ready", "Dispatched", "Completed", "Cancelled"];
// orders that are finished with, and so may be removed from the admin / a customer's list
const CLOSED = ["Completed", "Cancelled"];
const MAX_SLIP_BYTES = 5 * 1024 * 1024;
const PRODUCTS = new Map(shop.products.map((p) => [p.id, p]));

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const fail = (message, status = 400) => json({ error: message }, status);

const formatLKR = (n) =>
  `LKR ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const clean = (v, max = 300) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

function orderDateLabel(d) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("day")}-${get("month").toUpperCase()}, ${get("hour")}:${get("minute")}`;
}

// Identify the slip by its first bytes rather than trusting the browser's file type.
function sniffSlip(bytes) {
  const b = bytes.subarray(0, 12);
  const ascii = (s, e) => String.fromCharCode(...b.subarray(s, e));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return { type: "image/png", ext: "png" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { type: "image/webp", ext: "webp" };
  if (ascii(0, 4) === "%PDF") return { type: "application/pdf", ext: "pdf" };
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|mif1|heif)$/.test(ascii(8, 12))) return { type: "image/heic", ext: "heic" };
  return null;
}

async function newOrderId(orders) {
  for (let i = 0; i < 20; i++) {
    const id = `CM-${Math.floor(10000 + Math.random() * 90000)}`;
    if (!(await orders.getJSON(id))) return id;
  }
  throw new Error("Could not allocate an order id");
}

// Append-only activity log (one record per event) — every order event ends up in the Excel export.
async function logEvent(orderId, event, detail = "", by = "") {
  const at = new Date().toISOString();
  const key = `${at}_${Math.random().toString(36).slice(2, 8)}`;
  await (await openStore("activity")).setJSON(key, { at, orderId, event, detail, by });
}

async function createOrder(req) {
  // orders come from signed-in customers (the shop asks visitors to sign in before adding to cart)
  if (accountsConfigured() && !sessionEmail(req)) return fail("Please sign in to place your order.", 401);

  let form;
  try { form = await req.formData(); } catch { return fail("Expected a form upload."); }

  // --- cart: priced from shop-data on the server, never from the browser ---
  let rawItems;
  try { rawItems = JSON.parse(form.get("items") || "[]"); } catch { return fail("Cart could not be read."); }
  if (!Array.isArray(rawItems) || rawItems.length === 0) return fail("Your cart is empty.");
  if (rawItems.length > 30) return fail("Too many items in one order.");

  const items = [];
  for (const raw of rawItems) {
    const product = PRODUCTS.get(String(raw.id));
    const qty = Number.parseInt(raw.qty, 10);
    const size = String(raw.size || "");
    if (!product) return fail("One of the pieces is no longer available.");
    if (!shop.sizes.includes(size)) return fail(`Please choose a size for ${product.name}.`);
    if (!(qty >= 1 && qty <= shop.maxQtyPerLine)) return fail(`Please check the quantity for ${product.name}.`);
    // colour chosen on the product page; must be one of the shop's colours (else the photographed one)
    const colourNames = (shop.colours || []).map((c) => c.name);
    const colour = colourNames.includes(String(raw.colour)) ? String(raw.colour) : product.colour;
    items.push({
      id: product.id, name: product.name, colour, size, qty,
      unitPrice: product.price, lineTotal: product.price * qty,
    });
  }

  // --- customer ---
  const customerName = clean(form.get("name"), 120);
  const contactNumber = clean(form.get("phone"), 40);
  const shippingAddress = clean(form.get("address"), 400);
  const email = clean(form.get("email"), 160);
  if (customerName.length < 2) return fail("Please enter your name.");
  const phoneDigits = contactNumber.replace(/\D/g, "").length;
  if (!/^\+?[0-9 ()-]+$/.test(contactNumber) || phoneDigits < 9 || phoneDigits > 12) return fail("Please enter a valid contact number.");
  if (shippingAddress.length < 5) return fail("Please enter your delivery address.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Please check your email address.");

  // --- bank slip ---
  const slip = form.get("slip");
  if (!slip || typeof slip === "string" || slip.size === 0) return fail("Please attach your bank transfer slip.");
  if (slip.size > MAX_SLIP_BYTES) return fail("The slip is larger than 5 MB — please upload a smaller photo or PDF.");
  const slipBytes = new Uint8Array(await slip.arrayBuffer());
  const kind = sniffSlip(slipBytes);
  if (!kind) return fail("The slip must be a photo (JPG, PNG, WEBP, HEIC) or a PDF.");

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  // delivery by parcel weight (SL Post courier rates in shop-data.js), worked out here, not trusted from the browser
  const parcel = shop.parcelFor(items);
  const total = subtotal + parcel.fee;

  const orders = await openStore("orders");
  const slips = await openStore("slips");
  const orderId = await newOrderId(orders);
  const now = new Date();
  const slipKey = `${orderId}.${kind.ext}`;
  await slips.setFile(slipKey, slipBytes, kind.type);

  const order = {
    orderId,
    createdAt: now.toISOString(),
    orderDate: orderDateLabel(now),
    status: "Payment Pending",
    deliveryBarcode: null,

    customerName,
    contactNumber,
    email,
    shippingAddress,
    notes: clean(form.get("notes"), 500),

    items,
    subtotal,
    deliveryFee: parcel.fee,
    parcelGrams: parcel.grams,
    total,
    amount: formatLKR(total),

    slip: { key: slipKey, contentType: kind.type, bytes: slip.size },
    receiptDetails: {
      bank: clean(form.get("payerBank"), 120) || "—",
      account: shop.bank.accountName,
      reference: clean(form.get("reference"), 120) || "—",
      date: now.toISOString().slice(0, 10),
      tellerStamp: "—",
    },
  };
  const account = sessionEmail(req);
  if (account) order.customerAccount = account;
  await orders.setJSON(orderId, order);
  if (account) {
    const customer = await getCustomer(account);
    if (customer) {
      customer.orderIds = [...new Set([orderId, ...(customer.orderIds || [])])];
      await saveCustomer(customer);
    }
  }
  await logEvent(orderId, "Order placed", `${order.amount} · ${items.map((i) => `${i.name} (${i.colour}, ${i.size}) ×${i.qty}`).join(", ")}`, account || email || customerName);
  return json({ orderId, amount: order.amount, status: order.status }, 201);
}

// ---------- customer accounts ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readJson(req) {
  try { return await req.json(); } catch { return null; }
}

async function accountRoute(route, method, req) {
  if (!accountsConfigured()) return fail("Accounts are not available right now.", 503);

  if (route === "/account/register" && method === "POST") {
    const body = (await readJson(req)) || {};
    const name = clean(body.name, 80);
    const email = normaliseEmail(body.email).slice(0, 160);
    const password = String(body.password || "");
    if (name.length < 2) return fail("Please enter your name.");
    if (!EMAIL_RE.test(email)) return fail("Please enter a valid email address.");
    if (password.length < 8 || password.length > 128) return fail("Please choose a password of at least 8 characters.");
    if (body.acceptTerms !== true) return fail("Please agree to the Terms & Conditions to create your account.");
    const result = await registerCustomer({ email, password, name });
    if (result.error) return fail(result.error, 409);
    return json({ token: issueToken(email), profile: publicProfile(result.customer) }, 201);
  }

  if (route === "/account/login" && method === "POST") {
    const body = (await readJson(req)) || {};
    const email = normaliseEmail(body.email);
    if (!EMAIL_RE.test(email) || !body.password) return fail("Incorrect email or password.", 401);
    const result = await checkLogin(email, String(body.password));
    if (result.error) return fail(result.error, 401);
    return json({ token: issueToken(email), profile: publicProfile(result.customer) });
  }

  const email = sessionEmail(req);
  if (!email) return fail("Please sign in again.", 401);
  const customer = await getCustomer(email);
  if (!customer) return fail("Please sign in again.", 401);

  if (route === "/account/me" && method === "GET") return json({ profile: publicProfile(customer) });

  if (route === "/account/me" && method === "PUT") {
    const body = (await readJson(req)) || {};
    const name = clean(body.name, 80);
    const phone = clean(body.phone, 40);
    const address = clean(body.address, 300);
    const digits = phone.replace(/\D/g, "").length;
    if (name.length < 2) return fail("Please enter your name.");
    if (phone && (!/^\+?[0-9 ()-]+$/.test(phone) || digits < 9 || digits > 12)) return fail("Please enter a valid contact number.");
    Object.assign(customer, { name, phone, address });
    await saveCustomer(customer);
    return json({ profile: publicProfile(customer) });
  }

  if (route === "/account/orders" && method === "GET") {
    const orders = await openStore("orders");
    const hidden = new Set(customer.hiddenOrderIds || []);
    const list = (await Promise.all((customer.orderIds || []).filter((id) => !hidden.has(id)).slice(0, 50).map((id) => orders.getJSON(id))))
      .filter((o) => o && o.customerAccount === email)
      .map((o) => ({
        orderId: o.orderId,
        orderDate: o.orderDate,
        createdAt: o.createdAt,
        amount: o.amount,
        status: o.status,
        deliveryBarcode: o.deliveryBarcode,
        items: o.items.map((i) => ({ name: i.name, size: i.size, qty: i.qty })),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json({ orders: list });
  }

  const hide = route.match(/^\/account\/orders\/(CM-\d+)$/);
  if (hide && method === "DELETE") {
    const id = hide[1];
    if (!(customer.orderIds || []).includes(id)) return fail("Order not found.", 404);
    const order = await (await openStore("orders")).getJSON(id);
    if (order && !CLOSED.includes(order.status)) return fail("Only completed or cancelled orders can be removed.", 409);
    customer.hiddenOrderIds = [...new Set([id, ...(customer.hiddenOrderIds || [])])];
    await saveCustomer(customer);
    await logEvent(id, "Removed from customer's list", "", email);
    return json({ ok: true });
  }

  return fail("Not found.", 404);
}

// Shape stored orders into the fields the admin console renders.
function forAdmin(o) {
  return {
    ...o,
    garmentType: o.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", "),
    size: o.items.map((i) => i.size).join(", "),
    color: [...new Set(o.items.map((i) => i.colour))].join(", "),
    gender: o.gender || "—",
    monogram: "—",
    fabricSpec: "Pure Sri Lankan linen",
    loomGuild: "—",
    artisan: "—",
    patronTier: "—",
    packagingDirectives: { wrap: "—", gift: "—", fragrance: "—" },
    hasSlip: Boolean(o.slip),
  };
}

async function listOrders() {
  const all = await (await openStore("orders")).all();
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return json({ orders: all.map(forAdmin), statuses: STATUSES });
}

async function updateOrder(id, req) {
  const orders = await openStore("orders");
  const order = await orders.getJSON(id);
  if (!order) return fail("Order not found.", 404);
  let body;
  try { body = await req.json(); } catch { return fail("Expected JSON."); }
  const events = [];
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return fail("Unknown status.");
    if (body.status !== order.status) events.push(["Stage changed", `${order.status} → ${body.status}`]);
    order.status = body.status;
  }
  if (body.deliveryBarcode !== undefined) {
    const code = clean(body.deliveryBarcode, 80) || null;
    if (code !== order.deliveryBarcode) events.push(["Tracking number", code || "removed"]);
    order.deliveryBarcode = code;
  }
  order.updatedAt = new Date().toISOString();
  await orders.setJSON(id, order);
  for (const [event, detail] of events) await logEvent(id, event, detail, "admin");
  return json({ order: forAdmin(order) });
}

// Deleting moves the order out of the live list into "deleted-orders" (the slip is kept too),
// so the Excel export still has the full history.
async function deleteOrder(id) {
  const orders = await openStore("orders");
  const order = await orders.getJSON(id);
  if (!order) return fail("Order not found.", 404);
  if (!CLOSED.includes(order.status)) return fail("Only completed or cancelled orders can be deleted.", 409);
  order.deletedAt = new Date().toISOString();
  await (await openStore("deleted-orders")).setJSON(id, order);
  await orders.delete(id);
  await logEvent(id, "Deleted from admin", order.status, "admin");
  return json({ ok: true });
}

async function readAll(name) {
  return (await openStore(name)).all();
}

const colombo = (iso) => iso
  ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "")
  : "";

async function exportXlsx() {
  const live = (await readAll("orders")).map((o) => ({ ...o, record: "Active" }));
  const gone = (await readAll("deleted-orders")).map((o) => ({ ...o, record: "Deleted" }));
  const all = [...live, ...gone].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const customers = (await readAll("customers")).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const activity = (await readAll("activity")).sort((a, b) => a.at.localeCompare(b.at));
  const col = (header, width) => ({ header, width });

  const workbook = buildXlsx([
    {
      name: "Orders",
      columns: [col("Order", 11), col("Placed (Colombo)", 17), col("Stage", 15), col("Record", 9), col("Customer", 22), col("Phone", 15),
        col("Email", 26), col("Delivery address", 40), col("Pieces", 46), col("Qty", 6), col("Subtotal (LKR)", 14), col("Parcel (kg)", 11), col("Delivery (LKR)", 13),
        col("Total (LKR)", 12), col("Tracking no.", 16), col("Paid from", 18), col("Reference", 16), col("Note", 30),
        col("Last updated", 17), col("Deleted on", 17), col("Account", 26)],
      rows: all.map((o) => [o.orderId, colombo(o.createdAt), o.status, o.record, o.customerName, o.contactNumber, o.email,
        o.shippingAddress, o.items.map((i) => `${i.name} (${i.colour}, ${i.size}) ×${i.qty}`).join("; "),
        o.items.reduce((n, i) => n + i.qty, 0), o.subtotal, o.parcelGrams ? Math.round(o.parcelGrams / 100) / 10 : "", o.deliveryFee, o.total, o.deliveryBarcode || "",
        o.receiptDetails?.bank || "", o.receiptDetails?.reference || "", o.notes || "",
        colombo(o.updatedAt), colombo(o.deletedAt), o.customerAccount || ""]),
    },
    {
      name: "Pieces",
      columns: [col("Order", 11), col("Placed (Colombo)", 17), col("Stage", 15), col("Piece", 18), col("Colour", 20), col("Size", 6),
        col("Qty", 6), col("Unit price (LKR)", 15), col("Line total (LKR)", 15), col("Customer", 22)],
      rows: all.flatMap((o) => o.items.map((i) => [o.orderId, colombo(o.createdAt), o.status, i.name, i.colour, i.size, i.qty,
        i.unitPrice, i.lineTotal, o.customerName])),
    },
    {
      name: "Customers",
      columns: [col("Name", 22), col("Email", 28), col("Phone", 15), col("Address", 40), col("Orders", 8), col("Joined (Colombo)", 17)],
      rows: customers.map((c) => [c.name, c.email, c.phone, c.address, (c.orderIds || []).length, colombo(c.createdAt)]),
    },
    {
      name: "Activity log",
      columns: [col("When (Colombo)", 17), col("Order", 11), col("Event", 26), col("Details", 60), col("By", 26)],
      rows: activity.map((a) => [colombo(a.at), a.orderId, a.event, a.detail, a.by]),
    },
  ]);
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
  return new Response(workbook, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="cintamani-orders-${day}.xlsx"`,
      "cache-control": "private, no-store",
    },
  });
}

async function getSlip(id) {
  const orders = await openStore("orders");
  const order = await orders.getJSON(id);
  if (!order?.slip) return fail("No slip for this order.", 404);
  const file = await (await openStore("slips")).getFile(order.slip.key);
  if (!file) return fail("Slip file missing.", 404);
  return new Response(file.data, {
    headers: { "content-type": file.contentType, "cache-control": "private, no-store" },
  });
}

export default async (req) => {
  const { pathname } = new URL(req.url);
  const route = pathname.replace(/^\/api/, "").replace(/\/+$/, "");
  const method = req.method;

  try {
    if (route === "/orders" && method === "POST") return await createOrder(req);
    if (route.startsWith("/account/")) return await accountRoute(route, method, req);

    if (route === "/admin/login" && method === "POST") {
      if (!authConfigured()) return fail("Admin sign-in is not configured on the server.", 503);
      let body = {};
      try { body = await req.json(); } catch {}
      const token = login(body.email, body.password);
      return token ? json({ token }) : fail("Invalid credentials. Please verify your email and password.", 401);
    }

    if (route.startsWith("/admin/")) {
      if (!verify(req)) return fail("Please sign in again.", 401);
      if (route === "/admin/orders" && method === "GET") return await listOrders();
      if (route === "/admin/export.xlsx" && method === "GET") return await exportXlsx();
      const m = route.match(/^\/admin\/orders\/(CM-\d+)(\/slip)?$/);
      if (m && m[2] && method === "GET") return await getSlip(m[1]);
      if (m && !m[2] && method === "PATCH") return await updateOrder(m[1], req);
      if (m && !m[2] && method === "DELETE") return await deleteOrder(m[1]);
    }

    return fail("Not found.", 404);
  } catch (err) {
    console.error(err);
    return fail("Something went wrong on our side. Please try again.", 500);
  }
};
