# Oh My Train

Communal diary of British rail disappointment. Anyone can log a journey
(anonymous → straight to the shared DB); GitHub sign-in adds "just mine"
filtering, deletion of own entries, and export. The puns are product —
keep the voice dry, apologetic, and railway-flavoured. en-GB throughout.

## Commands

- `npm run dev` / `npm run build` / `npm start`
- `npm run lint && npm run typecheck && npm test` — run before every push
- `npm run db:push` — drizzle-kit, reads `.env.local` (or inline `DATABASE_URL`)

## Workflow (non-negotiable)

- **Never push to `main`.** Branch → PR → CI green → merge. `main` is
  branch-protected and auto-deploys via Vercel.
- **Schema changes**: `db:push` to the production DB *before* merging code,
  and keep changes additive (nullable columns, new indexes only).
- Verify UI changes by screenshot (headless Chrome against `next start`);
  verify API changes with curl against a local server.

## Stack

- Next.js 15 App Router (pinned — do not jump to 16), React 19, TS strict
- Neon Postgres via Drizzle (`neon-http`); `db()` in `src/db` is a lazy
  singleton so builds work without env vars — keep it that way
- Auth.js v5 beta (`next-auth@5.0.0-beta.32`): GitHub OAuth, JWT sessions,
  **no auth tables** — journeys key on the GitHub numeric id (string).
  Custom session cookie name `oh-my-train.session-token`; `trustHost: true`
- Vitest (`src/**/*.test.ts`), ESLint flat config, GitHub Actions CI

## Domain rules (enforced server-side; client checks are convenience)

- Statuses: `ontime | delayed | cancelled | walked`
- `delayed` requires minutes 1–1440 on new entries; legacy imports are lenient
- `walked` exists only as a cascade resolution (requires `followsId`)
  and is excluded from punctuality stats
- Cascades: `follows_id` → same-day, cancelled, own-or-anonymous target;
  **one successor max** (unique index; 409 on violation)
- `reason` (the official excuse) is **only ever API-sourced** — never accept
  it from user input
- Anonymous rows (`user_id NULL`) are undeletable by design; DELETE enforces
  ownership in the WHERE clause
- Dates are plain `YYYY-MM-DD` strings, times strict 24h `HH:MM` — no
  timezone math anywhere

## Realtime Trains integration (`src/lib/rtt/`)

- Server-only. Token in `RTT_REFRESH_TOKEN`; exchange at
  `/api/get_access_token` (refresh token as Bearer), cache until `validUntil`
- **Budget: token caps are 10/min, 100/hour, 1,000/day, 10,000/week** —
  client guards at ~80%, counting token exchanges. Never bypass it
- Station codes are namespace-qualified: `gb-nr:KGX`. History reaches 14 days
- Normalizers are pure functions tested against real fixtures in
  `__fixtures__/` — extend fixtures rather than inventing shapes; when in
  doubt check https://realtimetrains.github.io/api-specification/
- Attribution to realtimetrains.co.uk must stay visibly in the footer

## Security invariants

- Public POST is rate-limited per IP (`src/lib/ratelimit.ts`, best-effort);
  keep `x-real-ip` preference
- Upstream hosts are fixed constants; user input never shapes URLs beyond
  strictly validated params
- No secrets or transport details in error messages; API routes return
  generic errors and never raw upstream JSON

## Design language

- Flat and minimal: no card borders, ghost buttons, generous type
- Railway red `--accent` (#c8102e light / brighter in dark), status colours
  paired with icon shapes (● ▲ ✕ 🚶) — never colour alone
- Dark mode: CSS tokens + `data-theme` stamped pre-paint; `?theme=` and
  `?day=` and `?help` URL params exist (also used for headless screenshots)
- No decorative flag elements — Britishness lives in the copy
