"use client";

import { useEffect, useState } from "react";

export default function HelpButton() {
  const [open, setOpen] = useState(false);

  // ?help deep-links straight to the explainer
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("help")) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button className="btn btn-small" onClick={() => setOpen(true)}>
        How does it work?
      </button>

      {open && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <div className="modal-head">
              <h3 id="help-title">How this works</h3>
              <button className="btn btn-close" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <ul className="help-list">
              <li>
                <strong>Click any day</strong> and log a train:{" "}
                <span className="mark mark-good" aria-hidden="true">●</span> on time,{" "}
                <span className="mark mark-warn" aria-hidden="true">▲</span> delayed (minutes required —
                confess), or <span className="mark mark-crit" aria-hidden="true">✕</span> cancelled.
                Departure time and route are optional.
              </li>
              <li>
                Every entry lands on the <strong>shared calendar</strong>. This is communal grief — no
                account needed, and anonymous entries are permanent.
              </li>
              <li>
                <strong>Sign in with GitHub</strong> to keep score: filter the stats to just your own
                journeys, delete your entries, and export your data.
              </li>
              <li>
                Logged a cancellation? We&apos;ll ask <strong>what was next</strong> — chains of doom appear
                indented, like <span className="chain-arrow" aria-hidden="true">↳</span> this. Each cancelled
                train gets one successor, and yes, <span aria-hidden="true">🚶</span> &ldquo;gave up &amp;
                walked&rdquo; is a legitimate outcome.
              </li>
              <li>
                The marks on each day are its verdicts. When a day has too many to show, they become counts.
                We are sorry this feature was necessary.
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
