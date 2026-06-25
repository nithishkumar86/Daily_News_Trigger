create table if not exists news_articles (
  id          uuid primary key default gen_random_uuid(),
  rank        integer not null,
  title       text    not null,
  summary     text    not null,
  link        text    not null,
  created_at  timestamptz default now()
);
