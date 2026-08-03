export const STATUSES = ["ontime", "delayed", "cancelled"] as const;
export type Status = (typeof STATUSES)[number];

export type Journey = {
  id: number | string;
  status: Status;
  mins?: number;
  /** departure time, "HH:MM" */
  depTime?: string;
  origin?: string;
  destination?: string;
  /** free-text description from the static-site era */
  label?: string;
  /** true when the signed-in viewer owns this row (deletable) */
  mine?: boolean;
};

/** date-key → journeys, the shape the UI (and the old static site's export) uses */
export type JourneyMap = Record<string, Journey[]>;

export const MAX_LABEL = 60;
export const MAX_PLACE = 40;
export const MAX_MINS = 1440;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDateKey(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isStatus(s: unknown): s is Status {
  return typeof s === "string" && (STATUSES as readonly string[]).includes(s);
}

export type CleanedJourney = {
  status: Status;
  mins?: number;
  depTime?: string;
  origin?: string;
  destination?: string;
  label?: string;
};

function cleanText(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
}

/**
 * Sanitize one journey payload. Returns null if it's beyond saving — which is
 * more than National Rail ever admits. With `requireDelayMins` (new entries),
 * a delayed journey must confess its minutes; without it (legacy imports),
 * undocumented delays are grudgingly accepted.
 */
export function cleanJourney(
  raw: unknown,
  opts: { requireDelayMins?: boolean } = {}
): CleanedJourney | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isStatus(r.status)) return null;

  const out: CleanedJourney = { status: r.status };

  if (typeof r.depTime === "string" && TIME_RE.test(r.depTime)) out.depTime = r.depTime;
  out.origin = cleanText(r.origin, MAX_PLACE);
  out.destination = cleanText(r.destination, MAX_PLACE);
  out.label = cleanText(r.label, MAX_LABEL);

  if (r.status === "delayed") {
    const mins = Number(r.mins);
    if (Number.isInteger(mins) && mins >= 1 && mins <= MAX_MINS) {
      out.mins = mins;
    } else if (opts.requireDelayMins) {
      return null;
    }
  }
  return out;
}

/**
 * Live input mask for the time field: keeps digits, inserts the colon as you
 * type ("0743" → "07:43"), and pads an impossible two-digit hour ("74…" can
 * only mean 07:4…). No trailing colon after two digits, so backspace behaves.
 */
export function maskTime(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  if (d.length < 2) return d;
  if (Number(d.slice(0, 2)) > 23) {
    return `0${d[0]}:${d.slice(1, 3)}`;
  }
  if (d.length === 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/**
 * Coerce casual input to strict 24-hour "HH:MM": "743"/"7:43"/"07.43" → "07:43".
 * Anything unsalvageable is returned as typed so form validation can flag it.
 */
export function normalizeTime(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const m = /^(\d{1,2})[:.]?([0-5]\d)$/.exec(t);
  if (!m) return t;
  const h = m[1].padStart(2, "0");
  return Number(h) <= 23 ? `${h}:${m[2]}` : t;
}

/** "2026-08" → ["2026-08-01", "2026-09-01"), or null if malformed */
export function monthRange(month: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const nextY = mo === 12 ? y + 1 : y;
  const nextMo = mo === 12 ? 1 : mo + 1;
  return {
    start: `${m[1]}-${m[2]}-01`,
    end: `${nextY}-${String(nextMo).padStart(2, "0")}-01`,
  };
}

/** Human-readable route fragment: "08:12 St Pancras → Bedford", "to Bedford", … */
export function journeyDesc(j: Pick<Journey, "depTime" | "origin" | "destination" | "label">): string {
  const route =
    j.origin && j.destination
      ? `${j.origin} → ${j.destination}`
      : j.origin
        ? `from ${j.origin}`
        : j.destination
          ? `to ${j.destination}`
          : "";
  const parts = [j.depTime, route].filter(Boolean).join(" ");
  return parts || j.label || "";
}
