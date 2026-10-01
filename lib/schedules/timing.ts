/**
 * When a scheduled prompt runs next. Client-safe and pure, so the browser can
 * show "next run" while the user is still filling in the form and the server
 * can compute the same instant when a run completes.
 *
 * Wall-clock times live in the owner's IANA zone. Converting a wall time to
 * an instant without a library takes two passes: guess the UTC instant, read
 * back the zone's offset at that guess, and correct once. Around a DST change
 * the second pass lands on the right side of the gap.
 */

export type Cadence = "daily" | "weekdays" | "weekly" | "monthly";

export const CADENCES: readonly Cadence[] = ["daily", "weekdays", "weekly", "monthly"];

export const CADENCE_LABELS: Record<Cadence, string> = {
  daily: "Every day",
  weekdays: "Weekdays",
  weekly: "Every week",
  monthly: "Every month",
};

export function isCadence(value: unknown): value is Cadence {
  return typeof value === "string" && (CADENCES as readonly string[]).includes(value);
}

interface WallTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The wall clock in `zone` at `instant`. */
export function wallTimeIn(instant: Date, zone: string): WallTime {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
  }).formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const weekday = WEEKDAYS.indexOf(parts.find((part) => part.type === "weekday")?.value ?? "Sun");
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute"), weekday: Math.max(0, weekday) };
}

/** Offset of `zone` from UTC at `instant`, in minutes. */
function offsetMinutes(instant: Date, zone: string): number {
  const wall = wallTimeIn(instant, zone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** The instant at which `zone`'s clocks show the given wall date and time. */
export function wallTimeToInstant(wall: { year: number; month: number; day: number; hour: number; minute: number }, zone: string): Date {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  const guess = new Date(naive - offsetMinutes(new Date(naive), zone) * 60_000);
  return new Date(naive - offsetMinutes(guess, zone) * 60_000);
}

function addDays(wall: WallTime, days: number): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/**
 * The first run at or after `from`: the next time the wall clock in `zone`
 * reads `hour:minute` on a day the cadence allows. Weekly runs keep the
 * weekday of `from`; monthly runs keep its day of month, clamped to shorter
 * months.
 */
export function nextRunAfter(from: Date, input: { cadence: Cadence; hour: number; minute: number; timeZone: string; weekday?: number; dayOfMonth?: number }): Date {
  const zone = input.timeZone;
  const now = wallTimeIn(from, zone);
  const weekday = input.weekday ?? now.weekday;
  const dayOfMonth = input.dayOfMonth ?? now.day;
  for (let offset = 0; offset < 62; offset++) {
    const day = addDays(now, offset);
    const candidate = wallTimeToInstant({ ...day, hour: input.hour, minute: input.minute }, zone);
    if (candidate.getTime() <= from.getTime()) continue;
    const candidateWall = wallTimeIn(candidate, zone);
    const allowed =
      input.cadence === "daily" ||
      (input.cadence === "weekdays" && candidateWall.weekday >= 1 && candidateWall.weekday <= 5) ||
      (input.cadence === "weekly" && candidateWall.weekday === weekday) ||
      (input.cadence === "monthly" && candidateWall.day === Math.min(dayOfMonth, daysInMonth(candidateWall.year, candidateWall.month)));
    if (allowed) return candidate;
  }
  // Unreachable for any real zone: every cadence recurs within 62 days.
  return new Date(from.getTime() + 86_400_000);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function describeCadence(cadence: Cadence, weekday: number, dayOfMonth: number): string {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  switch (cadence) {
    case "daily":
      return "every day";
    case "weekdays":
      return "every weekday";
    case "weekly":
      return `every ${names[weekday] ?? "week"}`;
    case "monthly":
      return `on day ${dayOfMonth} of every month`;
  }
}
