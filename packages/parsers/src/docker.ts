import type { LogParser, ParserContext, ParserSample, TraceEvent } from "@traceframe/parser-sdk";
import { correlationsFromRecord, correlationsFromText, detectLevel } from "./fields.js";
import { normalizeTimestampValue } from "./timestamp.js";

function recordFromLine(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    return typeof record.log === "string" &&
      (record.stream === "stdout" || record.stream === "stderr") &&
      normalizeTimestampValue(record.time) !== undefined
      ? record
      : undefined;
  } catch {
    return undefined;
  }
}

function stringField(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

export const dockerParser: LogParser = {
  id: "docker",
  name: "Docker JSON log",

  detect(sample: ParserSample): number {
    const nonEmpty = sample.lines.filter((line) => line.text.trim());
    if (nonEmpty.length === 0) return 0;
    const matching = nonEmpty.filter((line) => recordFromLine(line.text)).length;
    return matching === 0 ? 0 : Math.min(1, matching / nonEmpty.length);
  },

  async *parse(context: ParserContext): AsyncIterable<TraceEvent> {
    for await (const line of context.lines) {
      const record = recordFromLine(line.text);
      if (!record) continue;
      const timestamp = normalizeTimestampValue(record.time);
      if (timestamp === undefined) continue;

      const message = String(record.log).replace(/\r?\n$/, "");
      const configuredLane = context.laneField ? record[context.laneField] : undefined;
      const lane = typeof configuredLane === "string"
        ? configuredLane
        : stringField(record, ["container_name", "container", "service", "name"]) ?? context.source.name;
      const detectedLevel = detectLevel(message);
      const level = detectedLevel ?? (record.stream === "stderr" ? "error" : undefined);
      const correlationIds = new Set([
        ...correlationsFromRecord(record),
        ...correlationsFromText(message)
      ]);

      const event: TraceEvent = {
        id: `${context.source.id}:${line.lineNumber}`,
        timestamp,
        timestampRaw: String(record.time),
        source: context.source.name,
        lane,
        ...(level ? { level } : {}),
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
