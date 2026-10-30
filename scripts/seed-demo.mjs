/**
 * Seed demo-store lengkap (akun + toko + tautan + produk bervalidasi + tema)
 * via service key — untuk preview cepat & uji Lighthouse.
 *
 *   node scripts/seed-demo.mjs [--slug nama-slug-demo] [--pass PASSWORD_DEMO]
 *
 * Credential login demo dicetak di akhir. Idempoten: kalau slug sudah dipakai,
 * membuat slug baru dengan suffix angka.
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const svc = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !svc) {
  console.error("butuh NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY di .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const arg = (flag, dft) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dft;
};
const baseSlug = arg("--slug", "demo-copyan");
const pass = arg("--pass", "DemoTeras2026!");
const email = `demo.${baseSlug}@example.com`;

const H = { apikey: svc, Authorization: `Bearer ${svc}`, "Content-Type": "application/json" };
const api = async (path, opts = {}) => {
  const r = await fetch(`${url}/rest/v1/${path}`, { ...opts, headers: { ...H, ...opts.headers } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j;
};
const rpc = (fn, body) => api(`rpc/${fn}`, { method: "POST", body: JSON.stringify(body) });

// 1) akun demo (upsert via admin API)
let user = (await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
  headers: H,
}).then((r) => (r.ok ? r.json() : null)))?.users?.[0];
if (!user) {
  user = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ email, password: pass, email_confirm: true }),
  }).then((r) => r.json());
  if (!user.id) throw new Error("gagal membuat user: " + JSON.stringify(user).slice(0, 200));
}
console.log("user  :", user.id);

// 2) slug bebas (coba base, lalu base-2, base-3, …)
let slug = baseSlug;
{
  let found = false;
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? baseSlug : `${baseSlug}-${n}`;
    const ok = await rpc("is_store_slug_available", { p_slug: candidate });
    if (ok === true) {
      slug = candidate;
      found = true;
      break;
    }
  }
  if (!found) throw new Error("tidak ada slug demo yang tersedia");
}

// 3) toko + subscription free (sebagai user demo → pakai token login)
const tok = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: pass }),
}).then((r) => r.json());
if (!tok.access_token) throw new Error("login demo gagal");
const asUser = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" };
const store = await fetch(`${url}/rest/v1/rpc/create_store`, {
  method: "POST",
  headers: asUser,
  body: JSON.stringify({
    p_slug: slug,
    p_name: "Kopi Senja Demo",
    p_whatsapp: "6281234567890",
    p_tagline: "Rojak rasa, disangrai tiap pagi",
    p_bio: "Versi demo Digital Teras — katalog & pesanan WhatsApp dalam satu link.",
  }),
}).then((r) => r.json());
console.log("store :", slug, store.id ?? store);

const S = (await api(`stores?select=id,owner_id&slug=eq.${slug}`, { headers: asUser }))[0];

// 4) tema sedikit beda (hijau daun, rounded)
await api(`stores?id=eq.${S.id}`, {
  method: "PATCH",
  headers: asUser,
  body: JSON.stringify({
    settings: {
      theme: {
        accent: "#15803d",
        layout: "grid",
        radius: "xl",
        font: "sans",
        button: "solid",
        show_powered: true,
      },
    },
  }),
});

// 5) tautan sosial
for (const [i, l] of [
  ["Instagram kita", "https://instagram.com/kopisenja", "instagram"],
  ["TikTok", "https://tiktok.com/@kopisenja", "tiktok"],
  ["WhatsApp toko", "https://wa.me/6281234567890", "whatsapp"],
].entries()) {
  await api("links", {
    method: "POST",
    headers: asUser,
    body: JSON.stringify({ store_id: S.id, label: l[0], url: l[1], icon: l[2], position: i }),
  });
}

// 6) produk
const produk = [
  { name: "Kopi Gayo 200g", desc: "Single origin, medium roast. Aroma rempah khas Dataran Tinggi Gayo.", variants: [{ name: "Default", price: 55000, stock: 12 }] },
  { name: "Kopi Torangka 250g", desc: "Blend house-style, cocok susu.", variants: [
    { name: "Bubuk", price: 68000, stock: 5 },
    { name: "Biji", price: 70000, stock: 8 },
    { name: "Sangrai Medium · 500g", price: 125000, stock: 0 },
  ] },
  { name: "Tumbler Logam 500ml", desc: "Tahan dingin 12 jam.", variants: [{ name: "Default", price: 89000, stock: null }] },
  { name: "Voucher Seduh Lokal", desc: "Gratis 30 menit kerja + refill kopi hitam.", variants: [{ name: "Default", price: 45000, stock: null }] },
];
for (const p of produk) {
  const out = await api("rpc/upsert_product", {
    method: "POST",
    headers: asUser,
    body: JSON.stringify({
      p_id: null,
      p_name: p.name,
      p_description: p.desc,
      p_image_path: null,
      p_is_active: true,
      p_variants: p.variants.map((v) => ({ id: null, name: v.name, price: v.price, stock: v.stock })),
    }),
  });
  console.log("produk:", out.slug ?? out);
}

console.log("\nSELESAI ✔  login demo:", email, "/", pass);
console.log("etalase: " + (env.NEXT_PUBLIC_APP_URL || url) + "/" + slug);
