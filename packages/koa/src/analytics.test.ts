import { describe, it, expect, vi } from "vitest";
import Koa from "koa";
import request from "supertest";
import { agentAnalytics } from "./analytics.js";

describe("agentAnalytics middleware (Koa)", () => {
  it("records events for AI agent requests", async () => {
    const onEvent = vi.fn();
    const app = new Koa();
    app.use(agentAnalytics({ onEvent }));
    app.use((ctx) => { ctx.body = { ok: true }; });

    await request(app.callback())
      .get("/api/data")
      .set("User-Agent", "Mozilla/5.0 (compatible; GPTBot/1.0)")
      .expect(200);

    expect(onEvent).toHaveBeenCalledTimes(1);
    const event = onEvent.mock.calls[0][0];
    expect(event.agent).toBe("GPTBot");
    expect(event.method).toBe("GET");
    expect(event.path).toBe("/api/data");
    expect(event.statusCode).toBe(200);
    expect(event.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("skips non-agent requests by default", async () => {
    const onEvent = vi.fn();
    const app = new Koa();
    app.use(agentAnalytics({ onEvent }));
    app.use((ctx) => { ctx.body = "ok"; });

    await request(app.callback())
      .get("/")
      .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0)")
      .expect(200);

    expect(onEvent).not.toHaveBeenCalled();
  });

  it("tracks all requests when trackAll is set", async () => {
    const onEvent = vi.fn();
    const app = new Koa();
    app.use(agentAnalytics({ onEvent, trackAll: true }));
    app.use((ctx) => { ctx.body = "ok"; });

    await request(app.callback())
      .get("/")
      .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0)")
      .expect(200);

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].agent).toBe("unknown");
  });

  it("exposes analytics instance for manual control", () => {
    const mw = agentAnalytics({});
    expect(mw.analytics).toBeDefined();
    expect(typeof mw.analytics.flush).toBe("function");
    expect(typeof mw.analytics.shutdown).toBe("function");
  });
});
