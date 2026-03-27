import { describe, it, expect } from "vitest";
import Koa from "koa";
import Router from "@koa/router";
import request from "supertest";
import { securityHeaders } from "./security-headers.js";

describe("securityHeaders middleware (Koa)", () => {
  it("adds all default security headers", async () => {
    const app = new Koa();
    const router = new Router();
    router.use(securityHeaders());
    router.get("/", (ctx) => { ctx.body = { ok: true }; });
    app.use(router.routes());

    const res = await request(app.callback()).get("/");
    expect(res.headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers["content-security-policy"]).toBe("default-src 'self'");
  });

  it("applies to all routes", async () => {
    const app = new Koa();
    const router = new Router();
    router.use(securityHeaders());
    router.get("/a", (ctx) => { ctx.body = { route: "a" }; });
    router.get("/b", (ctx) => { ctx.body = { route: "b" }; });
    app.use(router.routes());

    const resA = await request(app.callback()).get("/a");
    const resB = await request(app.callback()).get("/b");
    expect(resA.headers["x-content-type-options"]).toBe("nosniff");
    expect(resB.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("respects custom config", async () => {
    const app = new Koa();
    const router = new Router();
    router.use(securityHeaders({
      frameOptions: "SAMEORIGIN",
      csp: "default-src 'self'; img-src *",
    }));
    router.get("/", (ctx) => { ctx.body = { ok: true }; });
    app.use(router.routes());

    const res = await request(app.callback()).get("/");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["content-security-policy"]).toContain("img-src *");
  });

  it("can disable individual headers", async () => {
    const app = new Koa();
    const router = new Router();
    router.use(securityHeaders({ csp: false, referrerPolicy: false }));
    router.get("/", (ctx) => { ctx.body = { ok: true }; });
    app.use(router.routes());

    const res = await request(app.callback()).get("/");
    expect(res.headers["content-security-policy"]).toBeUndefined();
    expect(res.headers["referrer-policy"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
