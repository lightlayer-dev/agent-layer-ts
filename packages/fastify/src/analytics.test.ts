import { describe, it, expect, vi } from "vitest";
import Fastify from "fastify";
import { agentAnalytics } from "./analytics.js";

describe("agentAnalytics plugin (Fastify)", () => {
  it("records events for AI agent requests", async () => {
    const onEvent = vi.fn();
    const app = Fastify();
    await app.register(agentAnalytics({ onEvent }));
    app.get("/api/data", async () => ({ ok: true }));

    const res = await app.inject({
      method: "GET",
      url: "/api/data",
      headers: { "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.0)" },
    });

    expect(res.statusCode).toBe(200);
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
    const app = Fastify();
    await app.register(agentAnalytics({ onEvent }));
    app.get("/", async () => "ok");

    await app.inject({
      method: "GET",
      url: "/",
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0)" },
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it("tracks all requests when trackAll is set", async () => {
    const onEvent = vi.fn();
    const app = Fastify();
    await app.register(agentAnalytics({ onEvent, trackAll: true }));
    app.get("/", async () => "ok");

    await app.inject({
      method: "GET",
      url: "/",
      headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0)" },
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0].agent).toBe("unknown");
  });

  it("exposes analytics instance", () => {
    const plugin = agentAnalytics({});
    expect(plugin.analytics).toBeDefined();
    expect(typeof plugin.analytics.flush).toBe("function");
    expect(typeof plugin.analytics.shutdown).toBe("function");
  });
});
