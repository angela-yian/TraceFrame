import type { LogLevel } from "@traceframe/parser-sdk";

const CORRELATION_KEY = /^(?:request|trace|span|job|transaction|session|thread|correlation)[_-]?id$/i;
const CORRELATION_IN_TEXT = /\b(?:request|trace|span|job|transaction|session|thread|correlation)[_-]?id\s*[=:]\s*["']?([A-Za-z0-9._:/-]{3,128})/gi;

export function normalizeLevel(value: unknown): LogLevel | undefined {
  if (typeof value !== "string") return undefined;
  const level = value.toLowerCase();
  if (level === "warning") return "warn";
  if (level === "critical" || level === "crit" || level === "panic") return "fatal";
  if (["trace", "debug", "info", "warn", "error", "fatal"].includes(level)) {
    return level as LogLevel;
  }
  return undefined;
}

export function detectLevel(message: string): LogLevel | undefined {
  const match = /(?:^|[\s\[])(TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRIT(?:ICAL)?)(?:[\s\]:-]|$)/i.exec(message);
  return normalizeLevel(match?.[1]);
}

export function correlationsFromText(message: string): string[] {
  const ids = new Set<string>();
  for (const match of message.matchAll(CORRELATION_IN_TEXT)) {
    if (match[1]) ids.add(match[1]);
  }
  return [...ids];
}

export function correlationsFromRecord(record: Record<string, unknown>): string[] {
  const ids = new Set<string>();

  const visit = (value: unknown, depth: number): void => {
    if (depth > 3 || !value || typeof value !== "object" || Array.isArray(value)) return;
    for (const [key, fieldValue] of Object.entries(value)) {
      if (CORRELATION_KEY.test(key) && (typeof fieldValue === "string" || typeof fieldValue === "number")) {
        ids.add(String(fieldValue));
      } else {
        visit(fieldValue, depth + 1);
      }
    }
  };

  visit(record, 0);
  return [...ids];
}
