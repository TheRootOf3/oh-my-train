"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const stamped = document.documentElement.dataset.theme;
    setDark(stamped ? stamped === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  const toggle = () => {
    if (dark === null) return; // not yet mounted — current theme unknown
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("omt-theme", next ? "dark" : "light");
    } catch {
      /* private browsing — the theme, like the 07:43, will not persist */
    }
  };

  // render a fixed-size placeholder until mounted so the topbar doesn't jump
  return (
    <button
      className="btn btn-small theme-btn"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark === null ? "•" : dark ? "☀️" : "🌙"}
    </button>
  );
}
