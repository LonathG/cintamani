// Storage for orders (JSON) and payment slips (binary).
// On Netlify this uses Netlify Blobs. For local development (scripts/dev-server.mjs sets
// CINTAMANI_LOCAL_STORE) it writes plain files under that folder instead.
import { promises as fs } from "node:fs";
import path from "node:path";

function fileStore(root, name) {
  const dir = path.join(root, name);
  const safe = (key) => path.join(dir, encodeURIComponent(key));
  return {
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
  };
}

async function blobStore(name) {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name, consistency: "strong" });
  return {
    getJSON: (key) => store.get(key, { type: "json" }),
    setJSON: (key, value) => store.setJSON(key, value),
    async getFile(key) {
      const res = await store.getWithMetadata(key, { type: "arrayBuffer" });
      return res ? { data: Buffer.from(res.data), contentType: res.metadata.contentType } : null;
    },
    setFile: (key, data, contentType) => store.set(key, data, { metadata: { contentType } }),
    delete: (key) => store.delete(key),
    async keys() {
      const { blobs } = await store.list();
      return blobs.map((b) => b.key);
    },
  };
}

export async function openStore(name) {
  const local = process.env.CINTAMANI_LOCAL_STORE;
  return local ? fileStore(local, name) : blobStore(name);
}
