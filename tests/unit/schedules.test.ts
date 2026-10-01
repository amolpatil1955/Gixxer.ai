import { describe, expect, it } from "vitest";
import { describeCadence, isValidTimeZone, nextRunAfter, wallTimeIn, wallTimeToInstant } from "@/lib/schedules/timing";

describe("schedule timing", () => {
  it("converts a wall-clock time in a zone to the right instant, across a DST change", () => {
    // Berlin, 30 March 2026, 03:30 local is 01:30 UTC (summer time started at 02:00 that morning).
    const summer = wallTimeToInstant({ year: 2026, month: 3, day: 30, hour: 3, minute: 30 }, "Europe/Berlin");
    expect(summer.toISOString()).toBe("2026-03-30T01:30:00.000Z");
    // The day before the change, 03:30 local is 02:30 UTC.
    const winter = wallTimeToInstant({ year: 2026, month: 3, day: 28, hour: 3, minute: 30 }, "Europe/Berlin");
    expect(winter.toISOString()).toBe("2026-03-28T02:30:00.000Z");
  });

  it("reads the wall clock back in the zone", () => {
    const wall = wallTimeIn(new Date("2026-09-30T23:30:00.000Z"), "Asia/Kolkata");
    expect(wall).toMatchObject({ year: 2026, month: 10, day: 1, hour: 5, minute: 0, weekday: 4 });
  });

  it("schedules a daily run for today when the time has not passed, otherwise tomorrow", () => {
    const from = new Date("2026-09-30T06:00:00.000Z"); // 08:00 in Berlin
    expect(nextRunAfter(from, { cadence: "daily", hour: 9, minute: 0, timeZone: "Europe/Berlin" }).toISOString()).toBe("2026-09-30T07:00:00.000Z");
    expect(nextRunAfter(from, { cadence: "daily", hour: 7, minute: 0, timeZone: "Europe/Berlin" }).toISOString()).toBe("2026-10-01T05:00:00.000Z");
  });

  it("skips weekends for weekday schedules", () => {
    const friday = new Date("2026-10-02T20:00:00.000Z"); // Friday evening in London
    expect(nextRunAfter(friday, { cadence: "weekdays", hour: 8, minute: 0, timeZone: "Europe/London" }).toISOString()).toBe("2026-10-05T07:00:00.000Z");
  });

  it("keeps the weekday for weekly runs and clamps monthly runs to short months", () => {
    const wednesday = new Date("2026-09-30T12:00:00.000Z");
    const weekly = nextRunAfter(wednesday, { cadence: "weekly", hour: 9, minute: 0, timeZone: "UTC", weekday: 3 });
    expect(weekly.toISOString()).toBe("2026-10-07T09:00:00.000Z");
    const monthly = nextRunAfter(new Date("2026-01-31T12:00:00.000Z"), { cadence: "monthly", hour: 9, minute: 0, timeZone: "UTC", dayOfMonth: 31 });
    expect(monthly.toISOString()).toBe("2026-02-28T09:00:00.000Z");
  });

  it("validates zones and describes cadences", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(describeCadence("weekly", 1, 5)).toBe("every Monday");
    expect(describeCadence("monthly", 1, 5)).toBe("on day 5 of every month");
  });
});
