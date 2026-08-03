# Oh My Train 🚆

**The British rail disappointment diary.**

A static, single-purpose website for documenting whether your train actually
showed up. Log each journey on a monthly calendar — on time, delayed (and by
how many minutes of your finite life), or cancelled outright — and watch the
statistics confirm what you already suspected.

Bright, simple, and accented in railway red — the colour of both the brand
and the "Cancelled" row on the departure board.

## Features

- Monthly calendar (Monday-first, as is right and proper) — click any day to log journeys
- Multiple journeys per day, because commuting is a round trip through sorrow
- Three verdicts per journey: **● On time**, **▲ Delayed** (with minutes), **✕ Cancelled**
- Monthly stats: journey count, on-time percentage, minutes of your life lost to delays, and a running tally of ghost trains
- A snarky verdict line that adapts to how badly your month is going
- Export / import your data as JSON (it otherwise lives in your browser's localStorage)
- No build step, no framework, no dependencies, no backend — unlike the railway, there is nothing here that can break down

## Running locally

Open `index.html` in a browser. That's it. No `npm install`, no rail
replacement bus service.

## Deploying to GitHub Pages

1. Create a repository on GitHub (e.g. `oh-my-train`).
2. From this directory:

   ```sh
   git init
   git add .
   git commit -m "Initial commit: the despair begins"
   git branch -M main
   git remote add origin git@github.com:<your-username>/oh-my-train.git
   git push -u origin main
   ```

3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, then pick `main` / `/ (root)`.
4. Your site appears at `https://<your-username>.github.io/oh-my-train/` — usually within a minute or two, making it the most punctual thing in this entire domain.

## A note on data

Everything is stored in your browser's `localStorage`, keyed per browser and
device. Use **Export data** for backups or to move between devices, and
**Import data** to restore. There is no server, no account and no tracking —
your suffering is yours alone.

## Disclaimer

Not affiliated with National Rail, any train operating company, or the concept
of punctuality.
