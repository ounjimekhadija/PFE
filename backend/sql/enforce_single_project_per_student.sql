-- Enforce: one student can belong to only one project at a time.
-- Safe to run multiple times.

begin;

-- 1) Prevent changing directly from one non-null project to another.
create or replace function public.prevent_student_project_reassignment()
returns trigger
language plpgsql
as $$
begin
  if old.projet_id is not null
     and new.projet_id is not null
     and old.projet_id is distinct from new.projet_id then
    raise exception 'Un étudiant ne peut appartenir qu''à un seul projet à la fois (student_id=%).', old.id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_student_project_reassignment on public.etudiants;

create trigger trg_prevent_student_project_reassignment
before update of projet_id on public.etudiants
for each row
execute function public.prevent_student_project_reassignment();

-- 2) Optional helper index for common filters.
create index if not exists idx_etudiants_projet_id
  on public.etudiants(projet_id);

commit;

-- Verification query:
-- select id, projet_id from public.etudiants where projet_id is not null order by id;
