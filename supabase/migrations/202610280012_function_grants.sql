-- Digital Teras — 0012: pengetatan grant fungsi + guard kepemilikan (M8 security)
--
-- Masalah yang ditutup:
-- 1) Postgres memberi EXECUTE ke PUBLIC secara default saat fungsi dibuat →
--    REVOKE FROM anon saja (0011) tidak cukup; anon tetap bisa memanggil
--    effective_plan dkk.
-- 2) analytics_series/totals/top, can_create, store_usage menerima p_store
--    tanpa cek kepemilikan → seller lain bisa membaca analitik toko orang.
--
-- Semua pernyataan idempotent (aman dijalankan ulang).

-- ── 1) cabut EXECUTE dari PUBLIC untuk SEMUA fungsi skema public ────────────
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %s from public', f.sig);
  end loop;
end
$$;

-- ── 2) grant eksplisit sesuai peran ─────────────────────────────────────────
-- Publik (pembeli tanpa akun):
grant execute on function public.log_event(text, text, uuid, uuid, text, text, boolean) to anon, authenticated, service_role;
grant execute on function public.place_order(text, jsonb, jsonb, uuid) to anon, authenticated, service_role;
grant execute on function public.set_order_message(uuid, text) to anon, authenticated, service_role;

-- Seller (authenticated):
grant execute on function public.create_store(text, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.is_store_slug_available(text) to authenticated, service_role;
grant execute on function public.upsert_product(uuid, text, text, text, boolean, jsonb) to authenticated, service_role;
grant execute on function public.can_create(uuid, text) to authenticated, service_role;
grant execute on function public.effective_plan(uuid) to authenticated, service_role;
grant execute on function public.store_usage(uuid) to authenticated, service_role;
grant execute on function public.analytics_series(uuid, int) to authenticated, service_role;
grant execute on function public.analytics_totals(uuid, int) to authenticated, service_role;
grant execute on function public.analytics_top(uuid, text, int, int) to authenticated, service_role;

-- Khusus service_role (webhook & cron):
grant execute on function public.webhook_claim(text, text, text, jsonb) to service_role;
grant execute on function public.webhook_finish(bigint, text, text) to service_role;
grant execute on function public.mark_billing_paid(text, text, jsonb) to service_role;
grant execute on function public.mark_billing_failed(text, text, jsonb) to service_role;
grant execute on function public.expire_check_subscriptions() to service_role;
grant execute on function public.rollup_analytics() to service_role;

-- ── 3) guard kepemilikan: can_create & store_usage (plpgsql, raise 42501) ───
create or replace function public.can_create(p_store uuid, p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l jsonb;
  used bigint;
  lim int;
begin
  if not exists (select 1 from public.stores s where s.id = p_store and s.owner_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select p.limits into l from public.plans p where p.code = public.effective_plan(p_store);

  used := case p_kind
    when 'product' then (select count(*) from public.products where store_id = p_store)
    when 'link'    then (select count(*) from public.links    where store_id = p_store)
    else 0
  end;

  lim := (l ->> ('max_' || p_kind))::int;

  return jsonb_build_object(
    'can', (lim is null or used < lim),
    'used', used,
    'limit', lim,
    'plan', public.effective_plan(p_store)
  );
end;
$$;

create or replace function public.store_usage(p_store uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan text;
  v_limits jsonb;
begin
  if not exists (select 1 from public.stores s where s.id = p_store and s.owner_id = auth.uid()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_plan := public.effective_plan(p_store);
  select p.limits into v_limits from public.plans p where p.code = v_plan;

  return jsonb_build_object(
    'products', (select count(*) from public.products where store_id = p_store),
    'links',    (select count(*) from public.links    where store_id = p_store),
    'plan',     v_plan,
    'limits',   v_limits
  );
end;
$$;

-- ── 4) guard kepemilikan analitik (SQL fn + filter exists; hasil kosong ─────
--      bila bukan pemilik → tidak bocor, tidak perlu raise)
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
      and exists (select 1 from public.stores s where s.id = p_store and s.owner_id = auth.uid())
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
      and exists (select 1 from public.stores s where s.id = p_store and s.owner_id = auth.uid())
      and (e.created_at at time zone 'Asia/Jakarta')::date
          >= (now() at time zone 'Asia/Jakarta')::date - (least(greatest(p_days,1),90) - 1)
    group by e.type
  ) e;
$$;

create or replace function public.analytics_top(p_store uuid, p_metric text, p_days int, p_limit int default 5)
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
      and exists (select 1 from public.stores s where s.id = p_store and s.owner_id = auth.uid())
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

-- grant ulang pasca create-or-replace (replace mempertahankan grant, tapi
-- kita pastikan eksplisit):
grant execute on function public.can_create(uuid, text) to authenticated, service_role;
grant execute on function public.store_usage(uuid) to authenticated, service_role;
grant execute on function public.analytics_series(uuid, int) to authenticated, service_role;
grant execute on function public.analytics_totals(uuid, int) to authenticated, service_role;
grant execute on function public.analytics_top(uuid, text, int, int) to authenticated, service_role;
