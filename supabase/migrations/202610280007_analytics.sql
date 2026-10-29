-- Digital Teras — 0007: analitik (events mentah + rollup + RPC) (Milestone 5)
-- Pembacaan dashboard memakai RAW events dalam window (≤90 hari, zona
-- Asia/Jakarta). Rollup harian + retensi tersedia sebagai RPC dan dijadwalkan
-- via pg_cron bila ekstensinya ada (lihat bagian akhir).

-- ── events mentah (append-only; TIDAK ada FK ke stores agar insert panas
--    tetap murah & event selamat dari penghapusan toko) ─────────────────────
create table public.analytics_events (
  id         bigint generated always as identity primary key,
  store_id   uuid not null,
  type       text not null constraint ae_type_check
             check (type in ('visit','link_click','product_view','cart_add','checkout','order')),
  session_id uuid,
  target_id  uuid,                 -- link_id / product-variant id / dsb.
  path       text,
  referrer   text,
  is_bot     boolean not null default false,
  created_at timestamptz not null default now()
);

create index ae_store_time_idx on public.analytics_events (store_id, created_at);
create index ae_store_type_idx on public.analytics_events (store_id, type, created_at)
  where is_bot = false;

alter table public.analytics_events enable row level security;
-- Tulis HANYA via RPC (log_event / place_order). Pemilik boleh baca untuk
-- kebutuhan lanjutan; dashboard utama memakai RPC agregat di bawah.
create policy "ae_select_owner" on public.analytics_events
  for select using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

-- ── rollup harian (optimasi; MVP membaca raw) ───────────────────────────────
create table public.analytics_daily (
  store_id uuid not null references public.stores (id) on delete cascade,
  day      date not null,
  metric   text not null,
  value    bigint not null,
  primary key (store_id, day, metric)
);

alter table public.analytics_daily enable row level security;
create policy "ad_select_owner" on public.analytics_daily
  for select using (
    store_id in (select id from public.stores where owner_id = auth.uid())
  );

-- ── log_event: jalur tulis anonim murah (beacon /api/track) ─────────────────
create or replace function public.log_event(
  p_slug     text,
  p_type     text,
  p_session  uuid,
  p_target   uuid,
  p_path     text,
  p_referrer text,
  p_is_bot   boolean default false
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.analytics_events
    (store_id, type, session_id, target_id, path, referrer, is_bot)
  select s.id, p_type, p_session, p_target, left(p_path, 300), left(p_referrer, 300), p_is_bot
  from public.stores s
  where s.slug = p_slug and s.published = true;
$$;

grant execute on function public.log_event(text, text, uuid, uuid, text, text, boolean)
  to anon, authenticated;

-- Pembacaan memakai RAW events saja. Retensi 90 hari == window terbesar (Pro),
-- jadi window selalu lengkap tanpa bergantung cron. analytics_daily +
-- rollup_analytics() tetap tersedia sebagai optimasi masa depan (window >90d
-- atau volume besar → seri dibaca dari rollup, bukan raw).

-- ── seri harian, zona Asia/Jakarta ──────────────────────────────────────────
create or replace function public.analytics_series(p_store uuid, p_days int)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select (now() at time zone 'Asia/Jakarta')::date as today_wib
  ),
  days as (
    select generate_series(
      (b.today_wib - (least(greatest(p_days,1),90) - 1)),
      b.today_wib,
      '1 day'
    )::date as day
    from bounds b
  ),
  sums as (
    select (e.created_at at time zone 'Asia/Jakarta')::date as day,
      count(*) filter (where e.type = 'visit')        as visit,
      count(*) filter (where e.type = 'product_view') as product_view,
      count(*) filter (where e.type = 'cart_add')     as cart_add,
      count(*) filter (where e.type = 'checkout')     as checkout,
      count(*) filter (where e.type = 'order')        as "order"
    from public.analytics_events e, bounds b
    where e.store_id = p_store and e.is_bot = false
      and (e.created_at at time zone 'Asia/Jakarta')::date
          >= b.today_wib - (least(greatest(p_days,1),90) - 1)
    group by 1
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'day', d.day::text,
      'visit', coalesce(s.visit, 0),
      'product_view', coalesce(s.product_view, 0),
      'cart_add', coalesce(s.cart_add, 0),
      'checkout', coalesce(s.checkout, 0),
      'order', coalesce(s."order", 0)
    ) order by d.day
  ), '[]'::jsonb)
  from days d
  left join sums s on s.day = d.day;
$$;

grant execute on function public.analytics_series(uuid, int) to authenticated;

-- ── total window ─────────────────────────────────────────────────────────────
create or replace function public.analytics_totals(p_store uuid, p_days int)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_object_agg(e.type, c),
    '{"visit":0,"product_view":0,"cart_add":0,"checkout":0,"order":0}'::jsonb
  )
  from (
    select e.type, count(*) as c
    from public.analytics_events e
    where e.store_id = p_store and e.is_bot = false
      and (e.created_at at time zone 'Asia/Jakarta')::date
          >= (now() at time zone 'Asia/Jakarta')::date - (least(greatest(p_days,1),90) - 1)
    group by e.type
  ) e;
$$;

grant execute on function public.analytics_totals(uuid, int) to authenticated;

-- ── top target (produk via product_view/cart_add, tautan via link_click) ────
create or replace function public.analytics_top(
  p_store uuid,
  p_metric text,
  p_days int,
  p_limit int default 5
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select ((current_date - (least(greatest(p_days,1),90) - 1))::timestamp
            at time zone 'Asia/Jakarta') as from_ts
  ),
  counted as (
    select e.target_id, count(*) cnt
    from public.analytics_events e, bounds b
    where e.store_id = p_store and e.is_bot = false and e.type = p_metric
      and e.target_id is not null and e.created_at >= b.from_ts
    group by e.target_id
    order by cnt desc
    limit least(greatest(p_limit,1), 20)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.target_id,
    'name', coalesce(p.name, l.label, '(terhapus)'),
    'count', c.cnt
  )), '[]'::jsonb)
  from counted c
  left join public.products p on p.id = c.target_id
  left join public.links l on l.id = c.target_id;
$$;

grant execute on function public.analytics_top(uuid, text, int, int) to authenticated;

-- ── rollup + retensi harian (dijadwalkan bila pg_cron tersedia) ──────────────
create or replace function public.rollup_analytics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- re-agregasi 4 hari terakhir (UTC-day kasar, cukup untuk rollup tampilan)
  insert into public.analytics_daily (store_id, day, metric, value)
  select e.store_id,
         (e.created_at at time zone 'Asia/Jakarta')::date,
         e.type,
         count(*)
  from public.analytics_events e
  where e.is_bot = false
    and (e.created_at at time zone 'Asia/Jakarta')::date >= current_date - 4
  group by 1, 2, 3
  on conflict (store_id, day, metric)
  do update set value = excluded.value;

  -- retensi raw: 90 hari (window terbesar paket Pro)
  delete from public.analytics_events
  where created_at < now() - interval '90 days';
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('dt-rollup-analytics', '20 17 * * *', 'select public.rollup_analytics()');
      -- 17:20 UTC = 00:20 WIB: rollup hari yang baru bergulir + retensi
    exception when others then
      raise notice 'cron dt-rollup-analytics tidak dapat dijadwalkan: %', sqlerrm;
    end;
  else
    raise notice 'pg_cron tidak terpasang — jalankan select public.rollup_analytics() berkala (opsional di MVP).';
  end if;
end
$$;

-- ── place_order v2: catat event 'order' otoritatif saat pesanan dibuat ──────
-- (idempotent terhadap definisi 0005; hanya menambah baris analytics + memakai
--  session_id dari pembeli untuk mengaitkan funnel visit → order)
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

  -- analitik: order dihitung SERVER-SIDE = angka konversi paling dipercaya
  insert into public.analytics_events (store_id, type, session_id, is_bot)
  values (v_store.id, 'order', p_session, false);

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
