// Copy a file-storage folder (the .data/ layout: orders/, customers/, activity/, deleted-orders/,
// slips/) into PostgreSQL + the slip folder. Safe to run again: records are updated, not duplicated.
//
//   DATABASE_URL=postgres://… SLIP_DIR=/var/lib/cintamani/slips node scripts/import-data.mjs .data
import { promises as fs } from "node:fs";
import path from "node:path";
import { closeStore, openStore } from "../netlify/lib/store.mjs";

const from = process.argv[2];
if (!from) { console.error("Usage: node scripts/import-data.mjs <folder>"); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set."); process.exit(1); }
if (!process.env.SLIP_DIR) { console.error("SLIP_DIR is not set (the private folder for payment slips)."); process.exit(1); }

async function files(dir) {
  try { return (await fs.readdir(dir)).filter((f) => !f.endsWith(".meta")); } catch { return []; }
}

let total = 0;
for (const name of ["orders", "customers", "activity", "deleted-orders"]) {
  const dir = path.join(from, name);
  const target = await openStore(name);
  let n = 0;
  for (const f of await files(dir)) {
    const record = JSON.parse(await fs.readFile(path.join(dir, f), "utf8"));
    await target.setJSON(decodeURIComponent(f), record);
    n++;
  }
  console.log(`${name.padEnd(15)} ${n}`);
  total += n;
}

const slipDir = path.join(from, "slips");
const slips = await openStore("slips");
let s = 0;
for (const f of await files(slipDir)) {
  const meta = JSON.parse(await fs.readFile(path.join(slipDir, f + ".meta"), "utf8").catch(() => "{}"));
  await slips.setFile(decodeURIComponent(f), await fs.readFile(path.join(slipDir, f)), meta.contentType || "application/octet-stream");
  s++;
}
console.log(`${"slips".padEnd(15)} ${s}`);
await closeStore();
console.log(`Done: ${total} records, ${s} slips.`);
