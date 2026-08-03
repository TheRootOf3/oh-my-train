import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Small print — Oh My Train",
  description: "The privacy notice and terms. Short, honest, and more punctual than the railway.",
};

export default function AboutPage() {
  return (
    <main className="container smallprint">
      <p>
        <Link className="btn btn-small" href="/">
          ← Back to the misery
        </Link>
      </p>

      <h1 className="board-title">
        Small print<span className="title-dot">.</span>
      </h1>

      <section>
        <h2>What this is</h2>
        <p>
          Oh My Train is a communal diary of British rail disappointment. It is a free hobby project: no
          adverts, no analytics, no commercial anything. It runs on the goodwill of strangers and the
          reliability of everything except the trains.
        </p>
      </section>

      <section>
        <h2>Privacy</h2>
        <p>
          <strong>If you log anonymously</strong>, we store exactly what you type — date, verdict, minutes
          of delay, departure time, stations — and nothing about you. No name, no account, no fingerprint.
          Our rate limiter glances at your IP address and immediately forgets it; our hosting provider
          (Vercel) keeps standard server logs, as all hosting providers do.
        </p>
        <p>
          <strong>If you sign in with GitHub</strong>, we store one thing about you: your numeric GitHub ID,
          attached to the entries you log so they stay yours. No email, no real name, nothing else reaches
          the database. Your GitHub username appears in the corner while signed in, courtesy of a session
          cookie that lives in your browser and nowhere else.
        </p>
        <p>
          <strong>Where it lives:</strong> a Postgres database (Neon) in London — where your data arrives
          reliably, unlike you.
        </p>
        <p>
          <strong>Cookies:</strong> one essential session cookie if you sign in, and your dark-mode
          preference. No tracking, no analytics, no third parties. There is no cookie banner because there
          is nothing to consent to.
        </p>
        <p>
          <strong>Your rights:</strong> delete your own entries any time; “Export your data” hands you
          everything we hold on you in one JSON file. Want something removed entirely — including an
          anonymous entry you regret? Open an issue on{" "}
          <a href="https://github.com/TheRootOf3/oh-my-train" rel="noopener">
            the GitHub repository
          </a>{" "}
          and it will be dealt with faster than a Delay Repay claim.
        </p>
      </section>

      <section>
        <h2>Terms (all of them)</h2>
        <ol>
          <li>The site is provided “as is”, with no warranty of any kind — much like the timetable.</li>
          <li>
            Entries are public. Don&apos;t post personal information, abuse, or anything you wouldn&apos;t
            announce over the tannoy on platform 4.
          </li>
          <li>We may remove any entry at our discretion, especially the ones that break rule 2.</li>
          <li>Not affiliated with National Rail, any train operating company, or the concept of punctuality.</li>
        </ol>
        <p className="smallprint-date">Last updated: 3 August 2026.</p>
      </section>
    </main>
  );
}
