// Local preview: serves frontend_assets/ and runs the order API at /api/* without the
// Netlify CLI. Orders and slips are saved under .data/ instead of Netlify Blobs.
//   npm run dev   ->  http://localhost:8888
import http from "node:http";
import { promises as fs, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "frontend_assets");
const PORT = Number(process.env.PORT || 8888);

// minimal .env loader
const envFile = path.join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
process.env.CINTAMANI_LOCAL_STORE ||= path.join(root, ".data");

const { default: api } = await import("../netlify/functions/api.mjs");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".svg": "image/svg+xml", ".gif": "image/gif",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".woff": "font/woff", ".mp4": "video/mp4",
};

// clean addresses, same as the live nginx setup: /about.html -> /about, /index.html -> /,
// old product links /art/u-N(.html) -> /collection/<slug>
const { default: shop } = await import("../frontend_assets/js/shop-data.js");
const SLUGS = Object.fromEntries(shop.products.map((p) => [p.id, p.slug]));
function cleanAddress(pathname) {
  const old = pathname.match(/^\/art\/(u-\d+)(\.html)?$/);
  if (old && SLUGS[old[1]]) return `/collection/${SLUGS[old[1]]}`;
  if (pathname === "/index.html" || pathname === "/index") return "/";
  if (pathname === "/admin.html" || pathname === "/admin/") return "/admin";
  if (pathname.endsWith(".html")) return pathname.slice(0, -5);
  return null;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, "http://x");
  const clean = cleanAddress(url.pathname);
  if (clean) { res.writeHead(301, { location: clean + url.search }).end(); return; }
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/admin") rel = "/admin.html";
  let file = path.join(site, rel);
  if (!file.startsWith(site)) { res.writeHead(403).end(); return; }
  try {
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, "index.html");
  } catch {
    if (existsSync(file + ".html")) file += ".html";
  }
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}

http.createServer(async (req, res) => {
  if (!req.url.startsWith("/api/")) return serveStatic(req, res);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(`http://localhost:${PORT}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const response = await api(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
// HOST=127.0.0.1 on the server, so only nginx (not the internet) can reach this port
}).listen(PORT, process.env.HOST || undefined, () => console.log(`Cintamani dev server: http://localhost:${PORT}`));
