import { createReadStream, statSync } from "node:fs";
import { readdir, realpath, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createInterface } from "node:readline";
import type { LogLine, ParserSource } from "@traceframe/parser-sdk";

const MAX_FILE_BYTES = 250 * 1024 * 1024;
const MAX_FILES = 200;

export interface InputSource {
  source: ParserSource;
  lines(): AsyncIterable<LogLine>;
}

async function* readableLines(readable: NodeJS.ReadableStream): AsyncIterable<LogLine> {
  const reader = createInterface({ input: readable, crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const text of reader) {
    lineNumber += 1;
    yield { text, lineNumber };
  }
}

function fileInput(path: string, id: string): InputSource {
  return {
    source: { id, name: basename(path), path },
    lines: () => readableLines(createReadStream(path, { encoding: "utf8" }))
  };
}

function stdinInput(id: string): InputSource {
  return {
    source: { id, name: "stdin" },
    lines: () => readableLines(process.stdin)
  };
}

async function filesInDirectory(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesInDirectory(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

export async function discoverInputs(paths: readonly string[], cwd = process.cwd()): Promise<InputSource[]> {
  const expanded: string[] = [];
  let includesStdin = false;

  for (const input of paths) {
    if (input === "-") {
      if (!includesStdin) expanded.push("-");
      includesStdin = true;
      continue;
    }

    const requestedPath = resolve(cwd, input);
    let info;
    try {
      info = await stat(requestedPath);
    } catch {
      throw new Error(`Input not found: ${input}`);
    }

    if (info.isDirectory()) expanded.push(...await filesInDirectory(requestedPath));
    else if (info.isFile()) expanded.push(await realpath(requestedPath));
  }

  const unique = [...new Set(expanded)];
  if (unique.length > MAX_FILES) {
    throw new Error(`Too many input files (${unique.length}). The current limit is ${MAX_FILES}.`);
  }

  return unique.map((path, index) => {
    if (path === "-") return stdinInput(`stdin-${index + 1}`);
    const size = statSync(path).size;
    if (size > MAX_FILE_BYTES) {
      throw new Error(`Input is larger than 250 MB: ${path}`);
    }
    return fileInput(path, `file-${index + 1}`);
  });
}

export function inputFromLines(name: string, values: readonly string[], id = name): InputSource {
  return {
    source: { id, name },
    async *lines() {
      for (const [index, text] of values.entries()) yield { text, lineNumber: index + 1 };
    }
  };
}
