-- Digital Teras — 0013: matriks grant definitif + guard role di fungsi billing
--
-- Kenapa: default privileges Supabase memberi EXECUTE ke anon+authenticated
-- pada SETIAP fungsi baru; revoke-from-public (0012) tidak mencabutnya.
-- Terbukti via probe: mark_billing_paid bisa dipanggil token seller.
--
-- Strategi: cabut SEMUA dari public/anon/authenticated untuk seluruh fungsi
-- skema public, lalu grant ulang eksplisit per matriks peran. Fungsi billing
-- berbahaya juga diberi guard role service_role di body-nya (lapis kedua).

-- ── 1) cabut total, lalu grant sesuai matriks ───────────────────────────────
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
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end
$$;

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

-- Khusus service_role (webhook, cron, rekonsiliasi):
grant execute on function public.webhook_claim(text, text, text, jsonb) to service_role;
grant execute on function public.webhook_finish(bigint, text, text) to service_role;
grant execute on function public.mark_billing_paid(text, text, jsonb) to service_role;
grant execute on function public.mark_billing_failed(text, text, jsonb) to service_role;
grant execute on function public.expire_check_subscriptions() to service_role;
grant execute on function public.rollup_analytics() to service_role;

-- ── 2) lapis kedua: guard role di body fungsi billing ───────────────────────
create or replace function public.mark_billing_paid(
  p_order_id text, p_payment_method text, p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay   public.billing_payments;
  v_start timestamptz;
  v_end   timestamptz;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_pay from public.billing_payments where order_id = p_order_id;
  if not found then
    return jsonb_build_object('ok', false, 'foreign', true);
  end if;

  if v_pay.status = 'paid' then
    return jsonb_build_object('ok', true, 'already', true, 'payment_id', v_pay.id);
  end if;

  update public.billing_payments
     set status = 'paid', payment_method = p_payment_method,
         provider_payload = p_payload, paid_at = now()
   where id = v_pay.id;

  select s.id, s.current_period_end
    into v_pay.subscription_id, v_start
  from public.subscriptions s where s.store_id = v_pay.store_id;

  if v_start is null or v_start < now() then v_start := now(); end if;
  v_end := v_start + make_interval(months => v_pay.period_months);

  update public.subscriptions
     set plan_code = v_pay.plan_code,
         status = 'active',
         current_period_start = v_start,
         current_period_end = v_end,
         provider = 'midtrans',
         provider_order_id = p_order_id,
         payment_method = p_payment_method
   where store_id = v_pay.store_id;

  if not found then
    insert into public.subscriptions
      (store_id, plan_code, status, current_period_start, current_period_end,
       provider, provider_order_id, payment_method)
    values
      (v_pay.store_id, v_pay.plan_code, 'active', v_start, v_end,
       'midtrans', p_order_id, p_payment_method)
    on conflict (store_id) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true, 'payment_id', v_pay.id, 'store_id', v_pay.store_id,
    'plan', v_pay.plan_code, 'extended_to', to_char(v_end, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
end;
$$;

create or replace function public.mark_billing_failed(p_order_id text, p_new_status text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.billing_payments;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_new_status not in ('failed','expired','refunded') then
    raise exception 'status gagal tidak dikenal: %', p_new_status;
  end if;

  select * into v_pay from public.billing_payments where order_id = p_order_id;
  if not found then
    return jsonb_build_object('ok', false, 'foreign', true);
  end if;

  if p_new_status = 'refunded' then
    update public.billing_payments
       set status = 'refunded', provider_payload = p_payload
     where id = v_pay.id;
    update public.subscriptions
       set status = 'canceled'
     where store_id = v_pay.store_id;
    return jsonb_build_object('ok', true, 'canceled_subscription', true);
  end if;

  if v_pay.status = 'pending' then
    update public.billing_payments
       set status = p_new_status, provider_payload = p_payload
     where id = v_pay.id;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.webhook_claim(
  p_provider text, p_external_id text, p_event_type text, p_payload jsonb
)
returns table (claimed boolean, event_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.webhook_events (provider, external_id, event_type, payload)
  values (p_provider, p_external_id, p_event_type, p_payload)
  returning id into v_id;
  return query select true, v_id;
exception
  when unique_violation then
    return query select false, null::bigint;
end;
$$;

create or replace function public.webhook_finish(p_event_id bigint, p_status text, p_error text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.webhook_events
     set status = p_status, error = p_error, processed_at = now()
   where id = p_event_id;
end;
$$;

-- create-or-replace mempertahankan grant, tapi pastikan eksplisit:
grant execute on function public.mark_billing_paid(text, text, jsonb) to service_role;
grant execute on function public.mark_billing_failed(text, text, jsonb) to service_role;
grant execute on function public.webhook_claim(text, text, text, jsonb) to service_role;
grant execute on function public.webhook_finish(bigint, text, text) to service_role;
