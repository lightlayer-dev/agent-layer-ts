import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { securityHeaders } from "./security-headers.js";

describe("securityHeaders middleware (Express)", () => {
  it("adds all default security headers", async () => {
    const app = express();
    app.use(securityHeaders());
    app.get("/", (_req, res) => res.json({ ok: true }));

    const res = await request(app).get("/");
    expect(res.headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers["content-security-policy"]).toBe("default-src 'self'");
  });

  it("applies to all routes", async () => {
    const app = express();
    app.use(securityHeaders());
    app.get("/a", (_req, res) => res.json({ route: "a" }));
    app.get("/b", (_req, res) => res.json({ route: "b" }));

    const resA = await request(app).get("/a");
    const resB = await request(app).get("/b");
    expect(resA.headers["x-content-type-options"]).toBe("nosniff");
    expect(resB.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("respects custom config", async () => {
    const app = express();
    app.use(securityHeaders({
      frameOptions: "SAMEORIGIN",
      csp: "default-src 'self'; img-src *",
    }));
    app.get("/", (_req, res) => res.json({ ok: true }));

    const res = await request(app).get("/");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["content-security-policy"]).toContain("img-src *");
  });

  it("can disable individual headers", async () => {
    const app = express();
    app.use(securityHeaders({ csp: false, referrerPolicy: false }));
    app.get("/", (_req, res) => res.json({ ok: true }));

    const res = await request(app).get("/");
    expect(res.headers["content-security-policy"]).toBeUndefined();
    expect(res.headers["referrer-policy"]).toBeUndefined();
    // Others still present
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
