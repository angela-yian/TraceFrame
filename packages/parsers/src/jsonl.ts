import type { LogLevel, LogParser, ParserContext, ParserSample, TraceEvent } from "@traceframe/parser-sdk";
import { correlationsFromRecord, correlationsFromText, normalizeLevel } from "./fields.js";
import { normalizeTimestampValue } from "./timestamp.js";

const TIMESTAMP_KEYS = ["timestamp", "@timestamp", "time", "datetime", "date", "ts"];
const MESSAGE_KEYS = ["message", "msg", "log", "event"];
const LANE_KEYS = ["service", "service_name", "container", "process", "thread", "logger"];
const LEVEL_KEYS = ["level", "severity", "loglevel", "log_level"];

function firstValue(record: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function parseRecord(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function timestampFor(record: Record<string, unknown>): { raw: string; value: number } | undefined {
  const rawValue = firstValue(record, TIMESTAMP_KEYS);
  const value = normalizeTimestampValue(rawValue);
  return value === undefined ? undefined : { raw: String(rawValue), value };
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

export const jsonlParser: LogParser = {
  id: "jsonl",
  name: "JSON Lines",

  detect(sample: ParserSample): number {
    const nonEmpty = sample.lines.filter((line) => line.text.trim());
    if (nonEmpty.length === 0) return 0;
    let objects = 0;
    let timestamped = 0;
    for (const line of nonEmpty) {
      const record = parseRecord(line.text);
      if (!record) continue;
      objects += 1;
      if (timestampFor(record)) timestamped += 1;
    }
    if (objects === 0) return 0;
    return Math.min(1, objects / nonEmpty.length * 0.35 + timestamped / nonEmpty.length * 0.65);
  },

  async *parse(context: ParserContext): AsyncIterable<TraceEvent> {
    for await (const line of context.lines) {
      const record = parseRecord(line.text);
      if (!record) continue;
      const timestamp = timestampFor(record);
      if (!timestamp) continue;

      const message = stringValue(firstValue(record, MESSAGE_KEYS)) ?? line.text;
      const configuredLane = context.laneField ? stringValue(record[context.laneField]) : undefined;
      const lane = configuredLane ?? stringValue(firstValue(record, LANE_KEYS)) ?? context.source.name;
      const level = normalizeLevel(firstValue(record, LEVEL_KEYS));
      const correlationIds = new Set([
        ...correlationsFromRecord(record),
        ...correlationsFromText(message)
      ]);

      const event: TraceEvent = {
        id: `${context.source.id}:${line.lineNumber}`,
        timestamp: timestamp.value,
        timestampRaw: timestamp.raw,
        source: context.source.name,
        lane,
        ...(level ? { level: level as LogLevel } : {}),
        message,
        fields: record,
        correlationIds: [...correlationIds],
        ...(context.source.path ? { filePath: context.source.path } : {}),
        lineNumber: line.lineNumber,
        raw: line.text
      };

      yield event;
    }
  }
};
