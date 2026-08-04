import type {
  RailServiceSummary,
  RailServiceVerdict,
  RailStation,
  RttLineUpResponse,
  RttServiceResponse,
  RttStopsResponse,
} from "./types";
import { normalizeLineUp, normalizeServiceVerdict, normalizeStations } from "./normalize";

// Fixed upstream host — user input can never alter where we connect.
const BASE = "https://data.rtt.io";
const NS = "gb-nr";
const TIMEOUT_MS = 5_000;

/** Raised whenever rail data can't be had — callers degrade to manual logging. */
export class RttUnavailableError extends Error {}

// Multi-window outbound budget held ~20% under the token's caps
// (10/min, 100/hour, 1,000/day, 10,000/week). Counts every call including
// token exchanges. Per-instance and best-effort — RTT enforces the real
// limits; this keeps us politely clear of them.
const BUDGET = [
  { windowMs: 60_000, max: 8 },
  { windowMs: 3_600_000, max: 80 },
  { windowMs: 86_400_000, max: 800 },
  { windowMs: 604_800_000, max: 8_000 },
].map((b) => ({ ...b, n: 0, reset: 0 }));

function takeBudget(): boolean {
  const now = Date.now();
  for (const b of BUDGET) {
    if (now > b.reset) {
      b.n = 0;
      b.reset = now + b.windowMs;
    }
  }
  if (BUDGET.some((b) => b.n >= b.max)) return false;
  for (const b of BUDGET) b.n++;
  return true;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function rttFetch(url: string, bearer: string): Promise<Response> {
  try {
    return await fetch(url, {
      headers: { Authorization: `Bearer ${bearer}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    // timeout or network failure — surface nothing about the transport (or tokens)
    throw new RttUnavailableError("The rail data service did not respond");
  }
}

async function getAccessToken(force = false): Promise<string> {
  if (!force && tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }
  const refresh = process.env.RTT_REFRESH_TOKEN;
  if (!refresh) throw new RttUnavailableError("RTT_REFRESH_TOKEN is not configured");
  if (!takeBudget()) throw new RttUnavailableError("Rail data budget exhausted");

  const res = await rttFetch(`${BASE}/api/get_access_token`, refresh);
  if (!res.ok) throw new RttUnavailableError(`Token exchange failed (${res.status})`);
  const body = (await res.json()) as { token?: string; validUntil?: string };
  if (!body.token) throw new RttUnavailableError("Token exchange returned no token");

  const parsed = body.validUntil ? Date.parse(body.validUntil) : NaN;
  tokenCache = {
    token: body.token,
    expiresAt: Number.isNaN(parsed) ? Date.now() + 10 * 60_000 : parsed,
  };
  return body.token;
}

async function rttGet<T>(path: string, params: Record<string, string>): Promise<T | null> {
  if (!takeBudget()) throw new RttUnavailableError("Rail data budget exhausted");
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;

  let res = await rttFetch(url, await getAccessToken());
  if (res.status === 401) {
    // access token expired ahead of validUntil — refresh once and retry
    res = await rttFetch(url, await getAccessToken(true));
  }
  if (res.status === 204) return null; // valid query, nothing found
  if (!res.ok) throw new RttUnavailableError(`Rail data request failed (${res.status})`);
  return (await res.json()) as T;
}

const CODE_RE = /^[A-Z0-9]{3}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const SERVICE_UID_RE = /^gb-nr:[A-Z0-9]+:\d{4}-\d{2}-\d{2}$/;

function assertStationCode(code: string): string {
  if (!CODE_RE.test(code)) throw new RttUnavailableError("Invalid station code");
  return `${NS}:${code}`;
}

/** Services from → to around a local datetime, for the picker. */
export async function searchServices(opts: {
  from: string;
  to: string;
  dateTime: string;
  windowMins?: number;
}): Promise<RailServiceSummary[]> {
  if (!DATETIME_RE.test(opts.dateTime)) throw new RttUnavailableError("Invalid datetime");
  const resp = await rttGet<RttLineUpResponse>("/rtt/location", {
    code: assertStationCode(opts.from),
    filterTo: assertStationCode(opts.to),
    timeFrom: opts.dateTime,
    timeWindow: String(opts.windowMins ?? 180),
    timeTolerance: "true",
  });
  return resp ? normalizeLineUp(resp) : [];
}

/** The official record for one service, judged at the given destination. */
export async function fetchServiceVerdict(
  serviceUid: string,
  destCode: string
): Promise<RailServiceVerdict | null> {
  if (!SERVICE_UID_RE.test(serviceUid)) throw new RttUnavailableError("Invalid service reference");
  if (!CODE_RE.test(destCode)) throw new RttUnavailableError("Invalid station code");
  const resp = await rttGet<RttServiceResponse>("/rtt/service", { uniqueIdentity: serviceUid });
  return resp ? normalizeServiceVerdict(resp, destCode) : null;
}

/** Full passenger-stop list for the autocomplete. Callers should cache hard. */
export async function fetchStations(): Promise<RailStation[]> {
  const resp = await rttGet<RttStopsResponse>("/data/stops", {});
  return resp ? normalizeStations(resp) : [];
}

/** Test-only: clears module-level token and budget state between tests. */
export function __resetRttStateForTests(): void {
  tokenCache = null;
  for (const b of BUDGET) {
    b.n = 0;
    b.reset = 0;
  }
}
