import type { LogParser, ParserContext, ParserSample, TraceEvent } from "@traceframe/parser-sdk";
import { correlationsFromText, detectLevel } from "./fields.js";
import { parseLineTimestamp } from "./timestamp.js";

function eventFromLine(context: ParserContext, text: string, lineNumber: number): TraceEvent | undefined {
  const timestamp = parseLineTimestamp(text);
  if (!timestamp) return undefined;

  const message = text
    .slice(timestamp.endIndex)
    .replace(/^\]\s*/, "")
    .replace(/^\s*[-|:]\s*/, "")
    .trim();
  const level = detectLevel(message);

  return {
    id: `${context.source.id}:${lineNumber}`,
    timestamp: timestamp.timestamp,
    timestampRaw: timestamp.raw,
    source: context.source.name,
    lane: context.source.name,
    ...(level ? { level } : {}),
    message: message || text.trim(),
    fields: {},
    correlationIds: correlationsFromText(text),
    ...(context.source.path ? { filePath: context.source.path } : {}),
    lineNumber,
    raw: text
  };
}

export const plainParser: LogParser = {
  id: "plain",
  name: "Plain timestamped log",

  detect(sample: ParserSample): number {
    const nonEmpty = sample.lines.filter((line) => line.text.trim());
    if (nonEmpty.length === 0) return 0;
    const timestamped = nonEmpty.filter((line) => parseLineTimestamp(line.text)).length;
    return Math.min(0.95, timestamped / nonEmpty.length);
  },

  async *parse(context: ParserContext): AsyncIterable<TraceEvent> {
    let pending: TraceEvent | undefined;

    for await (const line of context.lines) {
      const event = eventFromLine(context, line.text, line.lineNumber);
      if (event) {
        if (pending) yield pending;
        pending = event;
      } else if (pending && line.text.trim()) {
        pending = {
          ...pending,
          message: `${pending.message}\n${line.text}`,
          raw: `${pending.raw}\n${line.text}`
        };
      }
    }

    if (pending) yield pending;
  }
};
