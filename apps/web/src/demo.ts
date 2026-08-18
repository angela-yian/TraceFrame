import type { TimelineData, TraceEvent } from "@traceframe/parser-sdk";

const start = Date.parse("2026-08-18T12:01:03.120Z");

function event(
  id: string,
  offset: number,
  lane: string,
  level: TraceEvent["level"],
  message: string,
  correlationIds: string[] = ["req-7f3a"]
): TraceEvent {
  return {
    id,
    timestamp: start + offset,
    timestampRaw: new Date(start + offset).toISOString(),
    source: `${lane.toLowerCase()}.log`,
    lane,
    ...(level ? { level } : {}),
    message,
    fields: { request_id: correlationIds[0], environment: "production" },
    correlationIds,
    filePath: `/logs/${lane.toLowerCase()}.log`,
    lineNumber: Number(id.replace(/\D/g, "")) + 10,
    raw: `${new Date(start + offset).toISOString()} ${level?.toUpperCase() ?? "INFO"} ${message} request_id=${correlationIds[0]}`
  };
}

const events = [
  event("event-1", 0, "Web", "info", "POST /login"),
  event("event-2", 28, "API", "info", "Query user by email"),
  event("event-3", 662, "Database", "error", "Connection pool timeout after 600ms"),
  event("event-4", 664, "API", "warn", "Retrying database query (1/3)"),
  event("event-5", 2_982, "API", "error", "Request failed: database unavailable"),
  event("event-6", 2_988, "Web", "error", "HTTP 500 POST /login"),
  event("event-7", 3_220, "Worker", "debug", "Session cleanup scheduled", ["job-a81c"])
];

export const demoData: TimelineData = {
  events,
  generatedAt: new Date().toISOString(),
  stats: {
    files: 4,
    lines: 7,
    parsedEvents: 7,
    unparsedLines: 0,
    detectedParsers: [
      { parserId: "plain", parserName: "Plain timestamped log", confidence: 1 }
    ],
    correlationIds: 2,
    ...(events[0] ? { startedAt: events[0].timestamp } : {}),
    ...(events.at(-1) ? { endedAt: events.at(-1)!.timestamp } : {})
  }
};
