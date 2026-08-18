import { builtInParsers } from "@traceframe/parsers";
import { describe, expect, it } from "vitest";
import { inputFromLines } from "./input.js";
import { parseInputs } from "./parse.js";

describe("parseInputs", () => {
  it("detects parsers and sorts events from multiple sources", async () => {
    const plain = inputFromLines("api.log", [
      "2026-08-18T12:01:04.000Z ERROR API finished request_id=req-7",
      "  at api.ts:42"
    ]);
    const jsonl = inputFromLines("database.jsonl", [
      JSON.stringify({ timestamp: "2026-08-18T12:01:03.000Z", service: "database", message: "query started", request_id: "req-7" })
    ]);

    const result = await parseInputs([plain, jsonl], builtInParsers);

    expect(result.events.map((event) => event.lane)).toEqual(["database", "api.log"]);
    expect(result.stats.detectedParsers.map((parser) => parser.parserId)).toEqual(["plain", "jsonl"]);
    expect(result.stats.correlationIds).toBe(1);
    expect(result.stats.unparsedLines).toBe(0);
  });

  it("prefers specialized container and syslog parsers", async () => {
    const docker = inputFromLines("docker.log", [
      JSON.stringify({ log: "service ready\n", stream: "stdout", time: "2026-08-18T12:01:03.000Z" })
    ]);
    const kubernetes = inputFromLines("pod.log", [
      "2026-08-18T12:01:04.000000000Z stdout F pod ready"
    ]);
    const syslog = inputFromLines("system.log", [
      "Aug 18 12:01:05 host daemon[9]: service ready"
    ]);

    const result = await parseInputs([docker, kubernetes, syslog], builtInParsers);
    expect(result.stats.detectedParsers.map((parser) => parser.parserId)).toEqual([
      "docker",
      "kubernetes",
      "syslog"
    ]);
  });
});
