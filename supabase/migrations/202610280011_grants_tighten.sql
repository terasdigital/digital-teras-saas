-- Digital Teras — 0011: pengetatan grant (M8 security polish)
-- effective_plan tidak perlu dipanggil anonim (kebocoran info paket per toko);
-- pemakaian di dashboard/action adalah authenticated. log_event & place_order
-- tetap anon (pembeli publik).

revoke execute on function public.effective_plan(uuid) from anon;
grant execute on function public.effective_plan(uuid) to authenticated, service_role;
