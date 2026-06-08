alter table private.rate_limit_events
add column if not exists id bigserial;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'private.rate_limit_events'::regclass
      and contype = 'p'
  ) then
    alter table private.rate_limit_events
    add constraint rate_limit_events_pkey primary key (id);
  end if;
end $$;

create index if not exists feature_flags_updated_by_idx
on public.feature_flags (updated_by);

create index if not exists monitoring_events_user_id_idx
on public.monitoring_events (user_id);

create index if not exists admin_import_jobs_actor_user_id_idx
on public.admin_import_jobs (actor_user_id);

drop policy if exists "owners manage feature flags" on public.feature_flags;

create policy "owners insert feature flags"
on public.feature_flags
for insert
with check (
  private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])
);

create policy "owners update feature flags"
on public.feature_flags
for update
using (
  private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])
)
with check (
  private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])
);

create policy "owners delete feature flags"
on public.feature_flags
for delete
using (
  private.has_any_role((select auth.uid()), array['owner'::public.app_role, 'admin'::public.app_role])
);
