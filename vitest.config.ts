import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@agent-layer/core/x402": path.resolve(__dirname, "packages/core/src/x402.ts"),
      "@agent-layer/core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "@agent-layer/koa": path.resolve(__dirname, "packages/koa/src/index.ts"),
      "@agent-layer/firestore": path.resolve(__dirname, "packages/firestore/src/index.ts"),
      "@agent-layer/strapi": path.resolve(__dirname, "packages/strapi/src/index.ts"),
    },
  },
  test: {
    globals: true,
    include: ["packages/**/*.test.ts"],
  },
});
