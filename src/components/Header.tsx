"use client";

import { useEffect, useState } from "react";
import { TAGLINES } from "@/lib/puns";

export default function Header() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(new Date().getDate() % TAGLINES.length);
    const timer = setInterval(() => setIdx((i) => (i + 1) % TAGLINES.length), 12_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="board">
      <h1 className="board-title">
        Oh my train<span className="title-dot">.</span> <span className="title-emoji" aria-hidden="true">🚆</span>
      </h1>
      <p
        className="tagline"
        title="Click for another apology"
        onClick={() => setIdx((i) => (i + 1) % TAGLINES.length)}
      >
        {TAGLINES[idx]}
      </p>
      <p className="subtitle">
        The communal punctuality diary for Britain&apos;s railways. Anyone can log a journey — on time,
        delayed or cancelled — and sign in with GitHub to keep score of your own.
      </p>
    </header>
  );
}
