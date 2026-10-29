# Digital Teras

Micro-SaaS link-in-bio dengan katalog produk & checkout WhatsApp (micro-store) untuk UMKM/kreator Indonesia.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind 4 · shadcn/ui · Zustand · Zod v4 · Supabase (Postgres/Auth/Storage) · Midtrans (sandbox) · Vercel.

## Setup pengembangan

1. **Pasang dependensi**
   ```bash
   pnpm install
   ```
2. **Supabase lokal** (butuh Docker) — atau pakai proyek cloud:
   ```bash
   pnpm dlx supabase start     # catat API URL + anon key + service role key
   pnpm dlx supabase db reset  # jalankan migrasi + seed
   ```
3. **Environment** — salin `​.env.example` → `.env.local`, isi URL & key dari langkah 2.
4. **Jalankan**
   ```bash
   pnpm dev
   ```
5. **Auth Google (opsional):** di dashboard Supabase → Auth → Provider Google, dan tambahkan redirect URL `http://localhost:3000/auth/callback`.

## Perintah

| Perintah | Fungsi |
|---|---|
| `pnpm dev` / `pnpm build` | development / production build |
| `pnpm test` | unit test (Vitest) |
| `pnpm typecheck` / `pnpm lint` | pemeriksaan tipe / ESLint |
| `pnpm dlx supabase db reset` | reset DB lokal: migrate + seed |
| `pnpm dlx supabase gen types typescript --local > src/types/database.ts` | regenerasi tipe dari skema DB (mulai M1) |

## Konvensi penting

- **Uang = IDR utuh (`bigint`)** — lihat `src/lib/format.ts` (`formatRupiah`).
- **Gambar disimpan sebagai path Storage**, bukan URL — helper `assetUrl()`.
- **Skema DB adalah sumber kebenaran**; migrasi di `supabase/migrations/`, jangan edit DB manual.
- **Slug toko** berverifikasi di Zod, helper `src/lib/slug.ts`, DAN di RPC `create_store` (defense in depth).
- **Service-role key** hanya boleh diimpor lewat `src/lib/supabase/admin.ts` (di-backup `server-only`).
- **Cache Components aktif** (`next.config.ts`): rute dinamis = shell + `<Suspense>`; cache halaman pakai `"use cache"` + tag `store:{slug}` yang di-revalidate tiap mutasi seller.

## Roadmap milestone

- ✅ **M0** — scaffold, Supabase lokal/cloud, auth (email+Google), guard middleware (`src/proxy.ts`), profiles trigger
- ✅ **M1** — `stores`/`plans`/`subscriptions` + RPC `create_store`, wizard onboarding (live-check slug, WA 08xx), dashboard + sidebar, upload signed-URL
- ✅ **M2** — katalog: produk + varian/stok (invariant varian `Default`), `upsert_product` atomik, gambar produk, guard `can_create`
- ✅ **M3** — storefront publik `/{slug}` (views anonim + `"use cache"` tag per toko, 3 layout, OG image, `links` + manajemennya)
- ✅ **M4** — keranjang Zustand + checkout WhatsApp + order log (`place_order` otoritatif harga; snapshot item; realtime dashboard)
- ✅ **M5** — analitik: beacon `/api/track`, event + rollup, corong konversi, dedupe 30 dtk
- ✅ **M6** — tema: `themeSchema`, CSS vars di server-render, editor + pratinjau langsung
- ✅ **M7** — langganan Midtrans (sandbox): `billing_payments`, webhook idempoten + SHA512 + belt-check, halaman Langganan (QRIS/VABCA/Snap kartu), meter batas di semua create
- ⏭ **M8** — polish/SEO: sitemap, JSON-LD, Lighthouse storefront, rate-limit, audit RLS anon

Detail lengkap: lihat rencana teknis di `~/.claude/plans/saya-ingin-membuat-digital-glittery-otter.md`.
