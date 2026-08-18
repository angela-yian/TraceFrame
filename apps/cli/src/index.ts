import { createServer, type Server } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverInputs, parseInputs } from "@traceframe/core";
import { exportStandaloneHtml } from "@traceframe/exporters";
import type { TimelineData } from "@traceframe/parser-sdk";
import { builtInParsers } from "@traceframe/parsers";
import { Command } from "commander";
import open from "open";
import sirv from "sirv";

interface CliOptions {
  export?: string;
  parser?: string;
  lane?: string;
  open: boolean;
  port: string;
  stats: boolean;
}

const HOST = "127.0.0.1";

function publicDirectory(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "public");
}

function duration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  const seconds = Math.floor(milliseconds / 1_000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function printStats(data: TimelineData): void {
  const { stats } = data;
  const parserNames = [...new Set(stats.detectedParsers.map((parser) => parser.parserName))];
  const range = stats.startedAt !== undefined && stats.endedAt !== undefined
    ? duration(stats.endedAt - stats.startedAt)
    : "n/a";

  console.log([
    `Files:             ${stats.files.toLocaleString()}`,
    `Lines:             ${stats.lines.toLocaleString()}`,
    `Parsed events:     ${stats.parsedEvents.toLocaleString()}`,
    `Unparsed lines:    ${stats.unparsedLines.toLocaleString()}`,
    `Detected parsers:  ${parserNames.join(", ")}`,
    `Time range:        ${range}`,
    `Correlation IDs:   ${stats.correlationIds.toLocaleString()}`
  ].join("\n"));
}

async function listen(server: Server, port: number): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    server.once("error", reject);
    server.listen(port, HOST, () => {
      server.off("error", reject);
      const address = server.address();
      resolvePort(typeof address === "object" && address ? address.port : port);
    });
  });
}

async function serve(data: TimelineData, requestedPort: number): Promise<{ server: Server; url: string }> {
  const assets = sirv(publicDirectory(), { single: true, etag: true });
  const encodedData = JSON.stringify(data).replace(/</g, "\\u003c");

  const server = createServer((request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'");

    const path = new URL(request.url ?? "/", `http://${HOST}`).pathname;
    if (path === "/api/events") {
      response.statusCode = 200;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end(encodedData);
      return;
    }

    assets(request, response);
  });

  const port = await listen(server, requestedPort);
  return { server, url: `http://${HOST}:${port}` };
}

const program = new Command()
  .name("traceframe")
  .description("Turn raw logs into an interactive incident timeline.")
  .version("0.1.0")
  .argument("[inputs...]", "Log files, directories, or - for stdin")
  .option("--parser <id>", "Force a parser (plain, jsonl, syslog, docker, or kubernetes)")
  .option("--lane <field>", "Use a JSON field as the timeline lane")
  .option("--export <path>", "Export a standalone HTML timeline and exit")
  .option("--port <number>", "Local server port; use 0 for an available port", "4318")
  .option("--no-open", "Do not open the browser automatically")
  .option("--stats", "Print parsing statistics")
  .showHelpAfterError()
  .action(async (inputs: string[], options: CliOptions) => {
    if (inputs.length === 0) {
      program.error("At least one input file, directory, or - is required.");
    }

    const sources = await discoverInputs(inputs);
    const data = await parseInputs(sources, builtInParsers, {
      ...(options.parser ? { parserId: options.parser } : {}),
      ...(options.lane ? { laneField: options.lane } : {})
    });

    if (options.stats) printStats(data);
    if (options.export) {
      const result = await exportStandaloneHtml({
        data,
        outputPath: resolve(process.cwd(), options.export),
        publicDirectory: publicDirectory()
      });
      console.log(`Exported standalone timeline to ${result.outputPath}`);
      return;
    }

    const port = Number(options.port);
    if (!Number.isInteger(port) || port < 0 || port > 65_535) {
      program.error("--port must be an integer between 0 and 65535.");
    }

    const { server, url } = await serve(data, port);
    console.log(`TraceFrame is ready at ${url}`);
    console.log("Local only. Press Ctrl+C to stop.");

    const close = (): void => {
      server.close(() => process.exit(0));
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);

    if (options.open) await open(url);
  });

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`traceframe: ${message}`);
  process.exitCode = 1;
});
