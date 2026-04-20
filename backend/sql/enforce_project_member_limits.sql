-- Enforce: each project can have a maximum of 3 students.
-- Safe to run multiple times.

begin;

create or replace function public.check_project_student_limit()
returns trigger
language plpgsql
as $$
declare
  student_count integer;
  max_students_per_project integer := 3;
begin
  -- This trigger fires when a student's projet_id is set or changed.
  -- We only need to check the new project.
  if new.projet_id is not null then
    -- Lock the project row to prevent race conditions where two students join simultaneously.
    perform * from public.projets where id = new.projet_id for update;

    select count(*)
    into student_count
    from public.etudiants
    where projet_id = new.projet_id;

    if student_count >= max_students_per_project then
      raise exception 'Le projet (id=%) a déjà atteint le nombre maximum de % étudiants.', new.projet_id, max_students_per_project
        using errcode = '23514'; -- Using a standard check violation error code.
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_project_student_limit_on_insert on public.etudiants;
create trigger trg_check_project_student_limit_on_insert
before insert on public.etudiants
for each row
execute function public.check_project_student_limit();

drop trigger if exists trg_check_project_student_limit_on_update on public.etudiants;
create trigger trg_check_project_student_limit_on_update
before update of projet_id on public.etudiants
for each row
when (old.projet_id is distinct from new.projet_id)
execute function public.check_project_student_limit();

commit;

-- Verification query:
-- select projet_id, count(id) as student_count
-- from public.etudiants
-- where projet_id is not null
-- group by projet_id
-- order by student_count desc;
