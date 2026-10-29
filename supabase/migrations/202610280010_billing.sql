-- Digital Teras — 0010: billing (Midtrans prepaid self-managed) (Milestone 7)
-- Langganan dikelola sendiri di DB; Midtrans hanya untuk settlement satu-kali.
-- Logika uang (activate/extend/refund) atomik di RPC SECURITY DEFINER supaya
-- webhook bisa di-replay dengan aman & period tak pernah dobel-panjang.

-- ── billing_payments: setiap usaha upgrade/perpanjangan ─────────────────────
create table public.billing_payments (
  id               uuid primary key default gen_random_uuid(),
  store_id         uuid not null references public.stores (id) on delete cascade,
  subscription_id  uuid references public.subscriptions (id) on delete set null,
  plan_code        text not null references public.plans (code),
  period_months    int not null default 1 check (period_months between 1 and 24),
  gross_amount_idr bigint not null check (gross_amount_idr >= 0),
  order_id         text not null unique,           -- order_id yang kita kirim ke Midtrans
  status           text not null default 'pending'
                   constraint bp_status_check
                   check (status in ('pending','paid','failed','expired','refunded')),
  payment_method   text,
  provider_payload jsonb,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index bp_store_idx on public.billing_payments (store_id, created_at desc);

alter table public.billing_payments enable row level security;
-- pemilik boleh membaca tagihannya sendiri; tulis hanya service-role (bypass RLS)
create policy "bp_select_owner" on public.billing_payments
  for select using (store_id in (select id from public.stores where owner_id = auth.uid()));

create trigger bp_updated_at before update on public.billing_payments
  for each row execute function public.set_updated_at();

-- ── webhook_events: buku besar idempoten (lintas provider) ──────────────────
create table public.webhook_events (
  id           bigint generated always as identity primary key,
  provider     text not null,
  external_id  text not null,
  event_type   text not null,
  payload      jsonb not null,
  status       text not null default 'received'
               constraint we_status_check check (status in ('received','processed','skipped','failed')),
  error        text,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, external_id)
);

alter table public.webhook_events enable row level security;
-- tanpa policy → hanya service-role (bypass) yang bisa baca/tulis.

-- ── klaim event: insert ON CONFLICT ⇒ hentikan replay dalam satu call ───────
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
language sql
security definer
set search_path = public
as $$
  update public.webhook_events
     set status = p_status, error = p_error, processed_at = now()
   where id = p_event_id;
$$;

-- ── aktifkan/perpanjang langganan saat settlement (atomik + idempoten) ──────
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

  -- perpanjang dari akhir periode berjalan (kalau masih aktif) atau dari sekarang
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
    -- baris subscription harusnya selalu ada (create_store); jaring pengaman
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

-- ── gagal/expired/refund ────────────────────────────────────────────────────
create or replace function public.mark_billing_failed(p_order_id text, p_new_status text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay public.billing_payments;
begin
  if p_new_status not in ('failed','expired','refunded') then
    raise exception 'status gagal tidak dikenal: %', p_new_status;
  end if;

  select * into v_pay from public.billing_payments where order_id = p_order_id;
  if not found then
    return jsonb_build_object('ok', false, 'foreign', true);
  end if;

  -- refund/chargeback setelah paid → batalkan langganan (fallback free otomatis)
  if p_new_status = 'refunded' then
    update public.billing_payments
       set status = 'refunded', provider_payload = p_payload
     where id = v_pay.id;
    update public.subscriptions
       set status = 'canceled'
     where store_id = v_pay.store_id;
    return jsonb_build_object('ok', true, 'canceled_subscription', true);
  end if;

  -- expire/cancel sebelum terbayar → mark pembayaran; langganan tak tersentuh
  if v_pay.status = 'pending' then
    update public.billing_payments
       set status = p_new_status, provider_payload = p_payload
     where id = v_pay.id;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── normalisasi jatuh tempo (pelengkap effective_plan; dijadwalkan via cron) ─
create or replace function public.expire_check_subscriptions()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  update public.subscriptions
     set status = case
           when current_period_end + make_interval(days => grace_days) < now()
             then 'expired' else 'past_due' end
   where status in ('active','trialing')
     and current_period_end is not null
     and current_period_end < now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ── pemakaian toko: produk + tautan (untuk meter dashboard) ──────────────────
create or replace function public.store_usage(p_store uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'products', (select count(*) from public.products where store_id = p_store),
    'links',    (select count(*) from public.links    where store_id = p_store),
    'plan',     public.effective_plan(p_store),
    'limits',   (select p.limits from public.plans p where p.code = public.effective_plan(p_store))
  );
$$;

grant execute on function public.webhook_claim(text, text, text, jsonb) to service_role;
grant execute on function public.webhook_finish(bigint, text, text) to service_role;
grant execute on function public.mark_billing_paid(text, text, jsonb) to service_role;
grant execute on function public.mark_billing_failed(text, text, jsonb) to service_role;
grant execute on function public.expire_check_subscriptions() to service_role;
grant execute on function public.store_usage(uuid) to authenticated;

-- jadwalkan normalisasi jatuh tempo bila pg_cron tersedia (opsional;
-- effective_plan tetap otoritatif tanpa cron)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('dt-expire-subscriptions', '5 3 * * *', 'select public.expire_check_subscriptions()');
    exception when others then
      raise notice 'cron dt-expire-subscriptions tidak dijadwalkan: %', sqlerrm;
    end;
  end if;
end
$$;
