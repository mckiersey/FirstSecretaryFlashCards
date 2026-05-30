# Flash Cards

A tiny flash-card web app for importing question/answer pairs from Excel or CSV files.

## File format

Use an `.xlsx`, `.xls`, or `.csv` file with columns named:

```text
Question | Answer
```

If those column names are not present, the app uses the first two columns.

## Features

- Import cards from Excel or CSV
- Ignore blank rows in imported spreadsheets
- Switch between Deck A and Deck B
- Store Deck A and Deck B in separate Supabase tables
- Flip question to answer
- Edit the answer side
- Delete the current card
- Show right/wrong buttons only after the answer is revealed
- Track total cards, right answers, wrong answers, and accuracy
- Filter all, missed, or unseen cards
- Show columns C and D as additional info on the answer side
- Preserve additional imported columns in Supabase and Excel exports
- Export the current deck back to Excel
- Save in browser local storage
- Optional Supabase cloud database for syncing across browsers/devices

## Run locally

Open `index.html` in a browser.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, create a new project from that repository.
3. Use the default static settings.
4. Deploy.

No build command is required.

## Supabase database

Create a Supabase project, open the SQL editor, and run:

```sql
create table if not exists public.flashcards (
  id uuid primary key,
  question text not null,
  answer text not null,
  right_count integer not null default 0,
  wrong_count integer not null default 0,
  last_reviewed timestamptz,
  created_at timestamptz not null default now(),
  extra_data jsonb not null default '{}'::jsonb
);

create table if not exists public.flashcards_deck_b
(like public.flashcards including all);

alter table public.flashcards enable row level security;
alter table public.flashcards_deck_b enable row level security;

drop policy if exists "Allow public deck A reads" on public.flashcards;
create policy "Allow public deck A reads"
on public.flashcards for select
to anon
using (true);

drop policy if exists "Allow public deck A inserts" on public.flashcards;
create policy "Allow public deck A inserts"
on public.flashcards for insert
to anon
with check (true);

drop policy if exists "Allow public deck A updates" on public.flashcards;
create policy "Allow public deck A updates"
on public.flashcards for update
to anon
using (true)
with check (true);

drop policy if exists "Allow public deck A deletes" on public.flashcards;
create policy "Allow public deck A deletes"
on public.flashcards for delete
to anon
using (true);

drop policy if exists "Allow public deck B reads" on public.flashcards_deck_b;
create policy "Allow public deck B reads"
on public.flashcards_deck_b for select
to anon
using (true);

drop policy if exists "Allow public deck B inserts" on public.flashcards_deck_b;
create policy "Allow public deck B inserts"
on public.flashcards_deck_b for insert
to anon
with check (true);

drop policy if exists "Allow public deck B updates" on public.flashcards_deck_b;
create policy "Allow public deck B updates"
on public.flashcards_deck_b for update
to anon
using (true)
with check (true);

drop policy if exists "Allow public deck B deletes" on public.flashcards_deck_b;
create policy "Allow public deck B deletes"
on public.flashcards_deck_b for delete
to anon
using (true);
```

If you already created the original `flashcards` table before extra Excel columns were supported, run this once:

```sql
alter table public.flashcards
add column if not exists extra_data jsonb not null default '{}'::jsonb;
```

The app has the Supabase project URL and publishable key embedded in `app.js`, so browsers connect automatically. Do not embed a service-role key, database password, JWT secret, or any other private key.

This simple setup is meant for a personal flash-card app. Anyone with the deployed app URL and anon key could read/write the table, so do not put sensitive material in it.
