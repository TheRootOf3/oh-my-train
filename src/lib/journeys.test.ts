import { describe, expect, it } from "vitest";
import {
  cleanJourney,
  isValidDateKey,
  journeyDesc,
  maskTime,
  monthRange,
  normalizeTime,
} from "@/lib/journeys";

describe("isValidDateKey", () => {
  it("accepts real dates", () => {
    expect(isValidDateKey("2026-08-03")).toBe(true);
    expect(isValidDateKey("2024-02-29")).toBe(true); // leap day
  });

  it("rejects impossible or malformed dates", () => {
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("2026-02-29")).toBe(false); // not a leap year
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("nope")).toBe(false);
    expect(isValidDateKey("2026-8-3")).toBe(false); // must be zero-padded
  });
});

describe("monthRange", () => {
  it("produces [start, next-month) ranges", () => {
    expect(monthRange("2026-08")).toEqual({ start: "2026-08-01", end: "2026-09-01" });
  });

  it("rolls over December into the next year", () => {
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });

  it("rejects malformed months", () => {
    expect(monthRange("2026-13")).toBeNull();
    expect(monthRange("2026-00")).toBeNull();
    expect(monthRange("nope")).toBeNull();
  });
});

describe("cleanJourney", () => {
  it("rejects unknown statuses and non-objects", () => {
    expect(cleanJourney({ status: "vaporised" })).toBeNull();
    expect(cleanJourney(null)).toBeNull();
    expect(cleanJourney("delayed")).toBeNull();
  });

  it("accepts every real status, including walked", () => {
    for (const status of ["ontime", "delayed", "cancelled", "walked"]) {
      expect(cleanJourney({ status })?.status).toBe(status);
    }
  });

  describe("delay minutes", () => {
    it("coerces numeric strings and keeps valid values", () => {
      expect(cleanJourney({ status: "delayed", mins: "25" })?.mins).toBe(25);
      expect(cleanJourney({ status: "delayed", mins: 1 })?.mins).toBe(1);
      expect(cleanJourney({ status: "delayed", mins: 1440 })?.mins).toBe(1440);
    });

    it("drops floats, negatives, zero and values beyond a day", () => {
      expect(cleanJourney({ status: "delayed", mins: 25.5 })?.mins).toBeUndefined();
      expect(cleanJourney({ status: "delayed", mins: -5 })?.mins).toBeUndefined();
      expect(cleanJourney({ status: "delayed", mins: 0 })?.mins).toBeUndefined();
      expect(cleanJourney({ status: "delayed", mins: 9999 })?.mins).toBeUndefined();
    });

    it("drops minutes on non-delayed journeys", () => {
      expect(cleanJourney({ status: "ontime", mins: 10 })?.mins).toBeUndefined();
      expect(cleanJourney({ status: "cancelled", mins: 10 })?.mins).toBeUndefined();
    });

    it("requires minutes for delayed journeys when asked to", () => {
      expect(cleanJourney({ status: "delayed" }, { requireDelayMins: true })).toBeNull();
      expect(cleanJourney({ status: "delayed", mins: 25 }, { requireDelayMins: true })?.mins).toBe(25);
      expect(cleanJourney({ status: "ontime" }, { requireDelayMins: true })?.status).toBe("ontime");
    });

    it("tolerates missing minutes without the flag (legacy imports)", () => {
      expect(cleanJourney({ status: "delayed" })?.status).toBe("delayed");
    });
  });

  describe("departure time", () => {
    it("keeps strict 24h times including edges", () => {
      expect(cleanJourney({ status: "ontime", depTime: "08:12" })?.depTime).toBe("08:12");
      expect(cleanJourney({ status: "ontime", depTime: "00:00" })?.depTime).toBe("00:00");
      expect(cleanJourney({ status: "ontime", depTime: "23:59" })?.depTime).toBe("23:59");
    });

    it("drops invalid times", () => {
      expect(cleanJourney({ status: "ontime", depTime: "25:99" })?.depTime).toBeUndefined();
      expect(cleanJourney({ status: "ontime", depTime: "7:43" })?.depTime).toBeUndefined();
    });
  });

  describe("text fields", () => {
    it("trims and caps label and places", () => {
      expect(cleanJourney({ status: "ontime", label: "  " + "x".repeat(80) })?.label?.length).toBe(60);
      expect(cleanJourney({ status: "ontime", origin: "x".repeat(80) })?.origin?.length).toBe(40);
      expect(cleanJourney({ status: "ontime", label: "   " })?.label).toBeUndefined();
    });

    it("keeps the excuse only where failure occurred", () => {
      expect(cleanJourney({ status: "delayed", reason: " awaiting crew " })?.reason).toBe("awaiting crew");
      expect(cleanJourney({ status: "cancelled", reason: "x".repeat(100) })?.reason?.length).toBe(80);
      expect(cleanJourney({ status: "ontime", reason: "no excuse needed" })?.reason).toBeUndefined();
      expect(cleanJourney({ status: "walked", reason: "self-evident" })?.reason).toBeUndefined();
    });
  });
});

describe("journeyDesc", () => {
  it("composes time and route fragments", () => {
    expect(journeyDesc({ depTime: "08:12", origin: "St Pancras", destination: "Bedford" })).toBe(
      "08:12 St Pancras → Bedford"
    );
    expect(journeyDesc({ destination: "Bedford" })).toBe("to Bedford");
    expect(journeyDesc({ origin: "St Pancras" })).toBe("from St Pancras");
    expect(journeyDesc({ depTime: "08:12" })).toBe("08:12");
  });

  it("falls back to the legacy label only when structure is absent", () => {
    expect(journeyDesc({ label: "the 07:43 saga" })).toBe("the 07:43 saga");
    expect(journeyDesc({ depTime: "08:12", label: "old text" })).toBe("08:12");
    expect(journeyDesc({})).toBe("");
  });
});

describe("normalizeTime", () => {
  it("coerces casual input to HH:MM", () => {
    expect(normalizeTime("743")).toBe("07:43");
    expect(normalizeTime("1907")).toBe("19:07");
    expect(normalizeTime("7:43")).toBe("07:43");
    expect(normalizeTime("19.07")).toBe("19:07");
    expect(normalizeTime("07:43")).toBe("07:43");
  });

  it("returns unsalvageable input as typed for the form to flag", () => {
    expect(normalizeTime("25:00")).toBe("25:00");
    expect(normalizeTime("9:5")).toBe("9:5");
    expect(normalizeTime("  ")).toBe("");
  });
});

describe("maskTime", () => {
  it("inserts the colon as digits arrive", () => {
    expect(maskTime("0743")).toBe("07:43");
    expect(maskTime("074")).toBe("07:4");
    expect(maskTime("07")).toBe("07"); // no trailing colon — backspace friendly
    expect(maskTime("7")).toBe("7");
  });

  it("pads impossible two-digit hours", () => {
    expect(maskTime("74")).toBe("07:4");
    expect(maskTime("743")).toBe("07:43");
  });

  it("handles paste, garbage and overflow", () => {
    expect(maskTime("19:07")).toBe("19:07");
    expect(maskTime("a7bc4d3")).toBe("07:43");
    expect(maskTime("194512")).toBe("19:45");
    expect(maskTime("")).toBe("");
  });
});
