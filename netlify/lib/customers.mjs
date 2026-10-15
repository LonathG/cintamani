// Customer accounts: password hashing, signed session tokens, profile records.
// Needs CUSTOMER_TOKEN_SECRET in the environment (separate from the admin secret).
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { openStore } from "./store.mjs";

const scryptAsync = promisify(scrypt);
const SESSION_DAYS = 30;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const accountsConfigured = () => Boolean(process.env.CUSTOMER_TOKEN_SECRET);

export const normaliseEmail = (email) => String(email || "").trim().toLowerCase();
const keyFor = (email) => "c_" + createHash("sha256").update(normaliseEmail(email)).digest("hex").slice(0, 40);
const sign = (payload) => createHmac("sha256", process.env.CUSTOMER_TOKEN_SECRET).update(payload).digest("hex");

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

async function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = (await scryptAsync(String(password), salt, 64)).toString("hex");
  return { salt, hash };
}

export function issueToken(email) {
  const exp = String(Date.now() + SESSION_DAYS * 86400 * 1000);
  const who = Buffer.from(normaliseEmail(email)).toString("base64url");
  return `${who}.${exp}.${sign(`${who}.${exp}`)}`;
}

// Returns the signed-in customer's email, or null.
export function sessionEmail(req) {
  if (!accountsConfigured()) return null;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [who, exp, sig] = token.split(".");
  if (!who || !exp || !sig || Number(exp) < Date.now()) return null;
  if (!safeEqual(sig, sign(`${who}.${exp}`))) return null;
  return Buffer.from(who, "base64url").toString();
}

export const publicProfile = (c) => ({
  email: c.email,
  name: c.name || "",
  phone: c.phone || "",
  address: c.address || "",
});

export async function getCustomer(email) {
  return (await openStore("customers")).getJSON(keyFor(email));
}

export async function saveCustomer(customer) {
  customer.updatedAt = new Date().toISOString();
  await (await openStore("customers")).setJSON(keyFor(customer.email), customer);
  return customer;
}

export async function registerCustomer({ email, password, name }) {
  const existing = await getCustomer(email);
  if (existing) return { error: "An account with this email already exists. Please sign in instead." };
  const { salt, hash } = await hashPassword(password);
  const customer = {
    email: normaliseEmail(email),
    name,
    phone: "",
    address: "",
    password: { salt, hash },
    orderIds: [],
    failedLogins: 0,
    lockedUntil: 0,
    createdAt: new Date().toISOString(),
    termsAcceptedAt: new Date().toISOString(), // registration requires agreeing to the T&C
  };
  await saveCustomer(customer);
  return { customer };
}

export async function checkLogin(email, password) {
  const customer = await getCustomer(email);
  const generic = { error: "Incorrect email or password." };
  if (!customer) {
    await hashPassword(password); // similar timing whether or not the account exists
    return generic;
  }
  if (customer.lockedUntil > Date.now()) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }
  const { hash } = await hashPassword(password, customer.password.salt);
  if (!safeEqual(hash, customer.password.hash)) {
    customer.failedLogins = (customer.failedLogins || 0) + 1;
    if (customer.failedLogins >= MAX_FAILED) {
      customer.failedLogins = 0;
      customer.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
    }
    await saveCustomer(customer);
    return generic;
  }
  if (customer.failedLogins || customer.lockedUntil) {
    customer.failedLogins = 0;
    customer.lockedUntil = 0;
    await saveCustomer(customer);
  }
  return { customer };
}
