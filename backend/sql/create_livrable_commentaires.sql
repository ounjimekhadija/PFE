-- Mirror of tache_commentaires, applied to livrables
create table if not exists livrable_commentaires (
  id          uuid         primary key default gen_random_uuid(),
  livrable_id uuid         not null references livrables(id) on delete cascade,
  auteur_id   uuid         not null references utilisateurs(id) on delete cascade,
  contenu     text         not null,
  created_at  timestamptz  not null default now()
);

create index if not exists idx_livrable_commentaires_livrable
  on livrable_commentaires(livrable_id);

alter table livrable_commentaires enable row level security;

create policy "read livrable comments"
  on livrable_commentaires for select
  to authenticated
  using (true);

create policy "insert livrable comments"
  on livrable_commentaires for insert
  to authenticated
  with check (auteur_id = auth.uid());
