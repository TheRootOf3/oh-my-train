import type {
  RailServiceSummary,
  RailServiceVerdict,
  RailStation,
  RailVerdict,
  RttLineUpResponse,
  RttReason,
  RttServiceLocation,
  RttServiceResponse,
  RttStopsResponse,
  RttTemporalPoint,
} from "./types";

/** "2026-08-04T13:24:00" or "…T13:24:00+01:00" → "13:24" (RTT times are location-local) */
export function hhmm(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = /T(\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : undefined;
}

function minutesBetween(fromIso?: string, toIso?: string): number | undefined {
  if (!fromIso || !toIso) return undefined;
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return undefined;
  return Math.round((b - a) / 60_000);
}

/**
 * Lateness in minutes for a temporal point. Prefers the API's own figure,
 * then actual-vs-advertised, then forecast-vs-advertised (flagged estimated).
 */
export function latenessOf(p?: RttTemporalPoint): { mins?: number; estimated: boolean } {
  if (!p) return { estimated: false };
  if (typeof p.realtimeAdvertisedLateness === "number") {
    return { mins: p.realtimeAdvertisedLateness, estimated: false };
  }
  const actual = minutesBetween(p.scheduleAdvertised, p.realtimeActual);
  if (actual !== undefined) return { mins: actual, estimated: false };
  const forecast = minutesBetween(p.scheduleAdvertised, p.realtimeForecast);
  if (forecast !== undefined) return { mins: forecast, estimated: true };
  return { estimated: false };
}

function isCancelledAt(displayAs?: string | null, ...points: (RttTemporalPoint | undefined)[]): boolean {
  if (displayAs === "CANCELLED") return true;
  return points.some((p) => p?.isCancelled === true);
}

function verdictOf(cancelled: boolean, mins?: number): RailVerdict {
  if (cancelled) return "cancelled";
  if (mins === undefined) return "unknown";
  return mins >= 1 ? "delayed" : "ontime";
}

/** Pick the most relevant broadcast excuse: CANCEL reasons for cancellations, else DELAY. */
export function pickReason(
  reasons: RttReason[] | undefined,
  cancelled: boolean
): { reasonShort?: string; reasonLong?: string } {
  if (!reasons?.length) return {};
  const wanted = cancelled ? "CANCEL" : "DELAY";
  const match = reasons.find((r) => r.type === wanted && r.shortText) ?? reasons.find((r) => r.shortText);
  if (!match?.shortText) return {};
  return {
    reasonShort: match.shortText,
    reasonLong: match.longText ?? undefined,
  };
}

/** Line-up response → picker list. Skips non-passenger and unidentifiable services. */
export function normalizeLineUp(resp: RttLineUpResponse): RailServiceSummary[] {
  const out: RailServiceSummary[] = [];
  for (const s of resp.services ?? []) {
    const meta = s.scheduleMetadata;
    if (!meta?.uniqueIdentity || !meta.departureDate) continue;
    if (meta.inPassengerService === false) continue;

    const dep = s.temporalData?.departure;
    const cancelled = isCancelledAt(s.temporalData?.displayAs, dep);
    const { mins, estimated } = latenessOf(dep);

    out.push({
      serviceUid: meta.uniqueIdentity,
      runDate: meta.departureDate,
      depTime: hhmm(dep?.scheduleAdvertised),
      operator: meta.operator?.name,
      headsTo: s.destination?.[0]?.location?.description,
      status: verdictOf(cancelled, mins),
      latenessMins: mins,
      estimated: estimated || undefined,
      mode: meta.modeType,
      ...pickReason(s.reasons, cancelled),
    });
  }
  return out;
}

function locationMatches(loc: RttServiceLocation, code: string): boolean {
  return (loc.location?.shortCodes ?? []).includes(code);
}

/**
 * Service detail → the verdict for a journey ending at `destCode`.
 * Lateness is measured at the destination arrival — the Delay Repay way.
 */
export function normalizeServiceVerdict(
  resp: RttServiceResponse,
  destCode: string
): RailServiceVerdict | null {
  const svc = resp.service;
  const meta = svc?.scheduleMetadata;
  if (!svc || !meta?.uniqueIdentity || !meta.departureDate) return null;

  const locations = svc.locations ?? [];
  const dest = locations.find((l) => locationMatches(l, destCode)) ?? locations[locations.length - 1];
  if (!dest) return null;

  const first = locations[0];
  const arr = dest.temporalData?.arrival;
  const dep = first?.temporalData?.departure;

  // the journey is off if the service is cancelled at boarding OR at alighting
  const cancelled =
    isCancelledAt(dest.temporalData?.displayAs, arr) || isCancelledAt(first?.temporalData?.displayAs, dep);

  const { mins, estimated } = latenessOf(arr);

  // reasons can be attached anywhere along the route — gather them all
  const allReasons = [
    ...(dest.reasons ?? []),
    ...locations.flatMap((l) => l.reasons ?? []),
  ];

  return {
    serviceUid: meta.uniqueIdentity,
    runDate: meta.departureDate,
    status: verdictOf(cancelled, mins),
    latenessMins: mins,
    estimated: estimated || undefined,
    depTime: hhmm(dep?.scheduleAdvertised),
    origin: first?.location?.description,
    destination: dest.location?.description,
    ...pickReason(allReasons, cancelled),
  };
}

/** Stops reference data → deduplicated, sorted station list for the autocomplete. */
export function normalizeStations(resp: RttStopsResponse): RailStation[] {
  const raw = resp.stops ?? resp.locations ?? [];
  const byCode = new Map<string, RailStation>();
  for (const s of raw) {
    if (!s.shortCode || !s.description) continue;
    if (s.namespace && s.namespace !== "gb-nr") continue;
    if (!byCode.has(s.shortCode)) {
      byCode.set(s.shortCode, { code: s.shortCode, name: s.description });
    }
  }
  return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name));
}
