import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetRttStateForTests,
  fetchServiceVerdict,
  RttUnavailableError,
  searchServices,
} from "./client";
import lineupFixture from "./__fixtures__/lineup.json";
import serviceFixture from "./__fixtures__/service.json";

const TOKEN_BODY = { token: "access-token-1", validUntil: "2099-01-01T00:00:00Z" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-04T09:00:00Z"));
  vi.stubEnv("RTT_REFRESH_TOKEN", "refresh-secret");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  __resetRttStateForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("searchServices", () => {
  it("exchanges the refresh token then queries with the access token", async () => {
    fetchMock.mockResolvedValueOnce(json(TOKEN_BODY)).mockResolvedValueOnce(json(lineupFixture));

    const out = await searchServices({ from: "KGX", to: "CBG", dateTime: "2026-08-04T13:00" });
    expect(out.length).toBe(3);

    const [tokenCall, dataCall] = fetchMock.mock.calls;
    expect(String(tokenCall[0])).toBe("https://data.rtt.io/api/get_access_token");
    expect(tokenCall[1].headers.Authorization).toBe("Bearer refresh-secret");

    const dataUrl = new URL(String(dataCall[0]));
    expect(dataUrl.pathname).toBe("/rtt/location");
    expect(dataUrl.searchParams.get("code")).toBe("gb-nr:KGX");
    expect(dataUrl.searchParams.get("filterTo")).toBe("gb-nr:CBG");
    expect(dataUrl.searchParams.get("timeFrom")).toBe("2026-08-04T13:00");
    expect(dataCall[1].headers.Authorization).toBe("Bearer access-token-1");
  });

  it("reuses a cached access token", async () => {
    fetchMock
      .mockResolvedValueOnce(json(TOKEN_BODY))
      .mockResolvedValueOnce(json(lineupFixture))
      .mockResolvedValueOnce(json(lineupFixture));

    await searchServices({ from: "KGX", to: "CBG", dateTime: "2026-08-04T13:00" });
    await searchServices({ from: "KGX", to: "CBG", dateTime: "2026-08-04T14:00" });

    // one exchange + two data calls, not two exchanges
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refreshes once when the access token dies early", async () => {
    fetchMock
      .mockResolvedValueOnce(json(TOKEN_BODY))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(json({ ...TOKEN_BODY, token: "access-token-2" }))
      .mockResolvedValueOnce(json(lineupFixture));

    const out = await searchServices({ from: "KGX", to: "CBG", dateTime: "2026-08-04T13:00" });
    expect(out.length).toBe(3);
    expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe("Bearer access-token-2");
  });

  it("treats 204 as an empty result, not an error", async () => {
    fetchMock.mockResolvedValueOnce(json(TOKEN_BODY)).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(searchServices({ from: "KGX", to: "CBG", dateTime: "2026-08-04T03:00" })).resolves.toEqual([]);
  });

  it("fails closed without a configured token, before any network call", async () => {
    vi.stubEnv("RTT_REFRESH_TOKEN", "");
    await expect(searchServices({ from: "KGX", to: "CBG", dateTime: "2026-08-04T13:00" })).rejects.toBeInstanceOf(
      RttUnavailableError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps network failures to RttUnavailableError without detail leakage", async () => {
    fetchMock.mockRejectedValue(new Error("secret internals"));
    await expect(searchServices({ from: "KGX", to: "CBG", dateTime: "2026-08-04T13:00" })).rejects.toThrow(
      "The rail data service did not respond"
    );
  });

  it("rejects invalid station codes and datetimes before any network call", async () => {
    await expect(searchServices({ from: "kgx", to: "CBG", dateTime: "2026-08-04T13:00" })).rejects.toBeInstanceOf(
      RttUnavailableError
    );
    await expect(searchServices({ from: "KGX", to: "CBG", dateTime: "13:00" })).rejects.toBeInstanceOf(
      RttUnavailableError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops at the per-minute outbound budget and recovers after the window", async () => {
    // fresh Response per call — a Response body is single-use
    fetchMock.mockImplementation((url: unknown) =>
      Promise.resolve(String(url).includes("get_access_token") ? json(TOKEN_BODY) : json(lineupFixture))
    );

    // call 1 uses 2 budget slots (exchange + data); calls 2–7 use 1 each → 8 total
    for (let i = 0; i < 7; i++) {
      await searchServices({ from: "KGX", to: "CBG", dateTime: "2026-08-04T13:00" });
    }
    await expect(searchServices({ from: "KGX", to: "CBG", dateTime: "2026-08-04T13:00" })).rejects.toThrow(
      "budget exhausted"
    );

    vi.advanceTimersByTime(61_000);
    await expect(searchServices({ from: "KGX", to: "CBG", dateTime: "2026-08-04T13:00" })).resolves.toBeDefined();
  });
});

describe("fetchServiceVerdict", () => {
  it("returns the verdict for a valid reference", async () => {
    fetchMock.mockResolvedValueOnce(json(TOKEN_BODY)).mockResolvedValueOnce(json(serviceFixture));
    const v = await fetchServiceVerdict("gb-nr:G77008:2026-08-04", "CBG");
    expect(v!.destination).toBe("Cambridge");
    const dataUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(dataUrl.searchParams.get("uniqueIdentity")).toBe("gb-nr:G77008:2026-08-04");
  });

  it("rejects malformed service references before any network call", async () => {
    await expect(fetchServiceVerdict("gb-nr:../etc:2026-08-04", "CBG")).rejects.toBeInstanceOf(RttUnavailableError);
    await expect(fetchServiceVerdict("gb-nr:G77008:2026-08-04", "C;G")).rejects.toBeInstanceOf(RttUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
