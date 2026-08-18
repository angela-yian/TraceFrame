import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webDist = resolve(here, "../../web/dist");
const cliPublic = resolve(here, "../dist/public");

if (!existsSync(webDist)) {
  throw new Error("Web build not found. Build @traceframe/web before traceframe.");
}

mkdirSync(cliPublic, { recursive: true });
cpSync(webDist, cliPublic, { recursive: true });
