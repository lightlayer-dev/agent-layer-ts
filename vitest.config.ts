import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@agent-layer/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@agent-layer/koa": path.resolve(__dirname, "packages/koa/src/index.ts"),
      "@agent-layer/firestore": path.resolve(__dirname, "packages/firestore/src/index.ts"),
    },
  },
  test: {
    globals: true,
    include: ["packages/**/*.test.ts"],
  },
});
