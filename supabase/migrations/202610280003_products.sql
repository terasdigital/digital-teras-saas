-- Digital Teras — 0003: katalog produk + varian/stok + guard can_create (Milestone 2)

-- ── products ────────────────────────────────────────────────────────────────
create table public.products (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id) on delete cascade,
  name        text not null,
  slug        text not null
              constraint products_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$'),
  description text,
  image_path  text,
  price_idr   bigint not null default 0,   -- display = min harga varian (dijaga trigger)
  is_active   boolean not null default true,
  position    int not null default 0,      -- urutan tampil (UI sort: M8)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint products_slug_per_store unique (store_id, slug)
);

create index products_store_active_idx on public.products (store_id, is_active, position, created_at);

alter table public.products enable row level security;
-- Pemilik boleh baca/ubah/hapus; TANPA policy INSERT — pembuatan hanya
-- lewat upsert_product() (slug unik + batas paket + varian Default dijamin).
create policy "products_select_own" on public.products
  for select using (store_id in (select id from public.stores where owner_id = auth.uid()));
create policy "products_update_own" on public.products
  for update using (store_id in (select id from public.stores where owner_id = auth.uid()))
  with check (store_id in (select id from public.stores where owner_id = auth.uid()));
create policy "products_delete_own" on public.products
  for delete using (store_id in (select id from public.stores where owner_id = auth.uid()));

create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ── product_variants ────────────────────────────────────────────────────────
-- Selalu ≥1 varian per produk ('Default' untuk produk tanpa varian) sehingga
-- cart/order_items seragam mereferensi variant_id.
create table public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name       text not null,
  price_idr  bigint not null check (price_idr >= 0),
  stock      integer check (stock >= 0),   -- NULL = stok tidak dilacak
  sku        text,
  is_active  boolean not null default true,
  position   int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_idx on public.product_variants (product_id, is_active, position);

alter table public.product_variants enable row level security;
create policy "variants_select_own" on public.product_variants
  for select using (
    product_id in (
      select p.id from public.products p
      join public.stores s on s.id = p.store_id
      where s.owner_id = auth.uid()
    )
  );
create policy "variants_update_own" on public.product_variants
  for update using (
    product_id in (
      select p.id from public.products p
      join public.stores s on s.id = p.store_id
      where s.owner_id = auth.uid()
    )
  );
create policy "variants_delete_own" on public.product_variants
  for delete using (
    product_id in (
      select p.id from public.products p
      join public.stores s on s.id = p.store_id
      where s.owner_id = auth.uid()
    )
  );
-- INSERT hanya via upsert_product() RPC.

create trigger variants_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();

-- ── harga produk = min harga varian aktif (fallback: min semua varian) ──────
create or replace function public.sync_product_price()
returns trigger
language plpgsql
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products
     set price_idr = coalesce((
       select min(v.price_idr)
       from public.product_variants v
       where v.product_id = v_product
     ), 0)
   where id = v_product;
  return null;
end;
$$;

create trigger variants_sync_price
  after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_price();

-- ── slug produk unik per toko (suffix -2, -3, … otomatis) ───────────────────
create or replace function public.generate_store_product_slug(p_store uuid, p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text := lower(trim(regexp_replace(coalesce(p_name, 'produk'), '[^a-zA-Z0-9 -]', '', 'g')));
  v_slug text;
  v_try  int := 0;
begin
  v_base := trim(regexp_replace(v_base, ' +', '-', 'g'));
  if v_base = '' then v_base := 'produk'; end if;
  v_base := left(v_base, 44);

  loop
    v_slug := case when v_try = 0 then v_base else v_base || '-' || v_try::text end;
    if not exists (
      select 1 from public.products
      where store_id = p_store and slug = v_slug
    ) then
      return v_slug;
    end if;
    v_try := v_try + 1;
    if v_try > 50 then
      raise exception 'Terlalu banyak produk dengan nama serupa.' using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- ── can_create: SATU guard batas paket (dipakai aksi server & meter UI) ────
-- 'product': jumlah SELURUH produk (aktif maupun nonaktif — agar tidak bisa
-- diakali dengan menonaktifkan); 'variant' dicek di upsert_product (per produk).
-- Limit NULL/absen = tak terbatas.
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
          else 0
        end
      ) < ((l.limits ->> ('max_' || p_kind))::int)
    ),
    'used',
    case p_kind
      when 'product' then (select count(*) from public.products where store_id = p_store)
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

grant execute on function public.can_create(uuid, text) to authenticated;

-- ── upsert_product: produk + varian atomik, batas paket ditegakkan di DB ────
-- p_variants: [{"id": "...", "name": "...", "price": 12000, "stock": 5|null}]
create or replace function public.upsert_product(
  p_id          uuid,
  p_name        text,
  p_description text,
  p_image_path  text,
  p_is_active   boolean,
  p_variants    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_store    uuid;
  v_pid      uuid;
  v_slug     text;
  v_plan     text;
  v_max_var  int;
  v_guard    jsonb;
  v_count    int;
  v_row      jsonb;
  v_vid      uuid;
begin
  if v_uid is null then
    raise exception 'Wajib login' using errcode = '42501';
  end if;

  select id into v_store from public.stores where owner_id = v_uid;
  if v_store is null then
    raise exception 'Buat toko dulu ya' using errcode = 'P0002';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Nama produk minimal 2 karakter' using errcode = '22023';
  end if;

  if p_variants is null or jsonb_typeof(p_variants) <> 'array'
     or jsonb_array_length(p_variants) < 1 then
    raise exception 'Produk butuh minimal satu pilihan harga' using errcode = '22023';
  end if;

  -- batas varian per produk dari paket aktif
  v_plan := public.effective_plan(v_store);
  select (limits ->> 'max_variants')::int into v_max_var
    from public.plans where code = v_plan;
  v_count := jsonb_array_length(p_variants);
  if v_max_var is not null and v_count > v_max_var then
    raise exception 'Paket % membolehkan maks % varian per produk — kurangi atau upgrade ya.',
      initcap(v_plan), v_max_var using errcode = '22023';
  end if;

  if p_id is null then
    v_guard := public.can_create(v_store, 'product');
    if (v_guard ->> 'can')::boolean is not true then
      raise exception 'Paket % maksimal % produk (pakai: %). Upgrade untuk menambah ya.',
        initcap(v_guard ->> 'plan'),
        coalesce(v_guard ->> 'limit', '∅'),
        v_guard ->> 'used'
        using errcode = '22023';
    end if;

    v_slug := public.generate_store_product_slug(v_store, p_name);
    insert into public.products (store_id, name, slug, description, image_path, is_active)
    values (v_store, trim(p_name), v_slug,
            nullif(trim(coalesce(p_description, '')), ''),
            nullif(p_image_path, ''),
            coalesce(p_is_active, true))
    returning id into v_pid;
  else
    update public.products
       set name = trim(p_name),
           description = nullif(trim(coalesce(p_description, '')), ''),
           image_path = nullif(p_image_path, ''),
           is_active = coalesce(p_is_active, is_active)
     where id = p_id and store_id = v_store
     returning id into v_pid;
    if v_pid is null then
      raise exception 'Produk tidak ditemukan' using errcode = 'P0002';
    end if;
    v_slug := (select slug from public.products where id = v_pid);
  end if;

  -- varian mana yang TIDAK ada di payload → hapus
  delete from public.product_variants v
   where v.product_id = v_pid
     and not exists (
       select 1 from jsonb_array_elements(p_variants) el
       where el ? 'id' and (el ->> 'id')::uuid = v.id
     );

  for v_row in select * from jsonb_array_elements(p_variants) loop
    if v_row ? 'id' and exists (
        select 1 from public.product_variants
        where id = (v_row ->> 'id')::uuid and product_id = v_pid
    ) then
      update public.product_variants
         set name = trim(v_row ->> 'name'),
             price_idr = (v_row ->> 'price')::bigint,
             stock = case when jsonb_typeof(v_row -> 'stock') = 'null'
                          then null else (v_row -> 'stock')::int end
       where id = (v_row ->> 'id')::uuid;
    else
      insert into public.product_variants (product_id, name, price_idr, stock)
      values (
        v_pid,
        trim(v_row ->> 'name'),
        (v_row ->> 'price')::bigint,
        case when jsonb_typeof(v_row -> 'stock') = 'null'
             then null else (v_row -> 'stock')::int end
      );
    end if;
  end loop;

  -- jaminan invariant: minimal 1 varian tersisa
  select count(*) into v_count from public.product_variants where product_id = v_pid;
  if v_count < 1 then
    raise exception 'Produk harus punya minimal satu varian' using errcode = '22023';
  end if;

  return jsonb_build_object('id', v_pid, 'slug', v_slug);
end;
$$;

grant execute on function public.upsert_product(uuid, text, text, text, boolean, jsonb)
  to authenticated;
