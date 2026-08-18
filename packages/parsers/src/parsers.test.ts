import type { LogLine, ParserContext, ParserSource } from "@traceframe/parser-sdk";
import { describe, expect, it } from "vitest";
import { dockerParser, jsonlParser, kubernetesParser, plainParser, syslogParser } from "./index.js";

const source: ParserSource = { id: "api", name: "api.log", path: "/tmp/api.log" };

async function* lines(values: string[]): AsyncIterable<LogLine> {
  for (const [index, text] of values.entries()) yield { text, lineNumber: index + 1 };
}

function context(values: string[], laneField?: string): ParserContext {
  return {
    source,
    lines: lines(values),
    ...(laneField ? { laneField } : {})
  };
}

describe("plainParser", () => {
  it("parses timestamped logs and joins stack trace lines", async () => {
    const events = [];
    for await (const event of plainParser.parse(context([
      "2026-08-18T12:01:03.120Z INFO request started request_id=req-42",
      "  at handler.ts:10",
      "2026-08-18T12:01:03.782Z ERROR database timeout request_id=req-42"
    ]))) events.push(event);

    expect(events).toHaveLength(2);
    expect(events[0]?.message).toContain("handler.ts:10");
    expect(events[0]?.correlationIds).toEqual(["req-42"]);
    expect(events[1]?.level).toBe("error");
  });
});

describe("jsonlParser", () => {
  it("uses structured lane, level and correlation fields", async () => {
    const events = [];
    for await (const event of jsonlParser.parse(context([
      JSON.stringify({ timestamp: "2026-08-18T12:01:03.120Z", service: "worker", level: "warning", message: "retrying", trace_id: "abc123" })
    ]))) events.push(event);

    expect(events[0]).toMatchObject({ lane: "worker", level: "warn", correlationIds: ["abc123"] });
  });
});

describe("syslogParser", () => {
  it("parses RFC 3164 and RFC 5424 records", async () => {
    const events = [];
    for await (const event of syslogParser.parse(context([
      "<165>Aug 18 12:01:03 gateway auth[321]: login accepted request_id=req-9",
      "<35>1 2026-08-18T12:01:04.000Z gateway api 42 ID47 - request failed trace_id=trace-4"
    ]))) events.push(event);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ lane: "auth", level: "info", correlationIds: ["req-9"] });
    expect(events[0]?.fields).toMatchObject({ hostname: "gateway", processId: "321" });
    expect(events[1]).toMatchObject({ lane: "api", level: "error", correlationIds: ["trace-4"] });
  });
});

describe("dockerParser", () => {
  it("parses Docker json-file records", async () => {
    const events = [];
    for await (const event of dockerParser.parse(context([
      JSON.stringify({ log: "WARN retrying request_id=req-12\n", stream: "stderr", time: "2026-08-18T12:01:03.000Z", container_name: "api" })
    ]))) events.push(event);

    expect(events[0]).toMatchObject({ lane: "api", level: "warn", message: "WARN retrying request_id=req-12", correlationIds: ["req-12"] });
  });
});

describe("kubernetesParser", () => {
  it("parses CRI records and joins partial payloads", async () => {
    const events = [];
    for await (const event of kubernetesParser.parse(context([
      "2026-08-18T12:01:03.000000000Z stdout P {\"service\":\"worker\",\"level\":\"info\",\"message\":\"job ",
      "2026-08-18T12:01:03.001000000Z stdout F started\",\"job_id\":\"job-71\"}",
      "2026-08-18T12:01:04.000000000Z stderr F ERROR pod crashed request_id=req-71"
    ]))) events.push(event);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ lane: "worker", level: "info", message: "job started", correlationIds: ["job-71"] });
    expect(events[1]).toMatchObject({ lane: "api.log", level: "error", correlationIds: ["req-71"] });
  });
});
