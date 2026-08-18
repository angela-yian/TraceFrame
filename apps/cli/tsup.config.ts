import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  noExternal: [/^@traceframe\//],
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node"
  }
});
