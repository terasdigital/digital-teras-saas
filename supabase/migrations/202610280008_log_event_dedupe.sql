-- Digital Teras — 0008: log_event dengan dedupe window (fix double-count)
-- Dev StrictMode me-mount effect 2x → visit/product_view tercatat dobel.
-- Otoritas anti-dobel di server: event 'visit'/'product_view' dengan
-- session + target identik dalam 30 detik terakhir diabaikan.
-- (Klik nyata berulang — link_click/cart_add/checkout — TIDAK di-dedupe:
--  itu perilaku user sungguhan.)

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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
begin
  select id into v_store from public.stores
   where slug = p_slug and published = true;
  if v_store is null then
    return;
  end if;

  if p_type in ('visit', 'product_view') then
    if exists (
      select 1 from public.analytics_events x
      where x.store_id = v_store
        and x.type = p_type
        and x.created_at > now() - interval '30 seconds'
        and ((x.session_id = p_session) or (x.session_id is null and p_session is null))
        and ((x.target_id = p_target) or (x.target_id is null and p_target is null))
    ) then
      return;
    end if;
  end if;

  insert into public.analytics_events
    (store_id, type, session_id, target_id, path, referrer, is_bot)
  values
    (v_store, p_type, p_session, p_target,
     left(p_path, 300), left(p_referrer, 300), p_is_bot);
end;
$$;
