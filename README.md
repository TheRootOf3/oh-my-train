# Oh My Train 🚆

**The communal British rail disappointment diary.**

A shared monthly calendar of train journeys: **● on time**, **▲ delayed** (and
by how many minutes of collective life), or **✕ cancelled** outright. Anyone
can log a journey — no account needed. Sign in with GitHub and your entries are
attributed to you, with a one-click toggle between everyone's misery and just
your own.

Bright, simple, and accented in railway red — the colour of both the brand and
the "Cancelled" row on the departure board.

## Stack

| Thing | Choice | Why |
|---|---|---|
| Framework | [Next.js 15](https://nextjs.org) (App Router) | Free hosting on Vercel's hobby tier |
| Database | [Neon](https://neon.tech) Postgres | Generous free tier, serverless driver |
| ORM | [Drizzle](https://orm.drizzle.team) | Lightweight, pairs well with Neon |
| Auth | [Auth.js / NextAuth v5](https://authjs.dev) + GitHub OAuth | JWT sessions — no auth tables needed |

Signed-in journeys are keyed by your stable GitHub numeric user ID; anonymous
journeys are stored with no ID at all. No passwords, no personal data beyond
that ID — we only track trains, and even that is mostly disappointment.

## Features

- Monthly calendar (Monday-first, as is right and proper) — click any day to log journeys
- **Anyone can log** — anonymous entries go straight to the shared database and, like words shouted at a departure board, can never be taken back
- Structured entries: departure time, origin and destination — all optional, because logging should take two clicks. The one exception: **a delayed train must confess its minutes**
- Dark mode 🌙 — follows your OS, with a toggle for the contrarians
- `?day=YYYY-MM-DD` deep-links straight to a day's log — shareable misery
- Signed-in users get an **"Everyone's misery / Just mine"** toggle for both the calendar and the stats, and can delete their own entries
- Monthly stats: journey count, on-time percentage, minutes of life lost to delays, and a running tally of ghost trains
- Multiple journeys per day, because commuting is a round trip through sorrow
- One-click **import of data from the old static-site era** (localStorage), plus JSON export/import in the same format (signed-in only)
- 12 rotating apologies (click the tagline for the next one)
- A light per-IP rate limit on logging, because the internet is the internet

## Local development

```sh
npm install
cp .env.example .env.local   # then fill it in — see below
npm run db:push              # creates the journeys table in Neon
npm run dev
```

## Setup (all free)

### 1. Neon

1. Create a project at [console.neon.tech](https://console.neon.tech).
2. Copy the **pooled** connection string (host contains `-pooler`) into
   `DATABASE_URL`.
3. Run `npm run db:push` once to create the schema.

### 2. GitHub OAuth app

1. [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**.
2. Homepage URL: `http://localhost:3000` (dev) or your Vercel URL (prod).
3. Authorization callback URL:
   - dev: `http://localhost:3000/api/auth/callback/github`
   - prod: `https://<your-app>.vercel.app/api/auth/callback/github`
4. Put the client ID and secret into `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.

(Best practice: one OAuth app for dev, a second one for prod.)

### 3. Secrets

```sh
openssl rand -base64 32   # → AUTH_SECRET
```

### 4. Vercel

1. Push this repo to GitHub.
2. [vercel.com/new](https://vercel.com/new) → import the repo. Next.js is auto-detected.
3. Add the four environment variables (`DATABASE_URL`, `AUTH_SECRET`,
   `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`) in the project settings.
4. Deploy. The site will be live before your next train is.

> Tip: the Vercel ↔ Neon [native integration](https://vercel.com/integrations/neon)
> can provision the database and set `DATABASE_URL` for you.

## API

| Route | Auth | What |
|---|---|---|
| `GET /api/journeys?month=YYYY-MM&scope=all\|mine` | none (`mine` needs a session) | the communal catalogue of sorrow |
| `POST /api/journeys` | none (rate-limited) | log one more disappointment |
| `DELETE /api/journeys?id=N` | session, own rows only | the only cancellation we actively encourage |
| `GET /api/journeys/export` | session | all your own data, as JSON |
| `POST /api/journeys/import` | session | bulk import (old static-site export shape) |

## The static-site era

The original zero-dependency version (localStorage, no server) lives on in
[`legacy-static/`](legacy-static/) — still deployable to GitHub Pages, still
proudly unaffiliated with punctuality.

## Disclaimer

Not affiliated with National Rail, any train operating company, or the concept
of punctuality.
