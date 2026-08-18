import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import type { TimelineData } from "@traceframe/parser-sdk";

export interface StandaloneHtmlOptions {
  data: TimelineData;
  outputPath: string;
  publicDirectory: string;
}

export interface StandaloneHtmlResult {
  outputPath: string;
  bytes: number;
}

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}=["']([^"']+)["']`, "i").exec(tag)?.[1];
}

function assetPath(publicDirectory: string, url: string): string {
  const cleanUrl = url.split(/[?#]/, 1)[0] ?? url;
  const resolvedPublic = resolve(publicDirectory);
  const resolvedAsset = resolve(resolvedPublic, cleanUrl.replace(/^\/+/, ""));
  const relativeAsset = relative(resolvedPublic, resolvedAsset);

  if (relativeAsset.startsWith(`..${sep}`) || relativeAsset === "..") {
    throw new Error(`Asset is outside the public directory: ${url}`);
  }
  return resolvedAsset;
}

function serializeData(data: TimelineData): string {
  return JSON.stringify(data)
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function shareableData(data: TimelineData): TimelineData {
  return {
    ...data,
    events: data.events.map(({ filePath: _filePath, ...event }) => event)
  };
}

function escapeScript(source: string): string {
  return source.replace(/<\/script/gi, "<\\/script");
}

function escapeStyle(source: string): string {
  return source.replace(/<\/style/gi, "<\\/style");
}

export async function exportStandaloneHtml(options: StandaloneHtmlOptions): Promise<StandaloneHtmlResult> {
  const templatePath = resolve(options.publicDirectory, "index.html");
  let html = await readFile(templatePath, "utf8");

  const scriptTag = html.match(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>/i)?.[0];
  const styleTag = html.match(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/i)?.[0];
  if (!scriptTag || !styleTag) {
    throw new Error("Web build is missing its script or stylesheet asset.");
  }

  const scriptUrl = attribute(scriptTag, "src");
  const styleUrl = attribute(styleTag, "href");
  if (!scriptUrl || !styleUrl) {
    throw new Error("Web build contains an invalid asset tag.");
  }

  const [script, style] = await Promise.all([
    readFile(assetPath(options.publicDirectory, scriptUrl), "utf8"),
    readFile(assetPath(options.publicDirectory, styleUrl), "utf8")
  ]);

  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
  html = html
    .replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}">`)
    .replace(scriptTag, "")
    .replace(styleTag, `<style>${escapeStyle(style)}</style>`)
    .replace(
      "</body>",
      `  <script>globalThis.__TRACEFRAME_DATA__=${serializeData(shareableData(options.data))};</script>\n  <script>${escapeScript(script)}</script>\n  </body>`
    );

  const outputPath = resolve(options.outputPath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");

  return { outputPath, bytes: Buffer.byteLength(html) };
}
