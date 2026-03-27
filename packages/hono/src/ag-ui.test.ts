import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { agUiStream } from "./ag-ui.js";

function parseSSE(text: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = text.split("\n\n").filter(Boolean);
  for (const block of blocks) {
    const lines = block.split("\n");
    let event = "";
    let data = "";
    for (const line of lines) {
      if (line.startsWith("event: ")) event = line.slice(7);
      if (line.startsWith("data: ")) data = line.slice(6);
    }
    if (event && data) events.push({ event, data });
  }
  return events;
}

describe("agUiStream (Hono)", () => {
  it("streams a complete text message", async () => {
    const app = new Hono();
    app.post(
      "/agent",
      agUiStream(async (_c, emit) => {
        emit.runStarted();
        emit.textStart();
        emit.textDelta("Hello ");
        emit.textDelta("AG-UI!");
        emit.textEnd();
        emit.runFinished();
      }),
    );

    const res = await app.request("/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");

    const text = await res.text();
    const events = parseSSE(text);
    expect(events.map((e) => e.event)).toEqual([
      "RUN_STARTED",
      "TEXT_MESSAGE_START",
      "TEXT_MESSAGE_CONTENT",
      "TEXT_MESSAGE_CONTENT",
      "TEXT_MESSAGE_END",
      "RUN_FINISHED",
    ]);

    const content1 = JSON.parse(events[2].data);
    expect(content1.delta).toBe("Hello ");
    const content2 = JSON.parse(events[3].data);
    expect(content2.delta).toBe("AG-UI!");
  });

  it("streams error on handler failure", async () => {
    const app = new Hono();
    app.post(
      "/agent",
      agUiStream(async (_c, _emit) => {
        throw new Error("test failure");
      }),
    );

    const res = await app.request("/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    const events = parseSSE(text);
    const errorEvent = events.find((e) => e.event === "RUN_ERROR");
    expect(errorEvent).toBeDefined();
    const data = JSON.parse(errorEvent!.data);
    expect(data.message).toBe("test failure");
  });

  it("calls custom onError handler", async () => {
    const app = new Hono();
    app.post(
      "/agent",
      agUiStream(
        async (_c, _emit) => {
          throw new Error("custom fail");
        },
        {
          onError(err, emit) {
            emit.runError(`Custom: ${(err as Error).message}`);
          },
        },
      ),
    );

    const res = await app.request("/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const text = await res.text();
    const events = parseSSE(text);
    const errorEvent = events.find((e) => e.event === "RUN_ERROR");
    expect(errorEvent).toBeDefined();
    const data = JSON.parse(errorEvent!.data);
    expect(data.message).toBe("Custom: custom fail");
  });
});
