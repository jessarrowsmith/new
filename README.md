# 🥗 Meal Planner & Food Logger

Plan meals, build reusable day templates and weeks, log what you eat, and generate a shopping list.
Built with Next.js 14 (App Router), Supabase, Tailwind CSS and the Anthropic API (Claude Haiku).

## Features

- **Foods** – add by hand or snap a nutrition label (Claude reads it; you confirm before saving)
- **Meals** – build from your foods with live macro totals, or import a recipe from a link or pasted text
- **Day Templates** – breakfast / lunch / dinner / snacks, with daily totals
- **Planner** – a day template for each weekday; save and load named weeks
- **Daily Log** – calendar, start from a template, log as you eat, progress bars against your targets
- **Shopping List** – generated from the week plan, duplicates combined, sorted by aisle, tick-off, copy/share

## Setup

### 1. Supabase (free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it (safe to re-run).
3. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
```

`ANTHROPIC_API_KEY` is only used on the server (label reading, recipe import, shopping list categories).
Optionally set `ANTHROPIC_MODEL` to override the default Haiku model.

### 3. Run locally

```bash
npm install
npm run dev
```

### 4. Deploy to Vercel

1. Push this repo to GitHub and import it in [Vercel](https://vercel.com).
2. Add the three environment variables above in **Project Settings → Environment Variables**.
3. Deploy. Every push to GitHub redeploys automatically.

## Good to know

- **No login.** The database policies let anyone with your Supabase URL and anon key read and write.
  That is fine for personal use; add Supabase Auth before sharing the app with other people.
- **Recipe links.** TikTok, Instagram and some other sites block automated fetching. Pasting the
  recipe text or caption always works.
- **Nutrition from imports is an estimate.** Check the numbers on the review screen.
