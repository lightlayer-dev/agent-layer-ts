import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/x402.ts", "src/testing.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
});
