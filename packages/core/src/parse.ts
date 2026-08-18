import type {
  LogLine,
  LogParser,
  ParserSelection,
  TimelineData,
  TraceEvent
} from "@traceframe/parser-sdk";
import type { InputSource } from "./input.js";

const SAMPLE_LIMIT = 100;

export interface ParseOptions {
  parserId?: string;
  laneField?: string;
}

interface DetectionResult {
  parser: LogParser;
  confidence: number;
}

function selectParser(
  source: InputSource,
  sample: readonly LogLine[],
  parsers: readonly LogParser[],
  requestedId?: string
): DetectionResult {
  if (requestedId) {
    const parser = parsers.find((candidate) => candidate.id === requestedId);
    if (!parser) throw new Error(`Unknown parser: ${requestedId}`);
    return { parser, confidence: 1 };
  }

  const ranked = parsers
    .map((parser) => ({ parser, confidence: parser.detect({ source: source.source, lines: sample }) }))
    .sort((a, b) => b.confidence - a.confidence);
  const selected = ranked[0];
  if (!selected || selected.confidence <= 0) {
    throw new Error(`No timestamped events detected in ${source.source.name}`);
  }
  return selected;
}

async function parseOne(
  input: InputSource,
  parsers: readonly LogParser[],
  options: ParseOptions
): Promise<{ events: TraceEvent[]; lines: number; selection: ParserSelection }> {
  const iterator = input.lines()[Symbol.asyncIterator]();
  const sample: LogLine[] = [];

  while (sample.length < SAMPLE_LIMIT) {
    const next = await iterator.next();
    if (next.done) break;
    sample.push(next.value);
  }

  const { parser, confidence } = selectParser(input, sample, parsers, options.parserId);
  let lines = 0;

  async function* allLines(): AsyncIterable<LogLine> {
    for (const line of sample) {
      lines += 1;
      yield line;
    }
    while (true) {
      const next = await iterator.next();
      if (next.done) break;
      lines += 1;
      yield next.value;
    }
  }

  const events: TraceEvent[] = [];
  const context = {
    source: input.source,
    lines: allLines(),
    ...(options.laneField ? { laneField: options.laneField } : {})
  };
  for await (const event of parser.parse(context)) events.push(event);

  return {
    events,
    lines,
    selection: { parserId: parser.id, parserName: parser.name, confidence }
  };
}

export async function parseInputs(
  inputs: readonly InputSource[],
  parsers: readonly LogParser[],
  options: ParseOptions = {}
): Promise<TimelineData> {
  if (inputs.length === 0) throw new Error("No input files were provided.");
  if (parsers.length === 0) throw new Error("No parsers are registered.");

  const events: TraceEvent[] = [];
  const detectedParsers: ParserSelection[] = [];
  let lineCount = 0;

  for (const input of inputs) {
    const result = await parseOne(input, parsers, options);
    events.push(...result.events);
    lineCount += result.lines;
    detectedParsers.push(result.selection);
  }

  events.sort((a, b) =>
    a.timestamp - b.timestamp ||
    a.source.localeCompare(b.source) ||
    (a.lineNumber ?? 0) - (b.lineNumber ?? 0)
  );

  const correlationIds = new Set(events.flatMap((event) => event.correlationIds));
  const parsedLineCount = events.reduce((count, event) => count + event.raw.split("\n").length, 0);
  const startedAt = events[0]?.timestamp;
  const endedAt = events.at(-1)?.timestamp;

  return {
    events,
    generatedAt: new Date().toISOString(),
    stats: {
      files: inputs.length,
      lines: lineCount,
      parsedEvents: events.length,
      unparsedLines: Math.max(0, lineCount - parsedLineCount),
      detectedParsers,
      correlationIds: correlationIds.size,
      ...(startedAt === undefined ? {} : { startedAt }),
      ...(endedAt === undefined ? {} : { endedAt })
    }
  };
}
