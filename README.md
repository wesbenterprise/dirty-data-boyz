# Dirty Data Boyz 🕶️

The Down & Dirty on Your Data — powered by Claude AI.

Upload a spreadsheet (.xlsx, .csv) or PDF and get instant analysis broken into:
- **The Good** — positive takeaways
- **The Bad** — potential pitfalls  
- **The Dirty** — sneaky issues that need a closer look

## Setup

### 1. Supabase

Run the `supabase-schema.sql` file in your Supabase SQL Editor to create the `analyses` table.

### 2. Environment Variables (Vercel)

Add these in Vercel → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Claude API key |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zrrqxykatjenipcanaay.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

### 3. Deploy

Connect GitHub repo to Vercel and deploy!

### Local Dev

```bash
npm install
cp .env.example .env.local  # fill in your API key
npm run dev
```

## Tech Stack

- Next.js 14 (App Router)
- Claude API (Sonnet 4)
- Supabase (Postgres)
- SheetJS + Papaparse (file parsing)
- 90s Trapper Keeper aesthetic 📼

## Architecture

- `/app/page.js` — Main UI with all the 90s styling
- `/app/api/analyze/route.js` — Server-side Claude API calls (keeps API key secure)
- `/lib/supabase.js` — Supabase client

---

**DIRTY DATA BOYZ™ • BARNETT FAMILY PARTNERS**
