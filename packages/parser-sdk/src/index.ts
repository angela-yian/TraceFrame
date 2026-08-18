export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface TraceEvent {
  id: string;
  timestamp: number;
  timestampRaw: string;
  source: string;
  lane: string;
  level?: LogLevel;
  message: string;
  fields: Record<string, unknown>;
  correlationIds: string[];
  filePath?: string;
  lineNumber?: number;
  raw: string;
}

export interface LogLine {
  text: string;
  lineNumber: number;
}

export interface ParserSource {
  id: string;
  name: string;
  path?: string;
}

export interface ParserSample {
  source: ParserSource;
  lines: readonly LogLine[];
}

export interface ParserContext {
  source: ParserSource;
  lines: AsyncIterable<LogLine>;
  laneField?: string;
}

export interface LogParser {
  id: string;
  name: string;
  detect(input: ParserSample): number;
  parse(context: ParserContext): AsyncIterable<TraceEvent>;
}

export interface ParserSelection {
  parserId: string;
  parserName: string;
  confidence: number;
}

export interface ParseStats {
  files: number;
  lines: number;
  parsedEvents: number;
  unparsedLines: number;
  detectedParsers: ParserSelection[];
  correlationIds: number;
  startedAt?: number;
  endedAt?: number;
}

export interface TimelineData {
  events: TraceEvent[];
  stats: ParseStats;
  generatedAt: string;
}
