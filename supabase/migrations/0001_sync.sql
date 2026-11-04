-- Reading Desk sync tables. Each mirrors one table of the local store.
-- Records are stored whole as JSON in `data` (doc blocks included). `updated_at` is the client
-- time (ms) of the change and decides which write wins; `server_at` is the server's clock and is
-- what devices use to ask "what changed since I last pulled?". Deletes are soft (`deleted = true`).

create or replace function public.rd_sync_guard() returns trigger
language plpgsql as $$
begin
  -- Last write wins: ignore an update that is older than what the server already has.
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  new.server_at := clock_timestamp();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['trees', 'nodes', 'docs', 'topics', 'highlights'] loop
    execute format($f$
      create table if not exists public.%1$I (
        user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
        id         text        not null,
        data       jsonb,
        updated_at bigint      not null,
        deleted    boolean     not null default false,
        server_at  timestamptz not null default clock_timestamp(),
        primary key (user_id, id)
      );
      create index if not exists %1$s_pull_idx on public.%1$I (user_id, server_at);

      alter table public.%1$I enable row level security;

      drop policy if exists "own rows: read"   on public.%1$I;
      drop policy if exists "own rows: insert" on public.%1$I;
      drop policy if exists "own rows: update" on public.%1$I;
      drop policy if exists "own rows: delete" on public.%1$I;
      create policy "own rows: read"   on public.%1$I for select using (user_id = auth.uid());
      create policy "own rows: insert" on public.%1$I for insert with check (user_id = auth.uid());
      create policy "own rows: update" on public.%1$I for update using (user_id = auth.uid()) with check (user_id = auth.uid());
      create policy "own rows: delete" on public.%1$I for delete using (user_id = auth.uid());

      drop trigger if exists %1$s_sync_guard on public.%1$I;
      create trigger %1$s_sync_guard before insert or update on public.%1$I
        for each row execute function public.rd_sync_guard();
    $f$, t);
  end loop;
end;
$$;
