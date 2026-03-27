import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { securityHeaders } from "./security-headers.js";

describe("securityHeaders plugin (Fastify)", () => {
  it("adds all default security headers", async () => {
    const app = Fastify();
    await app.register(securityHeaders());
    app.get("/", async () => ({ ok: true }));

    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers["content-security-policy"]).toBe("default-src 'self'");
  });

  it("applies to all routes", async () => {
    const app = Fastify();
    await app.register(securityHeaders());
    app.get("/a", async () => ({ route: "a" }));
    app.get("/b", async () => ({ route: "b" }));

    const resA = await app.inject({ method: "GET", url: "/a" });
    const resB = await app.inject({ method: "GET", url: "/b" });
    expect(resA.headers["x-content-type-options"]).toBe("nosniff");
    expect(resB.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("respects custom config", async () => {
    const app = Fastify();
    await app.register(securityHeaders({
      frameOptions: "SAMEORIGIN",
      csp: "default-src 'self'; img-src *",
    }));
    app.get("/", async () => ({ ok: true }));

    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["content-security-policy"]).toContain("img-src *");
  });

  it("can disable individual headers", async () => {
    const app = Fastify();
    await app.register(securityHeaders({ csp: false, referrerPolicy: false }));
    app.get("/", async () => ({ ok: true }));

    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.headers["content-security-policy"]).toBeUndefined();
    expect(res.headers["referrer-policy"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
