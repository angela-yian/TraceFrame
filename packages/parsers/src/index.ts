import type { LogParser } from "@traceframe/parser-sdk";
import { dockerParser } from "./docker.js";
import { jsonlParser } from "./jsonl.js";
import { kubernetesParser } from "./kubernetes.js";
import { plainParser } from "./plain.js";
import { syslogParser } from "./syslog.js";

export { dockerParser } from "./docker.js";
export { jsonlParser } from "./jsonl.js";
export { kubernetesParser } from "./kubernetes.js";
export { plainParser } from "./plain.js";
export { syslogParser } from "./syslog.js";
export { normalizeTimestampValue, parseLineTimestamp } from "./timestamp.js";

export const builtInParsers: readonly LogParser[] = [
  dockerParser,
  kubernetesParser,
  syslogParser,
  jsonlParser,
  plainParser
];

export function getParser(id: string): LogParser | undefined {
  return builtInParsers.find((parser) => parser.id === id);
}
