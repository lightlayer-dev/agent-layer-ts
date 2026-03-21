import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { llmsTxtRoutes } from "./llms-txt.js";

describe("llmsTxtRoutes (Fastify)", () => {
  it("serves /llms.txt with title and description", async () => {
    const app = Fastify();
    await app.register(
      llmsTxtRoutes({ title: "My API", description: "A great API" }),
    );

    const res = await app.inject({ method: "GET", url: "/llms.txt" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("# My API");
    expect(res.body).toContain("> A great API");
  });

  it("serves /llms-full.txt with route details", async () => {
    const app = Fastify();
    await app.register(
      llmsTxtRoutes({
        title: "API",
        sections: [{ title: "Auth", content: "Use Bearer tokens" }],
      }),
    );

    const res = await app.inject({ method: "GET", url: "/llms-full.txt" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("# API");
    expect(res.body).toContain("## Auth");
    expect(res.body).toContain("Use Bearer tokens");
  });

  it("sets cache-control headers", async () => {
    const app = Fastify();
    await app.register(llmsTxtRoutes({ title: "API" }));

    const res = await app.inject({ method: "GET", url: "/llms.txt" });

    expect(res.headers["cache-control"]).toBe("public, max-age=3600");
  });
});
