"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TAGLINES } from "@/lib/puns";

const FADE_MS = 400;

export default function Header() {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    setFading(true);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => {
      setIdx((i) => (i + 1) % TAGLINES.length);
      setFading(false);
    }, FADE_MS);
  }, []);

  useEffect(() => {
    setIdx(new Date().getDate() % TAGLINES.length);
    const timer = setInterval(advance, 12_000);
    return () => {
      clearInterval(timer);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [advance]);

  return (
    <header className="board">
      <h1 className="board-title">
        Oh my train<span className="title-dot">.</span> <span className="title-emoji" aria-hidden="true">🚆</span>
      </h1>
      <p
        className={`tagline${fading ? " tagline-fading" : ""}`}
        title="Click for another apology"
        onClick={advance}
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
