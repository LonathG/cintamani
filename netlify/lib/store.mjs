// Storage for orders, customers, the activity log (JSON records) and payment slips (files).
//
// Which backend is used:
//   DATABASE_URL set          -> PostgreSQL (one table per collection; records kept as JSONB).
//                                Slips are files on disk under SLIP_DIR (never in the database).
//   CINTAMANI_LOCAL_STORE set -> plain files under that folder (local development, see dev-server.mjs)
//   neither                   -> Netlify Blobs
import { promises as fs } from "node:fs";
import path from "node:path";

function fileStore(root, name) {
  const dir = path.join(root, name);
  const safe = (key) => path.join(dir, encodeURIComponent(key));
  const store = {
    async getJSON(key) {
      try { return JSON.parse(await fs.readFile(safe(key), "utf8")); } catch { return null; }
    },
    async setJSON(key, value) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(safe(key), JSON.stringify(value, null, 2));
    },
    async getFile(key) {
      try {
        const meta = JSON.parse(await fs.readFile(safe(key) + ".meta", "utf8"));
        return { data: await fs.readFile(safe(key)), contentType: meta.contentType };
      } catch { return null; }
    },
    async setFile(key, data, contentType) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(safe(key), Buffer.from(data));
      await fs.writeFile(safe(key) + ".meta", JSON.stringify({ contentType }));
    },
    async delete(key) {
      await fs.rm(safe(key), { force: true });
      await fs.rm(safe(key) + ".meta", { force: true });
    },
    async keys() {
      try {
        return (await fs.readdir(dir)).filter((f) => !f.endsWith(".meta")).map(decodeURIComponent);
      } catch { return []; }
    },
    async all() {
      return (await Promise.all((await store.keys()).map((k) => store.getJSON(k)))).filter(Boolean);
    },
  };
  return store;
}

async function blobStore(name) {
  const { getStore } = await import("@netlify/blobs");
  const blobs = getStore({ name, consistency: "strong" });
  const store = {
    getJSON: (key) => blobs.get(key, { type: "json" }),
    setJSON: (key, value) => blobs.setJSON(key, value),
    async getFile(key) {
      const res = await blobs.getWithMetadata(key, { type: "arrayBuffer" });
      return res ? { data: Buffer.from(res.data), contentType: res.metadata.contentType } : null;
    },
    setFile: (key, data, contentType) => blobs.set(key, data, { metadata: { contentType } }),
    delete: (key) => blobs.delete(key),
    async keys() {
      const { blobs: list } = await blobs.list();
      return list.map((b) => b.key);
    },
    async all() {
      return (await Promise.all((await store.keys()).map((k) => store.getJSON(k)))).filter(Boolean);
    },
  };
  return store;
}

// ---------- PostgreSQL ----------
// One table per collection: key (order id, customer key, …) + the record as JSONB + timestamps.
const TABLES = { orders: "orders", customers: "customers", activity: "activity", "deleted-orders": "deleted_orders" };
let pool = null;
let ready = null;

async function db() {
  if (!pool) {
    const { default: pg } = await import("pg");
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
    ready = (async () => {
      // names like "Tuskers’ White" and arrows in the activity log need a UTF-8 database
      const { rows: [enc] } = await pool.query("SHOW server_encoding");
      if (enc.server_encoding !== "UTF8") {
        throw new Error(`The database must be UTF8 (it is ${enc.server_encoding}). Create it with ENCODING 'UTF8' TEMPLATE template0.`);
      }
      for (const table of Object.values(TABLES)) {
        await pool.query(`CREATE TABLE IF NOT EXISTS ${table} (
          key        text PRIMARY KEY,
          data       jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )`);
      }
      // what the admin filters and sorts orders by
      await pool.query("CREATE INDEX IF NOT EXISTS orders_status_idx ON orders ((data->>'status'))");
      await pool.query("CREATE INDEX IF NOT EXISTS orders_created_idx ON orders ((data->>'createdAt'))");
      await pool.query("CREATE INDEX IF NOT EXISTS activity_order_idx ON activity ((data->>'orderId'))");
    })().catch(async (err) => {
      // database not reachable yet: try again on the next request instead of staying broken
      const failed = pool; pool = null; ready = null;
      await failed.end().catch(() => {});
      throw err;
    });
  }
  await ready;
  return pool;
}

function pgStore(name) {
  const table = TABLES[name];
  if (!table) throw new Error(`Unknown collection "${name}"`);
  return {
    async getJSON(key) {
      const { rows } = await (await db()).query(`SELECT data FROM ${table} WHERE key = $1`, [String(key)]);
      return rows[0] ? rows[0].data : null;
    },
    async setJSON(key, value) {
      await (await db()).query(
        `INSERT INTO ${table} (key, data) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [String(key), JSON.stringify(value)],
      );
    },
    async delete(key) {
      await (await db()).query(`DELETE FROM ${table} WHERE key = $1`, [String(key)]);
    },
    async keys() {
      const { rows } = await (await db()).query(`SELECT key FROM ${table} ORDER BY key`);
      return rows.map((r) => r.key);
    },
    async all() {
      const { rows } = await (await db()).query(`SELECT data FROM ${table}`);
      return rows.map((r) => r.data);
    },
  };
}

export async function openStore(name) {
  if (process.env.DATABASE_URL) {
    // slips are files kept outside the website folder; everything else lives in PostgreSQL
    if (name === "slips") {
      const dir = process.env.SLIP_DIR || process.env.CINTAMANI_LOCAL_STORE;
      if (!dir) throw new Error("SLIP_DIR is not set");
      return fileStore(dir, process.env.SLIP_DIR ? "" : "slips");
    }
    return pgStore(name);
  }
  const local = process.env.CINTAMANI_LOCAL_STORE;
  return local ? fileStore(local, name) : blobStore(name);
}

// for scripts (import, tests): close the database connection so the process can exit
export async function closeStore() {
  if (pool) { await pool.end(); pool = null; ready = null; }
}
