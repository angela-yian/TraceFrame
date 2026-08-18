import type { LogLevel, LogParser, ParserContext, ParserSample, TraceEvent } from "@traceframe/parser-sdk";
import { correlationsFromRecord, correlationsFromText, detectLevel, normalizeLevel } from "./fields.js";
import { normalizeTimestampValue } from "./timestamp.js";

interface CriRecord {
  lineNumber: number;
  message: string;
  raw: string;
  stream: "stdout" | "stderr";
  tag: "F" | "P";
  timestamp: number;
  timestampRaw: string;
}

function parseCriLine(text: string, lineNumber: number): CriRecord | undefined {
  const match = /^(\S+)\s+(stdout|stderr)\s+([FP])\s(.*)$/.exec(text);
  if (!match?.[1] || (match[2] !== "stdout" && match[2] !== "stderr") || (match[3] !== "F" && match[3] !== "P")) {
    return undefined;
  }
  const timestamp = normalizeTimestampValue(match[1]);
  if (timestamp === undefined) return undefined;
  return {
    timestamp,
    timestampRaw: match[1],
    stream: match[2],
    tag: match[3],
    message: match[4] ?? "",
    raw: text,
    lineNumber
  };
}

function payloadFromMessage(message: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(message);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
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

function eventFromRecord(context: ParserContext, record: CriRecord): TraceEvent {
  const payload = payloadFromMessage(record.message);
  const message = payload
    ? stringField(payload, ["message", "msg", "log", "event"]) ?? record.message
    : record.message;
  const configuredLane = context.laneField && payload ? payload[context.laneField] : undefined;
  const lane = typeof configuredLane === "string"
    ? configuredLane
    : payload
      ? stringField(payload, ["service", "container", "pod", "pod_name", "logger"]) ?? context.source.name
      : context.source.name;
  const payloadLevel = payload ? normalizeLevel(payload.level ?? payload.severity) : undefined;
  const level: LogLevel | undefined = payloadLevel ?? detectLevel(message) ?? (record.stream === "stderr" ? "error" : undefined);
  const fields: Record<string, unknown> = {
    stream: record.stream,
    criTag: record.tag,
    ...(payload ?? {})
  };
  const correlationIds = new Set([
    ...(payload ? correlationsFromRecord(payload) : []),
    ...correlationsFromText(message)
  ]);

  return {
    id: `${context.source.id}:${record.lineNumber}`,
    timestamp: record.timestamp,
    timestampRaw: record.timestampRaw,
    source: context.source.name,
    lane,
    ...(level ? { level } : {}),
    message,
    fields,
    correlationIds: [...correlationIds],
    ...(context.source.path ? { filePath: context.source.path } : {}),
    lineNumber: record.lineNumber,
    raw: record.raw
  };
}

export const kubernetesParser: LogParser = {
  id: "kubernetes",
  name: "Kubernetes CRI log",

  detect(sample: ParserSample): number {
    const nonEmpty = sample.lines.filter((line) => line.text.trim());
    if (nonEmpty.length === 0) return 0;
    const matching = nonEmpty.filter((line) => parseCriLine(line.text, line.lineNumber)).length;
    return matching === 0 ? 0 : Math.min(1, matching / nonEmpty.length);
  },

  async *parse(context: ParserContext): AsyncIterable<TraceEvent> {
    const partialByStream = new Map<CriRecord["stream"], CriRecord>();

    for await (const line of context.lines) {
      const record = parseCriLine(line.text, line.lineNumber);
      if (!record) continue;
      const partial = partialByStream.get(record.stream);

      if (record.tag === "P") {
        partialByStream.set(record.stream, partial ? {
          ...partial,
          message: partial.message + record.message,
          raw: `${partial.raw}\n${record.raw}`
        } : record);
        continue;
      }

      if (partial) {
        partialByStream.delete(record.stream);
        yield eventFromRecord(context, {
          ...partial,
          tag: "F",
          message: partial.message + record.message,
          raw: `${partial.raw}\n${record.raw}`
        });
      } else {
        yield eventFromRecord(context, record);
      }
    }

    for (const partial of partialByStream.values()) yield eventFromRecord(context, partial);
  }
};
