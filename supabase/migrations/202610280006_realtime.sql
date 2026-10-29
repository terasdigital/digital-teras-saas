-- Digital Teras — 0006: realtime untuk orders (status live di dashboard seller)
-- Supabase Realtime memakai publication 'supabase_realtime'. Tambahkan orders
-- agar event INSERT/UPDATE/DELETE tersiar ke subscriber (RLS tetap berlaku:
-- hanya pemilik toko yang menerima baris miliknya).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;
