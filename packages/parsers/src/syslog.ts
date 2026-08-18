import type { LogLevel, LogParser, ParserContext, ParserSample, TraceEvent } from "@traceframe/parser-sdk";
import { correlationsFromText, detectLevel } from "./fields.js";
import { normalizeTimestampValue, parseLineTimestamp } from "./timestamp.js";

interface SyslogRecord {
  app: string;
  fields: Record<string, unknown>;
  hostname: string;
  level?: LogLevel;
  message: string;
  timestamp: number;
  timestampRaw: string;
}

function levelFromPriority(priority: number): LogLevel {
  const severity = priority % 8;
  if (severity <= 2) return "fatal";
  if (severity === 3) return "error";
  if (severity === 4) return "warn";
  if (severity <= 6) return "info";
  return "debug";
}

function parseRfc5424(text: string): SyslogRecord | undefined {
  const match = /^<(\d{1,3})>(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(-|\[[^\]]*\])\s*(.*)$/.exec(text);
  if (!match?.[1] || !match[3] || !match[4] || !match[5]) return undefined;
  const timestamp = normalizeTimestampValue(match[3]);
  if (timestamp === undefined) return undefined;

  const priority = Number(match[1]);
  const message = match[9] ?? "";
  return {
    app: match[5],
    hostname: match[4],
    timestamp,
    timestampRaw: match[3],
    message,
    level: levelFromPriority(priority),
    fields: {
      priority,
      facility: Math.floor(priority / 8),
      version: Number(match[2]),
      hostname: match[4],
      app: match[5],
      processId: match[6],
      messageId: match[7],
      structuredData: match[8]
    }
  };
}

function parseRfc3164(text: string): SyslogRecord | undefined {
  const match = /^(?:<(\d{1,3})>)?([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^\s:\[]+)(?:\[(\d+)\])?:\s*(.*)$/.exec(text);
  if (!match?.[2] || !match[3] || !match[4]) return undefined;
  const parsedTimestamp = parseLineTimestamp(match[2]);
  if (!parsedTimestamp) return undefined;

  const priority = match[1] ? Number(match[1]) : undefined;
  const message = match[6] ?? "";
  const detectedLevel = detectLevel(message);
  const level = priority === undefined ? detectedLevel : levelFromPriority(priority);
  return {
    app: match[4],
    hostname: match[3],
    timestamp: parsedTimestamp.timestamp,
    timestampRaw: match[2],
    message,
    ...(level ? { level } : {}),
    fields: {
      ...(priority === undefined ? {} : { priority, facility: Math.floor(priority / 8) }),
      hostname: match[3],
      app: match[4],
      ...(match[5] ? { processId: match[5] } : {})
    }
  };
}

function parseSyslog(text: string): SyslogRecord | undefined {
  return parseRfc5424(text) ?? parseRfc3164(text);
}

export const syslogParser: LogParser = {
  id: "syslog",
  name: "Syslog (RFC 3164 / RFC 5424)",

  detect(sample: ParserSample): number {
    const nonEmpty = sample.lines.filter((line) => line.text.trim());
    if (nonEmpty.length === 0) return 0;
    const matching = nonEmpty.filter((line) => parseSyslog(line.text)).length;
    return matching === 0 ? 0 : Math.min(0.99, matching / nonEmpty.length);
  },

  async *parse(context: ParserContext): AsyncIterable<TraceEvent> {
    for await (const line of context.lines) {
      const record = parseSyslog(line.text);
      if (!record) continue;
      const configuredLane = context.laneField ? record.fields[context.laneField] : undefined;
      const lane = typeof configuredLane === "string" ? configuredLane : record.app;

      yield {
        id: `${context.source.id}:${line.lineNumber}`,
        timestamp: record.timestamp,
        timestampRaw: record.timestampRaw,
        source: context.source.name,
        lane,
        ...(record.level ? { level: record.level } : {}),
        message: record.message,
        fields: record.fields,
        correlationIds: correlationsFromText(record.message),
        ...(context.source.path ? { filePath: context.source.path } : {}),
        lineNumber: line.lineNumber,
        raw: line.text
      };
    }
  }
};
