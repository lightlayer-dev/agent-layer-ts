import { describe, it, expect, vi } from "vitest";
import { detectAgent, createAnalytics, EventBuffer } from "./analytics.js";
import type { AgentEvent } from "./analytics.js";

describe("detectAgent", () => {
  it("detects ChatGPT user agent", () => {
    expect(detectAgent("Mozilla/5.0 ChatGPT-User")).toBe("ChatGPT");
  });

  it("detects GPTBot", () => {
    expect(detectAgent("Mozilla/5.0 (compatible; GPTBot/1.0)")).toBe("GPTBot");
  });

  it("detects ClaudeBot", () => {
    expect(detectAgent("ClaudeBot/1.0")).toBe("ClaudeBot");
  });

  it("detects PerplexityBot", () => {
    expect(detectAgent("PerplexityBot/1.0")).toBe("PerplexityBot");
  });

  it("returns null for regular browsers", () => {
    expect(detectAgent("Mozilla/5.0 (Windows NT 10.0; Win64)")).toBeNull();
  });

  it("returns null for empty/null input", () => {
    expect(detectAgent(null)).toBeNull();
    expect(detectAgent(undefined)).toBeNull();
    expect(detectAgent("")).toBeNull();
  });
});

describe("EventBuffer", () => {
  it("calls onEvent callback immediately", () => {
    const onEvent = vi.fn();
    const buffer = new EventBuffer({ onEvent });
    const event: AgentEvent = {
      agent: "ChatGPT",
      userAgent: "ChatGPT-User",
      method: "GET",
      path: "/api/data",
      statusCode: 200,
      durationMs: 42,
      timestamp: new Date().toISOString(),
    };
    buffer.push(event);
    expect(onEvent).toHaveBeenCalledWith(event);
    expect(buffer.pending).toBe(0); // no endpoint = no buffering
  });

  it("buffers events when endpoint is set", () => {
    const buffer = new EventBuffer({ endpoint: "https://example.com/events" });
    const event: AgentEvent = {
      agent: "GPTBot",
      userAgent: "GPTBot/1.0",
      method: "GET",
      path: "/",
      statusCode: 200,
      durationMs: 10,
      timestamp: new Date().toISOString(),
    };
    buffer.push(event);
    expect(buffer.pending).toBe(1);
    void buffer.shutdown();
  });

  it("flushes when buffer is full", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);

    const buffer = new EventBuffer({
      endpoint: "https://example.com/events",
      bufferSize: 2,
    });
    const event: AgentEvent = {
      agent: "GPTBot",
      userAgent: "GPTBot/1.0",
      method: "GET",
      path: "/",
      statusCode: 200,
      durationMs: 10,
      timestamp: new Date().toISOString(),
    };
    buffer.push(event);
    buffer.push(event); // triggers flush at bufferSize=2

    // Give the async flush a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(buffer.pending).toBe(0);

    await buffer.shutdown();
    vi.unstubAllGlobals();
  });
});

describe("createAnalytics", () => {
  it("creates an instance with detect function", () => {
    const instance = createAnalytics({});
    expect(instance.detect("ChatGPT-User")).toBe("ChatGPT");
    expect(instance.detect("Mozilla/5.0")).toBeNull();
  });

  it("supports custom detectAgent", () => {
    const instance = createAnalytics({
      detectAgent: (ua) => (ua.includes("MyBot") ? "MyBot" : null),
    });
    expect(instance.detect("MyBot/1.0")).toBe("MyBot");
    expect(instance.detect("ChatGPT-User")).toBeNull();
  });
});
