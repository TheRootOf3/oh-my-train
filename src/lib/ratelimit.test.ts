import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientKey, rateLimit } from "@/lib/ratelimit";

// The limiter keeps module-level state; every test uses its own key so they
// cannot interfere, and fake timers so windows are deterministic.

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-04T09:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows up to max hits then blocks", () => {
    const key = "test-basic";
    for (let i = 0; i < 5; i++) expect(rateLimit(key, 5, 60_000)).toBe(true);
    expect(rateLimit(key, 5, 60_000)).toBe(false);
  });

  it("resets after the window elapses", () => {
    const key = "test-window";
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 60_000);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
  });

  it("tracks keys independently", () => {
    expect(rateLimit("test-a", 1, 60_000)).toBe(true);
    expect(rateLimit("test-a", 1, 60_000)).toBe(false);
    expect(rateLimit("test-b", 1, 60_000)).toBe(true);
  });
});

describe("clientKey", () => {
  it("prefers the platform-set x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 8.8.8.8" });
    expect(clientKey(h)).toBe("1.2.3.4");
  });

  it("falls back to the first x-forwarded-for hop", () => {
    const h = new Headers({ "x-forwarded-for": "9.9.9.9, 8.8.8.8" });
    expect(clientKey(h)).toBe("9.9.9.9");
  });

  it("uses a constant when no headers exist", () => {
    expect(clientKey(new Headers())).toBe("local");
  });
});
