-- Digital Teras — 0004: links + views baca publik (anon) + can_create v2 (Milestone 3)

-- ── links: tautan sosial & CTA pada halaman publik ──────────────────────────
create table public.links (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores (id) on delete cascade,
  label      text not null,
  url        text not null constraint links_url_format check (url ~ '^https?://'),
  icon       text,           -- key peta ikon di app (instagram|tiktok|whatsapp|...)
  position   int not null default 0,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index links_store_idx on public.links (store_id, enabled, position, created_at);

alter table public.links enable row level security;
create policy "links_select_own" on public.links
  for select using (store_id in (select id from public.stores where owner_id = auth.uid()));
create policy "links_insert_own" on public.links
  for insert with check (store_id in (select id from public.stores where owner_id = auth.uid()));
create policy "links_update_own" on public.links
  for update using (store_id in (select id from public.stores where owner_id = auth.uid()))
  with check (store_id in (select id from public.stores where owner_id = auth.uid()));
create policy "links_delete_own" on public.links
  for delete using (store_id in (select id from public.stores where owner_id = auth.uid()));

create trigger links_updated_at before update on public.links
  for each row execute function public.set_updated_at();

-- ── can_create v2: sekarang paham 'product' DAN 'link' ──────────────────────
create or replace function public.can_create(p_store uuid, p_kind text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'can',
    coalesce(
      l.limits -> ('max_' || p_kind) is null
      or (
        case p_kind
          when 'product' then (select count(*) from public.products where store_id = p_store)
          when 'link'    then (select count(*) from public.links    where store_id = p_store)
          else 0
        end
      ) < ((l.limits ->> ('max_' || p_kind))::int)
    ),
    'used',
    case p_kind
      when 'product' then (select count(*) from public.products where store_id = p_store)
      when 'link'    then (select count(*) from public.links    where store_id = p_store)
      else 0
    end,
    'limit',
    case
      when l.limits ->> ('max_' || p_kind) is null then null
      else ((l.limits ->> ('max_' || p_kind))::int)::numeric
    end,
    'plan', public.effective_plan(p_store)
  )
  from (select p.limits from public.plans p where p.code = public.effective_plan(p_store)) l;
$$;

-- ── VIEWS PUBLIK ────────────────────────────────────────────────────────────
-- Dimiliki postgres (security_invoker OFF) → RLS tabel dasar tidak menghalangi;
-- anon hanya boleh SELECT view ini. Kolom sensibles (owner_id) tidak diekspos.
-- Satu-satunya sumber kebenaran untuk semua pembacaan etalase publik.

create or replace view public.public_storefront as
select
  id, slug, name, tagline, bio,
  avatar_path, banner_path,
  whatsapp,                       -- memang tampil di tombol "Chat" — data publik
  settings, created_at
from public.stores
where published = true;

create or replace view public.public_links as
select l.id, l.store_id, l.label, l.url, l.icon, l.position
from public.links l
join public.stores s on s.id = l.store_id
where s.published and l.enabled;

-- Varian aktif diagregat JSONB agar etalase cukup SATU query produk
-- (view tidak punya FK → embed PostgREST tidak bisa dipakai lintas view).
create or replace view public.public_products as
select
  p.id, p.store_id,
  s.slug as store_slug,
  p.name, p.slug, p.description, p.image_path, p.price_idr, p.position, p.created_at,
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', v.id, 'name', v.name,
          'price_idr', v.price_idr, 'stock', v.stock
        )
        order by v.position, v.name
      ),
      '[]'::jsonb
    )
    from public.product_variants v
    where v.product_id = p.id and v.is_active
  ) as variants
from public.products p
join public.stores s on s.id = p.store_id
where s.published and p.is_active;
