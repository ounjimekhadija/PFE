-- Link encadrants to authenticated users for professor-scoped queries.
-- This migration is safe to run multiple times.

begin;

-- 1) Add a stable mapping column from encadrants to utilisateurs/auth users.
alter table public.encadrants
  add column if not exists utilisateur_id uuid;

-- 2) Optional bootstrap: if encadrants.id already matches a valid utilisateur id,
--    copy it into utilisateur_id only where utilisateur_id is still null.
update public.encadrants e
set utilisateur_id = e.id
where e.utilisateur_id is null
  and exists (
    select 1
    from public.utilisateurs u
    where u.id = e.id
  );

-- 3) Add referential integrity to public.utilisateurs(id).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'encadrants_utilisateur_id_fkey'
  ) then
    alter table public.encadrants
      add constraint encadrants_utilisateur_id_fkey
      foreign key (utilisateur_id)
      references public.utilisateurs(id)
      on delete set null;
  end if;
end $$;

-- 4) Add indexes for lookup speed.
create index if not exists idx_encadrants_utilisateur_id
  on public.encadrants(utilisateur_id);

create index if not exists idx_projets_encadrant_id
  on public.projets(encadrant_id);

create index if not exists idx_messages_projet_created_at
  on public.messages(projet_id, created_at desc);

commit;

-- 5) Verification queries (run manually after migration):
-- A) Check encadrants without mapping
-- select id, utilisateur_id from public.encadrants where utilisateur_id is null;

-- B) Check projects whose encadrant has no mapping
-- select p.id as projet_id, p.encadrant_id
-- from public.projets p
-- left join public.encadrants e on e.id = p.encadrant_id
-- where p.encadrant_id is not null and e.utilisateur_id is null;

-- C) Check what projects are visible for current auth user id (:uid)
-- select p.id, p.titre
-- from public.projets p
-- left join public.encadrants e on e.id = p.encadrant_id
-- where p.encadrant_id = :uid or e.utilisateur_id = :uid;
