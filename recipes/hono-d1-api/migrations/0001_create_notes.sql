create table if not exists notes (
  id text primary key,
  body text not null,
  created_at text not null default current_timestamp
);
