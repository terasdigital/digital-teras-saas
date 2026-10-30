/**
 * Audit RLS Digital Teras — dijalankan DENGAN ANON KEY (kacamata pengunjung
 * anonim). Baca saja + satu RPC error-path yang tidak menyimpan apa pun.
 *
 *   node scripts/audit-rls.mjs
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("butuh .env.local dengan NEXT_PUBLIC_SUPABASE_URL + ANON_KEY");
  process.exit(1);
}

let failures = 0;
function check(name, pass, note = "") {
  console.log(`${pass ? "PASS" : "FAIL"} │ ${name}${note ? ` — ${note}` : ""}`);
  if (!pass) failures++;
}

async function rest(path, opts = {}) {
  const { headers, ...fetchOpts } = opts;
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...fetchOpts,
    headers: { apikey: anon, ...headers },
  });
  let j = null;
  try {
    j = await r.json();
  } catch {
    /* non-json */
  }
  return { status: r.status, j };
}

// ── 1) tabel dasar TIDAK boleh terbaca anon (ditolak ATAU kosong) ────────────
const BASE_TABLES = [
  "stores",
  "subscriptions",
  "billing_payments",
  "webhook_events",
  "analytics_events",
  "orders",
  "order_items",
  "links",
  "products",
  "product_variants",
  "profiles",
];
for (const t of BASE_TABLES) {
  const { status, j } = await rest(`${t}?select=*&limit=5`);
  const leaked = status === 200 && Array.isArray(j) && j.length > 0;
  check(`anon tidak bisa baca ${t}`, !leaked, leaked ? `${j.length} baris BOCOR!` : `HTTP ${status}`);
}

// ── 2) view publik: hanya kolom aman ────────────────────────────────────────
const sf = await rest("public_storefront?select=*&limit=5");
if (sf.status === 200 && Array.isArray(sf.j)) {
  const row0 = sf.j[0];
  check(
    "public_storefront tanpa owner_id",
    !row0 || !("owner_id" in row0),
    `${sf.j.length} toko published terlihat (memang publik)`,
  );
} else {
  check("public_storefront terbaca", sf.status === 200 || sf.status === 404, `HTTP ${sf.status}`);
}

const pp = await rest("public_products?select=*&limit=5");
if (pp.status === 200 && Array.isArray(pp.j)) {
  const row0 = pp.j[0];
  check(
    "public_products tanpa kolom sensitif",
    !row0 || (!("owner_id" in row0) && !("is_active" in row0)),
    `${pp.j.length} produk aktif`,
  );
}

// ── 3) grant efektif_plan utk anon harus dicabut (migrasi 0011) ─────────────
if (row0id(sf)) {
  const ep = await rest(`rpc/effective_plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ p_store: sf.j[0].id }),
  });
  check(
    "anon TIDAK boleh panggil effective_plan (butuh migrasi 0011)",
    ep.status === 401 || ep.status === 403 || ep.status === 404 || ep.j?.code === "42882",
    `HTTP ${ep.status}`,
  );
} else {
  console.log("SKIP │ cek effective_plan (tidak ada toko published)");
}
function row0id(x) {
  return x.status === 200 && Array.isArray(x.j) && x.j.length > 0;
}

// ── 4) place_order dengan varian tak dikenal → ditolak, tak ada order ───────
if (row0id(sf)) {
  const po = await rest("rpc/place_order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_store_slug: sf.j[0].slug,
      p_buyer: { name: "Audit Bot" },
      p_items: [{ variantId: randomUUID(), qty: 1 }],
    }),
  });
  const msg = typeof po.j?.message === "string" ? po.j.message : "";
  const rejected = po.status >= 400 && /tidak tersedia|Wajib|valid/i.test(msg);
  check(
    "place_order varian palsu → ditolak RPC (bukan sekadar error transport)",
    rejected,
    msg.slice(0, 60) || `HTTP ${po.status}`,
  );
}

// ── 5) harga tidak pernah datang dari klien: RPC hanya terima variantId+qty ──
const rpcSrc = fs.readFileSync(new URL("../supabase/migrations/202610280005_orders.sql", import.meta.url), "utf8");
check(
  "place_order menghitung harga dari DB (audit statis)",
  /v_variant\.price_idr/.test(rpcSrc) && !/p_items ->> 'price'/i.test(rpcSrc),
);

console.log(
  failures === 0
    ? "\nSEMUA CEK LULUS ✔"
    : `\n${failures} CEK GAGAL ✗ — perbaiki sebelum launch`,
);
process.exit(failures === 0 ? 0 : 1);
