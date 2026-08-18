interface TimestampMatch {
  timestamp: number;
  raw: string;
  endIndex: number;
}

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11
};

function valid(timestamp: number, raw: string, endIndex: number): TimestampMatch | undefined {
  return Number.isFinite(timestamp) ? { timestamp, raw, endIndex } : undefined;
}

export function normalizeTimestampValue(value: unknown): number | undefined {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return value < 100_000_000_000 ? value * 1_000 : value;
  }

  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (/^\d{10}(?:\.\d+)?$/.test(trimmed)) return Number(trimmed) * 1_000;
  if (/^\d{13}$/.test(trimmed)) return Number(trimmed);

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseLineTimestamp(line: string, now = new Date()): TimestampMatch | undefined {
  const iso = /^\s*\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)/.exec(line);
  if (iso?.[1]) {
    const raw = iso[1];
    const normalized = raw.includes(" ") ? raw.replace(" ", "T") : raw;
    const match = valid(Date.parse(normalized.replace(",", ".")), raw, iso[0].length);
    if (match) return match;
  }

  const unix = /^\s*\[?(\d{10}(?:\.\d+)?|\d{13})(?=\s|\]|$)/.exec(line);
  if (unix?.[1]) {
    const timestamp = normalizeTimestampValue(unix[1]);
    if (timestamp !== undefined) return { timestamp, raw: unix[1], endIndex: unix[0].length };
  }

  const android = /^\s*\[?(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?/.exec(line);
  if (android) {
    const [, month, day, hour, minute, second, millis = "0"] = android;
    const timestamp = new Date(
      now.getFullYear(),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(millis.padEnd(3, "0"))
    ).getTime();
    const match = valid(timestamp, android[0].trimStart().replace(/^\[/, ""), android[0].length);
    if (match) return match;
  }

  const syslog = /^\s*\[?([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/.exec(line);
  if (syslog?.[1]) {
    const month = MONTHS[syslog[1]];
    if (month !== undefined) {
      const timestamp = new Date(
        now.getFullYear(),
        month,
        Number(syslog[2]),
        Number(syslog[3]),
        Number(syslog[4]),
        Number(syslog[5])
      ).getTime();
      const match = valid(timestamp, syslog[0].trimStart().replace(/^\[/, ""), syslog[0].length);
      if (match) return match;
    }
  }

  const relative = /^\s*\[?(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?/.exec(line);
  if (relative) {
    const [, hour, minute, second, millis = "0"] = relative;
    const timestamp =
      Number(hour) * 3_600_000 +
      Number(minute) * 60_000 +
      Number(second) * 1_000 +
      Number(millis.padEnd(3, "0"));
    return {
      timestamp,
      raw: relative[0].trimStart().replace(/^\[/, ""),
      endIndex: relative[0].length
    };
  }

  return undefined;
}
