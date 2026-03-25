import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { securityHeaders } from "./security-headers.js";

describe("securityHeaders middleware (Hono)", () => {
  it("adds all default security headers", async () => {
    const app = new Hono();
    app.use("*", securityHeaders());
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("content-security-policy")).toBe("default-src 'self'");
  });

  it("applies to all routes", async () => {
    const app = new Hono();
    app.use("*", securityHeaders());
    app.get("/a", (c) => c.json({ route: "a" }));
    app.get("/b", (c) => c.json({ route: "b" }));

    const resA = await app.request("/a");
    const resB = await app.request("/b");
    expect(resA.headers.get("x-content-type-options")).toBe("nosniff");
    expect(resB.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("respects custom config", async () => {
    const app = new Hono();
    app.use("*", securityHeaders({
      frameOptions: "SAMEORIGIN",
      csp: "default-src 'self'; img-src *",
    }));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("content-security-policy")).toContain("img-src *");
  });

  it("can disable individual headers", async () => {
    const app = new Hono();
    app.use("*", securityHeaders({ csp: false, referrerPolicy: false }));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/");
    expect(res.headers.get("content-security-policy")).toBeNull();
    expect(res.headers.get("referrer-policy")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
