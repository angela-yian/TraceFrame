import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TimelineData } from "@traceframe/parser-sdk";
import { afterEach, describe, expect, it } from "vitest";
import { exportStandaloneHtml } from "./index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("exportStandaloneHtml", () => {
  it("inlines assets and safely embeds timeline data", async () => {
    const directory = await mkdtemp(join(tmpdir(), "traceframe-export-"));
    temporaryDirectories.push(directory);
    const assets = join(directory, "assets");
    await mkdir(assets);
    await writeFile(join(directory, "index.html"), `<!doctype html><html><head><script type="module" src="/assets/app.js"></script><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div></body></html>`);
    await writeFile(join(assets, "app.js"), "globalThis.TRACEFRAME_BOOTED=true;");
    await writeFile(join(assets, "app.css"), "body{background:#080a0f}");

    const data: TimelineData = {
      events: [{
        id: "event-1",
        timestamp: 1,
        timestampRaw: "1",
        source: "test.log",
        lane: "test.log",
        message: "</script><script>alert('unsafe')</script>",
        fields: {},
        correlationIds: [],
        filePath: "/Users/private/source/test.log",
        raw: "unsafe"
      }],
      stats: {
        files: 1,
        lines: 1,
        parsedEvents: 1,
        unparsedLines: 0,
        detectedParsers: [],
        correlationIds: 0
      },
      generatedAt: "2026-08-18T00:00:00.000Z"
    };

    const outputPath = join(directory, "incident.html");
    const result = await exportStandaloneHtml({ data, outputPath, publicDirectory: directory });
    const html = await readFile(outputPath, "utf8");

    expect(result.bytes).toBeGreaterThan(100);
    expect(html).toContain("globalThis.__TRACEFRAME_DATA__=");
    expect(html).toContain("globalThis.TRACEFRAME_BOOTED=true");
    expect(html).toContain("body{background:#080a0f}");
    expect(html).toContain("\\u003c/script\\u003e");
    expect(html).not.toContain("/Users/private/source/test.log");
    expect(html).not.toContain("src=\"/assets/");
    expect(html).not.toContain("href=\"/assets/");
    expect(html.indexOf("globalThis.__TRACEFRAME_DATA__=")).toBeLessThan(html.indexOf("globalThis.TRACEFRAME_BOOTED=true"));
  });
});
