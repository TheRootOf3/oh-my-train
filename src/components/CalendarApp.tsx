"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Journey, JourneyMap, Status } from "@/lib/journeys";
import { isValidDateKey, journeyDesc, maskTime, MAX_MINS, MAX_PLACE, normalizeTime } from "@/lib/journeys";

const STATUS_META: Record<Status, { label: string; icon: string; cls: string }> = {
  ontime: { label: "On time", icon: "●", cls: "mark-good" },
  delayed: { label: "Delayed", icon: "▲", cls: "mark-warn" },
  cancelled: { label: "Cancelled", icon: "✕", cls: "mark-crit" },
  walked: { label: "Gave up & walked", icon: "🚶", cls: "mark-walk" },
};

const CHIP_CLS: Record<Status, string> = { ontime: "good", delayed: "warn", cancelled: "crit", walked: "walk" };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MAX_PIPS = 6;
const LEGACY_KEY = "oh-my-train:v1";

type Scope = "all" | "mine";

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function prettyDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function journeyTitle(j: Journey): string {
  let t = STATUS_META[j.status].label;
  if (j.status === "delayed" && j.mins) t += ` ${j.mins} min`;
  const desc = journeyDesc(j);
  if (desc) t += ` — ${desc}`;
  return t;
}

type ApiJourney = {
  id: number;
  date: string;
  status: Status;
  depTime?: string;
  origin?: string;
  destination?: string;
  label?: string;
  mins?: number;
  followsId?: number;
  mine?: boolean;
};

function groupRows(rows: ApiJourney[]): JourneyMap {
  const map: JourneyMap = {};
  for (const r of rows) {
    (map[r.date] ??= []).push({
      id: r.id,
      status: r.status,
      depTime: r.depTime,
      origin: r.origin,
      destination: r.destination,
      label: r.label,
      mins: r.mins,
      followsId: r.followsId,
      mine: r.mine,
    });
  }
  return map;
}

/** Order a day's journeys so each cascade renders as an indented chain under its root. */
function buildChains(list: Journey[]): { j: Journey; depth: number }[] {
  const ids = new Set(list.map((j) => String(j.id)));
  const children = new Map<string, Journey[]>();
  const roots: Journey[] = [];
  for (const j of list) {
    const p = j.followsId !== undefined ? String(j.followsId) : null;
    if (p && ids.has(p)) {
      if (!children.has(p)) children.set(p, []);
      children.get(p)!.push(j);
    } else {
      roots.push(j);
    }
  }
  const out: { j: Journey; depth: number }[] = [];
  const walk = (j: Journey, depth: number) => {
    out.push({ j, depth });
    for (const c of children.get(String(j.id)) ?? []) walk(c, depth + 1);
  };
  for (const r of roots) walk(r, 0);
  return out;
}

export default function CalendarApp({ signedIn }: { signedIn: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [today, setToday] = useState<{ y: number; m: number; d: number } | null>(null);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [data, setData] = useState<JourneyMap>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [followUpOf, setFollowUpOf] = useState<Journey | null>(null);
  const [legacyCount, setLegacyCount] = useState(0);

  // add-journey form
  const [formStatus, setFormStatus] = useState<Status>("delayed");
  const [formTime, setFormTime] = useState("");
  const [formFrom, setFormFrom] = useState("");
  const [formTo, setFormTo] = useState("");
  const [formMins, setFormMins] = useState("");
  const [saving, setSaving] = useState(false);

  const labelInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reqSeq = useRef(0);

  // Dates are computed after mount so the server render never disagrees with the client's clock.
  useEffect(() => {
    const now = new Date();
    const t = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
    setToday(t);
    // ?day=YYYY-MM-DD deep-links straight to that day's modal
    const dayParam = new URLSearchParams(window.location.search).get("day");
    if (dayParam && isValidDateKey(dayParam)) {
      const [y, m] = dayParam.split("-").map(Number);
      setView({ y, m: m - 1 });
      setSelectedKey(dayParam);
    } else {
      setView({ y: t.y, m: t.m });
    }
    setMounted(true);
  }, []);

  const loadMonth = useCallback(
    async (y: number, m: number) => {
      const seq = ++reqSeq.current; // flipping months fast must not let a slow, stale response win
      setLoading(true);
      try {
        const res = await fetch(`/api/journeys?month=${y}-${pad(m + 1)}&scope=${scope}`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { journeys: ApiJourney[] };
        if (seq !== reqSeq.current) return;
        setData(groupRows(body.journeys));
        setLoadError(null);
      } catch {
        if (seq !== reqSeq.current) return;
        setLoadError("Could not reach the database. It is being held at a red signal.");
      } finally {
        if (seq === reqSeq.current) setLoading(false);
      }
    },
    [scope]
  );

  useEffect(() => {
    if (view) void loadMonth(view.y, view.m);
  }, [view, loadMonth]);

  // Offer to rescue data from the static-site era (needs an account to attach it to).
  useEffect(() => {
    if (!signedIn) return;
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown[]>;
      const n = Object.values(parsed)
        .filter(Array.isArray)
        .reduce((acc, list) => acc + list.length, 0);
      if (n > 0) setLegacyCount(n);
    } catch {
      /* corrupted localStorage — let it rest */
    }
  }, [signedIn]);

  // Modal keyboard handling + autofocus
  useEffect(() => {
    if (!selectedKey) return;
    labelInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedKey(null);
        setFollowUpOf(null);
        setFormStatus("delayed");
        setFormTime("");
        setFormFrom("");
        setFormTo("");
        setFormMins("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedKey]);

  if (!mounted || !view || !today) {
    return <p className="loading-note">Consulting the departure board…</p>;
  }

  /* ── derived stats for the visible month ── */

  const monthPrefix = `${view.y}-${pad(view.m + 1)}-`;
  const monthJourneys = Object.entries(data)
    .filter(([k]) => k.startsWith(monthPrefix))
    .flatMap(([, v]) => v);

  const counts = { ontime: 0, delayed: 0, cancelled: 0, walked: 0 };
  let minsLost = 0;
  for (const j of monthJourneys) {
    counts[j.status]++;
    if (j.status === "delayed" && j.mins) minsLost += j.mins;
  }
  // walking is a lifestyle choice, not a train — it stays out of the punctuality maths
  const total = counts.ontime + counts.delayed + counts.cancelled;
  const pct = total ? Math.round((counts.ontime / total) * 100) : null;

  /* ── calendar cells ── */

  const firstOffset = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cellCount = Math.ceil((firstOffset + daysInMonth) / 7) * 7;
  const todayKey = dateKey(today.y, today.m, today.d);

  /* ── handlers ── */

  const shiftMonth = (delta: number) => {
    setView((v) => {
      if (!v) return v;
      const m = v.m + delta;
      if (m < 0) return { y: v.y - 1, m: 11 };
      if (m > 11) return { y: v.y + 1, m: 0 };
      return { ...v, m };
    });
  };

  const resetForm = () => {
    setFormStatus("delayed");
    setFormTime("");
    setFormFrom("");
    setFormTo("");
    setFormMins("");
  };

  const cancelFollowUp = () => {
    setFollowUpOf(null);
    // "walked" only exists as a cascade resolution — snap back if the cascade ends
    setFormStatus((s) => (s === "walked" ? "delayed" : s));
  };

  const closeModal = () => {
    setSelectedKey(null);
    setFollowUpOf(null);
    resetForm();
  };

  const addJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKey || saving) return;

    const mins = parseInt(formMins, 10);
    if (formStatus === "delayed" && !(mins >= 1 && mins <= MAX_MINS)) return; // native `required` backs this up

    const payload: Record<string, unknown> = { date: selectedKey, status: formStatus };
    if (formTime) payload.depTime = formTime;
    if (formFrom.trim()) payload.origin = formFrom.trim();
    if (formTo.trim()) payload.destination = formTo.trim();
    if (formStatus === "delayed") payload.mins = mins;
    if (followUpOf) payload.followsId = followUpOf.id;

    setSaving(true);
    try {
      const res = await fetch("/api/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 429) {
        alert("Easy there. Logging is rate-limited — unlike the actual railway.");
        return;
      }
      if (res.status === 400 || res.status === 409) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        alert(body?.error ?? "The server declined to log that one.");
        if (res.status === 409) cancelFollowUp();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { journey: ApiJourney };
      const journey: Journey = {
        id: body.journey.id,
        status: body.journey.status,
        depTime: body.journey.depTime,
        origin: body.journey.origin,
        destination: body.journey.destination,
        label: body.journey.label,
        mins: body.journey.mins,
        followsId: body.journey.followsId,
        mine: body.journey.mine,
      };
      setData((d) => ({ ...d, [selectedKey]: [...(d[selectedKey] ?? []), journey] }));
      // a cancelled train invites the next chapter of the cascade
      setFollowUpOf(journey.status === "cancelled" ? journey : null);
      resetForm();
      labelInputRef.current?.focus();
    } catch {
      alert("The server declined to log that one. A signalling failure, probably.");
    } finally {
      setSaving(false);
    }
  };

  const deleteJourney = async (key: string, j: Journey) => {
    try {
      const res = await fetch(`/api/journeys?id=${j.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      alert("Could not delete it. Some disappointments are permanent.");
      return;
    }
    if (followUpOf?.id === j.id) cancelFollowUp();
    setData((d) => {
      const rest = (d[key] ?? []).filter((x) => x.id !== j.id);
      const next = { ...d };
      if (rest.length) next[key] = rest;
      else delete next[key];
      return next;
    });
  };

  const importLegacy = async () => {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      const res = await fetch("/api/journeys/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: raw,
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { imported: number };
      localStorage.removeItem(LEGACY_KEY);
      setLegacyCount(0);
      await loadMonth(view.y, view.m);
      alert(`Imported ${body.imported} journeys from the static era. History preserved, sadly.`);
    } catch {
      alert("Import failed. Your suffering remains local for now.");
    }
  };

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      JSON.parse(text); // sanity check before shipping it to the server
      const res = await fetch("/api/journeys/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { imported: number; skipped: number };
      await loadMonth(view.y, view.m);
      alert(`Imported ${body.imported} journeys${body.skipped ? `, skipped ${body.skipped} beyond saving` : ""}.`);
    } catch {
      alert("That file could not be read. It has been cancelled. We apologise for the inconvenience.");
    }
  };

  const selectedJourneys = selectedKey ? (data[selectedKey] ?? []) : [];
  const followedIds = new Set<number | string>(
    selectedJourneys.flatMap((j) => (j.followsId !== undefined ? [j.followsId] : []))
  );

  /* ── render ── */

  return (
    <>
      {legacyCount > 0 && (
        <div className="import-banner">
          <span>
            Found <strong>{legacyCount}</strong> journeys from the static-site era in this browser. Give your
            historical suffering a permanent home?
          </span>
          <button className="btn btn-small" onClick={importLegacy}>
            Import them
          </button>
        </div>
      )}

      {signedIn && (
        <div className="scope-toggle" role="group" aria-label="Whose journeys to show">
          <button
            className={`btn btn-small scope-btn${scope === "all" ? " active" : ""}`}
            onClick={() => setScope("all")}
          >
            Everyone&apos;s misery
          </button>
          <button
            className={`btn btn-small scope-btn${scope === "mine" ? " active" : ""}`}
            onClick={() => setScope("mine")}
          >
            Just mine
          </button>
        </div>
      )}

      <section className="stats" aria-label="Monthly statistics">
        <div className="stat-row">
          <span className="stat">
            <strong>{total}</strong> {total === 1 ? "journey" : "journeys"}
          </span>
          <span className="stat">
            <span className="mark mark-good" aria-hidden="true">●</span>{" "}
            <strong>{pct === null ? "–" : `${pct}%`}</strong> on time
          </span>
          <span className="stat">
            <span className="mark mark-warn" aria-hidden="true">▲</span> <strong>{counts.delayed}</strong> delayed
            {minsLost > 0 && <span className="stat-sub"> · {minsLost} min of {scope === "mine" ? "your" : "collective"} life</span>}
          </span>
          <span className="stat">
            <span className="mark mark-crit" aria-hidden="true">✕</span> <strong>{counts.cancelled}</strong>{" "}
            {counts.cancelled === 1 ? "ghost train" : "ghost trains"}
          </span>
          {counts.walked > 0 && (
            <span className="stat">
              <span className="mark" aria-hidden="true">🚶</span> <strong>{counts.walked}</strong> gave up
            </span>
          )}
        </div>

        <div
          className="meter"
          role="img"
          aria-label={
            total
              ? `Share of journeys: ${counts.ontime} on time, ${counts.delayed} delayed, ${counts.cancelled} cancelled`
              : "No journeys logged this month"
          }
        >
          <div className="meter-track">
            {total > 0 &&
              (
                [
                  ["seg-good", counts.ontime, "On time"],
                  ["seg-warn", counts.delayed, "Delayed"],
                  ["seg-crit", counts.cancelled, "Cancelled"],
                ] as const
              )
                .filter(([, n]) => n > 0)
                .map(([cls, n, label]) => (
                  <div
                    key={cls}
                    className={`meter-seg ${cls}`}
                    style={{ flexGrow: n, flexBasis: 0 }}
                    title={`${label}: ${n} (${Math.round((n / total) * 100)}%)`}
                  />
                ))}
          </div>
        </div>
      </section>

      <section className="calendar" aria-label="Monthly calendar">
        <div className="cal-nav">
          <button className="btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
          <h2 className="cal-title">
            {MONTHS[view.m]} {view.y}
            {loading && <span className="loading-dot" aria-hidden="true"> …</span>}
          </h2>
          <button className="btn" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
          <button className="btn btn-today" onClick={() => setView({ y: today.y, m: today.m })}>
            Today
          </button>
        </div>

        {loadError && (
          <p className="load-error" role="alert">
            {loadError}
          </p>
        )}

        <div className="cal-weekdays" aria-hidden="true">
          <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
        </div>

        <div className="cal-grid">
          {Array.from({ length: cellCount }, (_, i) => {
            const d = i - firstOffset + 1;
            if (d < 1 || d > daysInMonth) return <div key={i} className="day empty" />;

            const key = dateKey(view.y, view.m, d);
            const journeys = data[key] ?? [];
            const summary =
              journeys.length === 0
                ? "no journeys logged"
                : journeys.length > 4
                  ? `${journeys.length} journeys logged`
                  : journeys.map(journeyTitle).join("; ");
            return (
              <button
                key={i}
                type="button"
                className={`day${key === todayKey ? " today" : ""}`}
                aria-label={`${prettyDate(key)}: ${summary}`}
                onClick={() => {
                  setSelectedKey(key);
                  cancelFollowUp();
                }}
              >
                <span className="day-num">{d}</span>
                {journeys.length > 0 && journeys.length <= MAX_PIPS && (
                  <span className="pips" aria-hidden="true">
                    {journeys.map((j, pi) => (
                      <span key={pi} className={`mark ${STATUS_META[j.status].cls}`} title={journeyTitle(j)}>
                        {STATUS_META[j.status].icon}
                      </span>
                    ))}
                  </span>
                )}
                {journeys.length > MAX_PIPS && (
                  <span className="pips" aria-hidden="true">
                    {(Object.keys(STATUS_META) as Status[]).map((s) => {
                      const n = journeys.filter((j) => j.status === s).length;
                      if (!n) return null;
                      return (
                        <span key={s} className="pip-count" title={`${STATUS_META[s].label}: ${n}`}>
                          <span className={`mark ${STATUS_META[s].cls}`}>{STATUS_META[s].icon}</span>
                          {n}
                        </span>
                      );
                    })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {signedIn && (
        <section className="data-tools" aria-label="Data tools">
          <button className="btn" onClick={() => (window.location.href = "/api/journeys/export")}>
            Export your data
          </button>
          <button className="btn" onClick={() => fileInputRef.current?.click()}>
            Import data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
          <span className="data-note">
            Data lives in a Neon Postgres database now. Unlike your train, it actually arrives.
          </span>
        </section>
      )}

      {selectedKey && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-head">
              <h3 id="modal-title">{prettyDate(selectedKey)}</h3>
              <button className="btn btn-close" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            <ul className="journey-list">
              {selectedJourneys.length === 0 ? (
                <li className="journey-empty">Nothing logged yet. A clean slate — how unlike the railway.</li>
              ) : (
                buildChains(selectedJourneys).map(({ j, depth }) => (
                  <li
                    key={j.id}
                    className="journey-item"
                    style={depth ? { marginLeft: Math.min(depth, 3) * 18 } : undefined}
                  >
                    {depth > 0 && (
                      <span className="chain-arrow" aria-hidden="true">
                        ↳
                      </span>
                    )}
                    <span className="journey-status">
                      <span className={`mark ${STATUS_META[j.status].cls}`} aria-hidden="true">
                        {STATUS_META[j.status].icon}
                      </span>{" "}
                      {STATUS_META[j.status].label}
                      {j.status === "delayed" && j.mins ? ` · ${j.mins} min` : ""}
                    </span>
                    <span className="journey-desc">{journeyDesc(j)}</span>
                    {j.status === "cancelled" && !followedIds.has(j.id) && (
                      <button
                        type="button"
                        className="btn-del chain-btn"
                        title="Log the next train after this one"
                        aria-label={`Log the next train after: ${journeyTitle(j)}`}
                        onClick={() => {
                          setFollowUpOf(j);
                          labelInputRef.current?.focus();
                        }}
                      >
                        ↳
                      </button>
                    )}
                    {j.mine && (
                      <button
                        type="button"
                        className="btn-del"
                        aria-label={`Delete: ${journeyTitle(j)}`}
                        onClick={() => void deleteJourney(selectedKey, j)}
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>

            {followUpOf && (
              <div className="cascade-banner">
                <span>
                  <strong>{journeyDesc(followUpOf) || "That train"}</strong> was cancelled —{" "}
                  <strong>what was next?</strong>
                </span>
                <button type="button" className="btn btn-small" onClick={cancelFollowUp}>
                  skip
                </button>
              </div>
            )}

            <form className="add-form" onSubmit={addJourney}>
              <fieldset className="status-picker">
                <legend className="field-label">Verdict</legend>
                {(Object.keys(STATUS_META) as Status[])
                  .filter((s) => s !== "walked" || followUpOf)
                  .map((s) => (
                    <label key={s} className="status-opt">
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={formStatus === s}
                        onChange={() => setFormStatus(s)}
                      />
                      <span className={`status-chip chip-${CHIP_CLS[s]}`}>
                        <span aria-hidden="true">{STATUS_META[s].icon}</span> {STATUS_META[s].label}
                      </span>
                    </label>
                  ))}
              </fieldset>

              {formStatus === "delayed" && (
                <label className="field field-mins">
                  <span className="field-label">Minutes late</span>
                  <input
                    type="number"
                    required
                    min={1}
                    max={MAX_MINS}
                    placeholder="e.g. 25"
                    inputMode="numeric"
                    value={formMins}
                    onChange={(e) => setFormMins(e.target.value)}
                  />
                </label>
              )}

              <div className="field-row">
                <label className="field field-time">
                  <span className="field-label">
                    Departure <span className="field-opt">(optional)</span>
                  </span>
                  <input
                    ref={labelInputRef}
                    type="text"
                    placeholder="19:07"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={5}
                    pattern="([01]\d|2[0-3]):[0-5]\d"
                    title="24-hour clock, e.g. 19:07"
                    value={formTime}
                    onChange={(e) => setFormTime(maskTime(e.target.value))}
                    onBlur={() => setFormTime((v) => normalizeTime(v))}
                  />
                </label>
                <label className="field field-place">
                  <span className="field-label">
                    From <span className="field-opt">(optional)</span>
                  </span>
                  <input
                    type="text"
                    placeholder="St Pancras"
                    maxLength={MAX_PLACE}
                    autoComplete="off"
                    value={formFrom}
                    onChange={(e) => setFormFrom(e.target.value)}
                  />
                </label>
                <label className="field field-place">
                  <span className="field-label">
                    To <span className="field-opt">(optional)</span>
                  </span>
                  <input
                    type="text"
                    placeholder="Bedford"
                    maxLength={MAX_PLACE}
                    autoComplete="off"
                    value={formTo}
                    onChange={(e) => setFormTo(e.target.value)}
                  />
                </label>
              </div>

              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Logging…" : "Log it"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
