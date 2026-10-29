-- Digital Teras — 0005: orders + order_items + RPC place_order (Milestone 4)
-- Pesanan WhatsApp dicatat SEBELUM chat terkirim → seller punya order log.

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.stores (id) on delete cascade,
  ref              text not null unique,            -- 'DT-XXXXXXXX', kode yang dilihat pembeli
  status           text not null default 'created'
                   constraint orders_status_check
                   check (status in ('created','confirmed','processing','completed','cancelled')),
  buyer_name       text not null,
  buyer_phone      text,
  buyer_note       text,
  items_total_idr  bigint not null check (items_total_idr >= 0),
  total_idr        bigint not null check (total_idr >= 0),   -- = items_total (diskon/kirim: fase depan)
  message          text,                            -- teks WA persis yang dikirim (audit)
  session_id       uuid,                            -- pengait funnel analitik (M5)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index orders_store_created_idx on public.orders (store_id, created_at desc);
create index orders_store_status_idx  on public.orders (store_id, status);

alter table public.orders enable row level security;
-- Pemilik toko: baca + ubah status. TANPA insert/update/delete policy untuk
-- klien — pembuatan HANYA via RPC place_order (anon boleh memanggil RPC-nya).
create policy "orders_select_owner" on public.orders
  for select using (store_id in (select id from public.stores where owner_id = auth.uid()));
create policy "orders_update_status_owner" on public.orders
  for update using (store_id in (select id from public.stores where owner_id = auth.uid()))
  with check (store_id in (select id from public.stores where owner_id = auth.uid()));

create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Snapshot item: nama/harga/gambar dibekukan — riwayat selamat dari edit/hapus produk.
create table public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders (id) on delete cascade,
  product_id     uuid references public.products (id) on delete set null,
  variant_id     uuid references public.product_variants (id) on delete set null,
  product_name   text not null,
  variant_name   text not null,
  image_path     text,
  unit_price_idr bigint not null check (unit_price_idr >= 0),
  qty            int not null check (qty between 1 and 999),
  created_at     timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

alter table public.order_items enable row level security;
create policy "order_items_select_owner" on public.order_items
  for select using (
    order_id in (
      select o.id from public.orders o
      join public.stores s on s.id = o.store_id
      where s.owner_id = auth.uid()
    )
  );

-- ── place_order: validasi keanggotaan & harga OTORITATIF dari DB ────────────
-- p_items: [{"variantId": "<uuid>", "qty": 2}]. Harga klien TIDAK dibaca.
-- Stok divalidasi (>0) tapi TIDAK dikurangi — order WA = niat beli (keputusan M0).
create or replace function public.place_order(
  p_store_slug text,
  p_buyer      jsonb,
  p_items      jsonb,
  p_session    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store    record;
  v_item     jsonb;
  v_variant  record;
  v_qty      int;
  v_line     jsonb;
  v_lines    jsonb := '[]'::jsonb;
  v_total    bigint := 0;
  v_ref      text;
  v_order    uuid;
  v_name     text := trim(coalesce(p_buyer ->> 'name', ''));
  v_phone    text := nullif(trim(coalesce(p_buyer ->> 'phone', '')), '');
  v_note     text := nullif(trim(coalesce(p_buyer ->> 'note', '')), '');
begin
  select * into v_store from public.stores
   where slug = p_store_slug and published = true;
  if not found then
    raise exception 'Toko tidak ditemukan atau sedang tidak menerima pesanan.'
      using errcode = 'P0002';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Pesanan tidak valid.' using errcode = '22023';
  end if;

  if length(v_name) < 2 then
    raise exception 'Isi nama kamu dulu ya (minimal 2 karakter).' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item ->> 'qty')::int, 0);
    if v_qty < 1 or v_qty > 99 then
      raise exception 'Jumlah per produk antara 1 dan 99.' using errcode = '22023';
    end if;

    select v.id, v.name as variant_name, v.price_idr, v.stock, v.is_active,
           p.id as product_id, p.name as product_name, p.image_path,
           p.is_active as product_active
      into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = (v_item ->> 'variantId')::uuid
        and p.store_id = v_store.id
      limit 1;

    if not found or v_variant.is_active is not true
       or v_variant.product_active is not true then
      raise exception 'Salah satu produk sudah tidak tersedia — muat ulang halaman ya.'
        using errcode = 'P0002';
    end if;

    if v_variant.stock is not null and v_variant.stock <= 0 then
      raise exception 'Stok "%"% sedang habis — hubungi penjual ya.',
        v_variant.variant_name,
        case when v_variant.variant_name = 'Default' then '' else ' dari ' || v_variant.product_name end
        using errcode = '22023';
    end if;

    v_line := jsonb_build_object(
      'product_id',   v_variant.product_id,
      'variant_id',   v_variant.id,
      'product_name', v_variant.product_name,
      'variant_name', v_variant.variant_name,
      'image_path',   v_variant.image_path,
      'unit_price',   v_variant.price_idr,
      'qty',          v_qty
    );
    v_lines := v_lines || jsonb_build_array(v_line);
    v_total := v_total + v_variant.price_idr * v_qty;
  end loop;

  -- ref unik, retry ringan
  for attempt in 1..6 loop
    v_ref := 'DT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.orders where ref = v_ref);
  end loop;

  insert into public.orders
    (store_id, ref, buyer_name, buyer_phone, buyer_note,
     items_total_idr, total_idr, session_id)
  values
    (v_store.id, v_ref, v_name, v_phone, v_note, v_total, v_total, p_session)
  returning id into v_order;

  insert into public.order_items
    (order_id, product_id, variant_id, product_name, variant_name,
     image_path, unit_price_idr, qty)
  select
    v_order,
    (l ->> 'product_id')::uuid, (l ->> 'variant_id')::uuid,
    l ->> 'product_name', l ->> 'variant_name', l ->> 'image_path',
    (l ->> 'unit_price')::bigint, (l ->> 'qty')::int
  from jsonb_array_elements(v_lines) l;

  return jsonb_build_object(
    'order_id',  v_order,
    'ref',       v_ref,
    'total_idr', v_total,
    'lines',     v_lines,
    'buyer',     jsonb_build_object('name', v_name, 'phone', v_phone, 'note', v_note),
    'store',     jsonb_build_object('name', v_store.name, 'whatsapp', v_store.whatsapp, 'slug', v_store.slug)
  );
end;
$$;

-- Pembeli adalah ANON — RPC pesan harus bisa dipanggil tanpa login.
grant execute on function public.place_order(text, jsonb, jsonb, uuid) to anon, authenticated;

-- Pesan WA dirakit di aplikasi (setelah ref diketahui) lalu disimpan untuk audit.
-- Hanya boleh mengisi message yang masih kosong pada order berumur < 10 menit.
create or replace function public.set_order_message(p_order uuid, p_message text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.orders
     set message = left(p_message, 4000)
   where id = p_order
     and message is null
     and status = 'created'
     and created_at > now() - interval '10 minutes';
$$;

grant execute on function public.set_order_message(uuid, text) to anon, authenticated;
