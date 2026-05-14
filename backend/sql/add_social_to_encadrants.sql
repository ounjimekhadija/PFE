-- Add social profile columns to encadrants table
alter table public.encadrants
  add column if not exists portfolio_url text,
  add column if not exists github_url text,
  add column if not exists linkedin_url text;
