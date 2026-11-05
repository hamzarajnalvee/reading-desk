-- Pin the sync trigger's search_path so it can't be redirected by objects in another schema
-- (Supabase's security advisor flags functions without one). The body only uses built-ins.
-- Missed late commits are handled by the client re-reading a short window before its cursor
-- (see `pullSince` in src/lib/syncMerge.ts).

create or replace function public.rd_sync_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Last write wins: ignore an update that is older than what the server already has.
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;
