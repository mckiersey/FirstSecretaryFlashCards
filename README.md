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
- Flip question to answer
- Edit the answer side
- Mark cards right or wrong
- Track total cards, right answers, wrong answers, and accuracy
- Filter all, missed, or unseen cards
- Save everything in browser local storage

## Run locally

Open `index.html` in a browser.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, create a new project from that repository.
3. Use the default static settings.
4. Deploy.

No build command is required.

## Database later

The current version stores data in each browser's local storage. For shared storage across browsers or devices, add Supabase and store these fields:

```sql
create table flashcards (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  right_count integer not null default 0,
  wrong_count integer not null default 0,
  last_reviewed timestamptz,
  created_at timestamptz not null default now()
);
```
