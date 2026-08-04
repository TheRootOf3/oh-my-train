import { describe, expect, it } from "vitest";
import {
  hhmm,
  latenessOf,
  normalizeLineUp,
  normalizeServiceVerdict,
  normalizeStations,
  pickReason,
} from "./normalize";
import type { RttLineUpResponse, RttServiceResponse, RttStopsResponse } from "./types";
import lineupFixture from "./__fixtures__/lineup.json";
import serviceFixture from "./__fixtures__/service.json";
import stopsFixture from "./__fixtures__/stops-sample.json";

const lineup = lineupFixture as RttLineUpResponse;
const service = serviceFixture as RttServiceResponse;
const stops = stopsFixture as RttStopsResponse;

describe("hhmm", () => {
  it("extracts the local clock time", () => {
    expect(hhmm("2026-08-04T13:24:00")).toBe("13:24");
    expect(hhmm("2026-08-04T13:24:00+01:00")).toBe("13:24");
    expect(hhmm(undefined)).toBeUndefined();
    expect(hhmm("garbage")).toBeUndefined();
  });
});

describe("latenessOf", () => {
  it("prefers the API's own lateness figure", () => {
    expect(latenessOf({ realtimeAdvertisedLateness: 7 })).toEqual({ mins: 7, estimated: false });
  });

  it("falls back to actual vs advertised", () => {
    expect(
      latenessOf({ scheduleAdvertised: "2026-08-04T13:00:00", realtimeActual: "2026-08-04T13:14:00" })
    ).toEqual({ mins: 14, estimated: false });
  });

  it("uses the forecast only as an estimate", () => {
    expect(
      latenessOf({ scheduleAdvertised: "2026-08-04T13:00:00", realtimeForecast: "2026-08-04T13:05:00" })
    ).toEqual({ mins: 5, estimated: true });
  });

  it("admits ignorance without realtime data", () => {
    expect(latenessOf({ scheduleAdvertised: "2026-08-04T13:00:00" })).toEqual({ estimated: false });
    expect(latenessOf(undefined)).toEqual({ estimated: false });
  });
});

describe("pickReason", () => {
  const reasons = [
    { type: "DELAY" as const, shortText: "late crew", longText: "Waiting for a member of train crew." },
    { type: "CANCEL" as const, shortText: "broken train", longText: null },
  ];

  it("matches the reason type to the verdict", () => {
    expect(pickReason(reasons, false)).toEqual({
      reasonShort: "late crew",
      reasonLong: "Waiting for a member of train crew.",
    });
    expect(pickReason(reasons, true)).toEqual({ reasonShort: "broken train", reasonLong: undefined });
  });

  it("falls back to any reason with text, or none at all", () => {
    expect(pickReason([{ type: "DELAY", shortText: "leaves" }], true)).toEqual({
      reasonShort: "leaves",
      reasonLong: undefined,
    });
    expect(pickReason([], false)).toEqual({});
    expect(pickReason(undefined, false)).toEqual({});
  });
});

describe("normalizeLineUp (real fixture)", () => {
  it("maps every identifiable passenger service", () => {
    const out = normalizeLineUp(lineup);
    expect(out.length).toBe(3);
    const first = out[0];
    expect(first.serviceUid).toBe("gb-nr:G77008:2026-08-04");
    expect(first.runDate).toBe("2026-08-04");
    expect(first.depTime).toBe("13:24");
    expect(first.operator).toBe("Great Northern");
    expect(first.headsTo).toBe("Ely");
    expect(first.mode).toBe("TRAIN");
    // forecast equals advertised → punctual, but only as an estimate
    expect(first.status).toBe("ontime");
    expect(first.estimated).toBe(true);
  });

  it("derives a cancelled verdict with its official excuse", () => {
    const doctored = structuredClone(lineup) as RttLineUpResponse;
    const s = doctored.services![0];
    s.temporalData!.displayAs = "CANCELLED";
    s.reasons = [
      { type: "CANCEL", shortText: "broken down train", longText: "This train has been cancelled because of a broken down train." },
    ];
    const out = normalizeLineUp(doctored);
    expect(out[0].status).toBe("cancelled");
    expect(out[0].reasonShort).toBe("broken down train");
    expect(out[0].reasonLong).toMatch(/broken down train/);
  });

  it("skips unidentifiable and non-passenger services", () => {
    const doctored = structuredClone(lineup) as RttLineUpResponse;
    delete doctored.services![0].scheduleMetadata!.uniqueIdentity;
    doctored.services![1].scheduleMetadata!.inPassengerService = false;
    expect(normalizeLineUp(doctored).length).toBe(1);
  });

  it("handles an empty response", () => {
    expect(normalizeLineUp({})).toEqual([]);
  });
});

describe("normalizeServiceVerdict (real fixture)", () => {
  it("judges the journey at the requested destination", () => {
    const v = normalizeServiceVerdict(service, "CBG");
    expect(v).not.toBeNull();
    expect(v!.serviceUid).toBe("gb-nr:G77008:2026-08-04");
    expect(v!.origin).toBe("London Kings Cross");
    expect(v!.destination).toBe("Cambridge");
    expect(v!.depTime).toBe("13:24");
    expect(v!.status).toBe("ontime");
    expect(v!.estimated).toBe(true);
  });

  it("falls back to the terminus for an unknown destination code", () => {
    const v = normalizeServiceVerdict(service, "ZZZ");
    expect(v!.destination).toBe("Ely");
  });

  it("reports a cancellation at the destination", () => {
    const doctored = structuredClone(service) as RttServiceResponse;
    const cbg = doctored.service!.locations!.find((l) => l.location?.shortCodes?.includes("CBG"))!;
    cbg.temporalData!.displayAs = "CANCELLED";
    cbg.reasons = [{ type: "CANCEL", shortText: "signalling failure" }];
    const v = normalizeServiceVerdict(doctored, "CBG");
    expect(v!.status).toBe("cancelled");
    expect(v!.reasonShort).toBe("signalling failure");
  });

  it("returns null for empty responses", () => {
    expect(normalizeServiceVerdict({}, "CBG")).toBeNull();
  });
});

describe("normalizeStations (real fixture)", () => {
  it("produces a deduplicated, sorted station list", () => {
    const out = normalizeStations(stops);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]).toEqual({ code: "ABW", name: "Abbey Wood" });
    const codes = out.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
    const names = out.map((s) => s.name);
    expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
  });

  it("drops entries without codes or names", () => {
    expect(normalizeStations({ stops: [{ description: "Nowhere" }, { shortCode: "XXX" }] })).toEqual([]);
  });
});
