export const DAYPART_DEFAULTS = {
  morning: 9,
  afternoon: 15,
  evening: 19,
  tonight: 21,
} as const;

export type RelativeDateResolution = "exact" | "relative" | "ambiguous" | "invalid";

export interface RelativeDateResult {
  iso: string | null;
  resolution: RelativeDateResolution;
  original: string;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const FALLBACK_TIME_ZONE = "UTC";

function validTimeZone(value: string | undefined): string {
  if (!value) return FALLBACK_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function localToUtc(parts: { year: number; month: number; day: number; hour: number; minute: number; second?: number }, timeZone: string): string {
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second ?? 0, 0);
  const shown = localParts(new Date(localAsUtc), timeZone);
  const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second, 0);
  const offset = shownAsUtc - localAsUtc;
  return new Date(localAsUtc - offset).toISOString();
}

function parseClock(value: string | undefined): { hour: number; minute: number } | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else if (hour > 23) return null;
  return { hour, minute };
}

function clockAndDaypart(value: string): { clock: { hour: number; minute: number }; explicit: boolean } | null {
  const at = value.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
  if (at) {
    const clock = parseClock(at[1]);
    return clock ? { clock, explicit: true } : null;
  }
  const daypart = value.match(/\b(morning|afternoon|evening|tonight)\b/i)?.[1].toLowerCase() as keyof typeof DAYPART_DEFAULTS | undefined;
  if (daypart) return { clock: { hour: DAYPART_DEFAULTS[daypart], minute: 0 }, explicit: false };
  return { clock: { hour: 0, minute: 0 }, explicit: false };
}

function naturalParts(value: string, referenceNow: Date, timeZone: string): { parts: { year: number; month: number; day: number; hour: number; minute: number }; phrase: string } | null {
  const text = value.toLowerCase().replace(/\s+/g, " ").trim();
  const current = localParts(referenceNow, timeZone);
  let dayOffset: number | null = null;
  let phrase = "";

  const offsetMatch = text.match(/\b(?:in)\s+(\d+)\s+(day|days|week|weeks)\b/);
  if (offsetMatch) {
    dayOffset = Number(offsetMatch[1]) * (offsetMatch[2].startsWith("week") ? 7 : 1);
    phrase = offsetMatch[0];
  } else {
    const relative = text.match(/\b(today|tomorrow|tonight)(?:\s+(?:at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|morning|afternoon|evening))?\b/i);
    if (relative) {
      dayOffset = relative[1] === "today" || relative[1] === "tonight" ? 0 : 1;
      phrase = relative[0];
    } else {
      const weekday = text.match(/\b(?:(next|this)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+(?:at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|morning|afternoon|evening))?\b/i);
      if (weekday) {
        const target = WEEKDAYS.indexOf(weekday[2].toLowerCase() as (typeof WEEKDAYS)[number]);
        const currentDay = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay();
        let delta = (target - currentDay + 7) % 7;
        if (weekday[1]?.toLowerCase() === "next") {
          // "next" means the weekday in the following Monday-Sunday week,
          // rather than the closest occurrence in the current week.
          const daysToNextMonday = 7 - ((currentDay + 6) % 7);
          delta = daysToNextMonday + ((target + 6) % 7);
        }
        dayOffset = delta;
        phrase = weekday[0];
      }
    }
  }
  if (dayOffset === null) return null;
  const clockInfo = clockAndDaypart(phrase);
  if (!clockInfo) return null;
  if (dayOffset === 0 && clockInfo.clock.hour * 60 + clockInfo.clock.minute <= current.hour * 60 + current.minute && /\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(phrase)) dayOffset = 7;
  const date = new Date(Date.UTC(current.year, current.month - 1, current.day + dayOffset));
  return { parts: { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: clockInfo.clock.hour, minute: clockInfo.clock.minute }, phrase };
}

export function resolveRelativeDate(input: { value: string | null | undefined; referenceNow: Date | string; timeZone?: string }): RelativeDateResult {
  const original = input.value ?? "";
  const value = original.trim();
  if (!value) return { iso: null, resolution: "ambiguous", original };
  const referenceNow = input.referenceNow instanceof Date ? input.referenceNow : new Date(input.referenceNow);
  if (!Number.isFinite(referenceNow.getTime())) return { iso: null, resolution: "invalid", original };
  const timeZone = validTimeZone(input.timeZone);
  if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    try {
      if (dateOnly) {
        const year = Number(dateOnly[1]);
        const month = Number(dateOnly[2]);
        const day = Number(dateOnly[3]);
        const check = new Date(Date.UTC(year, month - 1, day));
        if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return { iso: null, resolution: "invalid", original };
        return { iso: localToUtc({ year, month, day, hour: 0, minute: 0 }, timeZone), resolution: "exact", original };
      }
      const localIso = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
      if (localIso) {
        const year = Number(localIso[1]);
        const month = Number(localIso[2]);
        const day = Number(localIso[3]);
        const hour = Number(localIso[4]);
        const minute = Number(localIso[5]);
        const second = Number(localIso[6] ?? 0);
        const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
        if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return { iso: null, resolution: "invalid", original };
        return { iso: localToUtc({ year, month, day, hour, minute, second }, timeZone), resolution: "exact", original };
      }
      const timestamp = new Date(value).toISOString();
      return { iso: timestamp, resolution: "exact", original };
    } catch {
      return { iso: null, resolution: "invalid", original };
    }
  }
  const parsed = naturalParts(value, referenceNow, timeZone);
  if (!parsed) return { iso: null, resolution: "ambiguous", original };
  return { iso: localToUtc(parsed.parts, timeZone), resolution: "relative", original };
}

export function resolveLifeDateRange(input: {
  startValue: string | null | undefined;
  endValue: string | null | undefined;
  referenceNow: Date | string;
  timeZone?: string;
}) {
  const start = resolveRelativeDate({ value: input.startValue, referenceNow: input.referenceNow, timeZone: input.timeZone });
  const end = resolveRelativeDate({ value: input.endValue, referenceNow: input.referenceNow, timeZone: input.timeZone });
  return {
    startDate: start.iso,
    endDate: start.iso && end.iso && Date.parse(end.iso) < Date.parse(start.iso) ? null : end.iso,
    start,
    end,
  };
}
