-- Digital Teras — 0002: stores, plans, subscriptions + RPC onboarding (Milestone 1)

-- ── plans: definisi paket freemium ──────────────────────────────────────────
create table public.plans (
  code       text primary key,                -- 'free' | 'micro' | 'pro'
  name       text not null,
  price_idr  bigint not null default 0,       -- per bulan, IDR utuh
  limits     jsonb not null default '{}',     -- {"max_products":10,...} + flag fitur
  is_public  boolean not null default true,
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.plans (code, name, price_idr, limits, sort) values
  ('free',  'Gratis', 0,
   '{"max_products":10,"max_links":5,"max_variants":3,"max_categories":3,"analytics_days":7,"hide_badge":false,"custom_font":false}', 0),
  ('micro', 'Micro', 29000,
   '{"max_products":100,"max_links":20,"max_variants":10,"max_categories":10,"analytics_days":30,"hide_badge":false,"custom_font":false}', 1),
  ('pro',   'Pro', 59000,
   '{"max_products":500,"max_links":50,"max_variants":20,"max_categories":30,"analytics_days":90,"hide_badge":true,"custom_font":true}', 2);

create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
create policy "plans_select_all" on public.plans for select using (true);

-- ── stores: satu toko per akun ──────────────────────────────────────────────
create table public.stores (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references public.profiles (id) on delete cascade,
  slug        text not null unique
              constraint stores_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$'),
  name        text not null,
  tagline     text,
  bio         text,
  avatar_path text,
  banner_path text,
  whatsapp    text not null constraint stores_whatsapp_format check (whatsapp ~ '^[0-9]{9,15}$'),
  published   boolean not null default true,
  settings    jsonb not null default '{}',     -- konfigurasi tema (M6), lihat themeSchema
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index stores_owner_idx on public.stores (owner_id);

alter table public.stores enable row level security;
-- Pemilik penuh atas tabelnya sendiri. INSERT sengaja TANPA policy:
-- pembuatan hanya lewat RPC create_store() yang tervalidasi (slug reserved dsb).
create policy "stores_select_own" on public.stores
  for select using (auth.uid() = owner_id);
create policy "stores_update_own" on public.stores
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "stores_delete_own" on public.stores
  for delete using (auth.uid() = owner_id);

create trigger stores_updated_at before update on public.stores
  for each row execute function public.set_updated_at();

-- ── subscriptions: status langganan per toko (dikelola sendiri, prepaid) ────
create table public.subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  store_id             uuid not null unique references public.stores (id) on delete cascade,
  plan_code            text not null references public.plans (code),
  status               text not null default 'active'
                       constraint subscriptions_status_check
                       check (status in ('trialing','active','past_due','canceled','expired')),
  current_period_start timestamptz,
  current_period_end   timestamptz,          -- NULL untuk 'free' selamanya
  grace_days           int not null default 3,
  provider             text default 'midtrans',
  provider_order_id    text,
  payment_method       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
-- Pemilik boleh membaca (untuk meter pemakaian); TIDAK boleh menulis —
-- hanya RPC/webhook/service-role yang mengubah langganan.
create policy "subscriptions_select_owner" on public.subscriptions
  for select using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ── fungsi slug: daftar cadangan di sisi DB (defense in depth, cermin src/lib/slug.ts) ──
create or replace function public.is_reserved_slug(p_slug text)
returns boolean
language sql
immutable
as $$
  select lower(p_slug) = any (array[
    -- rute aplikasi
    'dashboard','onboarding','login','register','logout','auth','callback',
    'pricing','legal','terms','privacy','help','support','about','tentang',
    'harga','akun','saya','admin','app','api','assets','static','store','stores',
    'shop','shops','toko','explore','search','cari','track','webhooks','img','cdn',
    'sitemap','robots','favicon','_next',
    -- meniru platform
    'digitalteras','digital-teras','terasmu','official','verifikasi','resmi'
  ]);
$$;

-- ── effective_plan: paket yang benar-benar berlaku SEKARANG ─────────────────
-- Expiry dievaluasi saat dibaca — cron tidak harus tepat waktu.
create or replace function public.effective_plan(p_store uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select s.plan_code
    from public.subscriptions s
    where s.store_id = p_store
      and s.status in ('trialing', 'active')
      and (s.current_period_end is null or s.current_period_end > now())
    limit 1
  ), 'free');
$$;

grant execute on function public.effective_plan(uuid) to anon, authenticated;

-- ── create_store: toko + langganan free dalam satu transaksi ────────────────
create or replace function public.create_store(
  p_slug        text,
  p_name        text,
  p_whatsapp    text,
  p_tagline     text default null,
  p_bio         text default null,
  p_avatar_path text default null,
  p_banner_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_store public.stores;
begin
  if v_uid is null then
    raise exception 'Wajib login untuk membuat toko' using errcode = '42501';
  end if;

  if p_slug is null or p_slug !~ '^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$' then
    raise exception 'Alamat toko tidak valid (3-30 huruf kecil/angka/strip)'
      using errcode = '22023';
  end if;

  if public.is_reserved_slug(p_slug) then
    raise exception 'Alamat % tidak tersedia, pilih lain ya', p_slug
      using errcode = '22023';
  end if;

  if p_whatsapp !~ '^[0-9]{9,15}$' then
    raise exception 'Nomor WhatsApp tidak valid — gunakan format 08xx atau 628xx'
      using errcode = '22023';
  end if;

  if exists (select 1 from public.stores where owner_id = v_uid) then
    raise exception 'Satu akun untuk satu toko ya' using errcode = '23505';
  end if;

  insert into public.stores
    (owner_id, slug, name, tagline, bio, avatar_path, banner_path, whatsapp)
  values
    (v_uid, lower(p_slug), btrim(p_name),
     nullif(btrim(coalesce(p_tagline, '')), ''),
     nullif(btrim(coalesce(p_bio, '')), ''),
     nullif(p_avatar_path, ''), nullif(p_banner_path, ''), p_whatsapp)
  returning * into v_store;

  insert into public.subscriptions (store_id, plan_code, status, current_period_start)
  values (v_store.id, 'free', 'active', now());

  return jsonb_build_object('id', v_store.id, 'slug', v_store.slug, 'name', v_store.name);
exception
  when unique_violation then
    -- race slug dua user bersamaan
    raise exception 'Wah, alamat itu baru saja dipakai. Coba nama lain ya.'
      using errcode = '23505';
end;
$$;

grant execute on function public.create_store(text, text, text, text, text, text, text)
  to authenticated;

-- ── ketersediaan slug (live check di wizard onboarding) ─────────────────────
create or replace function public.is_store_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_slug ~ '^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$'
     and not public.is_reserved_slug(p_slug)
     and not exists (select 1 from public.stores where slug = lower(p_slug));
$$;

grant execute on function public.is_store_slug_available(text) to authenticated;

-- ── storage: bucket aset toko (avatar/banner/produk — publik dibaca) ────────
insert into storage.buckets (id, name, public)
values ('store-assets', 'store-assets', true)
on conflict (id) do nothing;

-- Tulis hanya ke folder milik sendiri: path selalu `{auth.uid()}/...`
-- (createSignedUploadUrl + uploadToSignedUrl memakai hak ini).
create policy "store_assets_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "store_assets_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "store_assets_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'store-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
