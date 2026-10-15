// Admin sign-in. Credentials live in environment variables (never in the browser):
//   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_TOKEN_SECRET
// A signed token ("<expiry>.<hmac>") is returned on login and sent back as a Bearer token.
import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_HOURS = 12;

function sign(payload) {
  return createHmac("sha256", process.env.ADMIN_TOKEN_SECRET).update(payload).digest("hex");
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export function authConfigured() {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && process.env.ADMIN_TOKEN_SECRET);
}

export function login(email, password) {
  if (!authConfigured()) return null;
  const okEmail = safeEqual(String(email || "").trim().toLowerCase(), process.env.ADMIN_EMAIL.trim().toLowerCase());
  const okPass = safeEqual(String(password || ""), process.env.ADMIN_PASSWORD);
  if (!okEmail || !okPass) return null;
  const exp = String(Date.now() + TOKEN_HOURS * 3600 * 1000);
  return `${exp}.${sign(exp)}`;
}

export function verify(req) {
  if (!authConfigured()) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}
