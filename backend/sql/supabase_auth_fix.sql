-- Run this in Supabase SQL Editor.
-- Purpose: keep public.utilisateurs synced with auth.users and make login diagnosis easier.

-- 1) Auto-create a profile row whenever a new auth user is created.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.utilisateurs (id, nom, prenom, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', 'User'),
    coalesce(new.raw_user_meta_data->>'prenom', 'User'),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::role_utilisateur, 'ETUDIANT'::role_utilisateur)
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- 2) Optional sanity checks
-- select id, email from auth.users where email = 'student@gmail.com';
-- select id, email, role from public.utilisateurs where email = 'student@gmail.com';
