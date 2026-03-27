import { describe, it, expect } from "vitest";
import Koa from "koa";
import Router from "@koa/router";
import request from "supertest";
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

describe("agUiStream (Koa)", () => {
  it("streams a complete text message", async () => {
    const app = new Koa();
    const router = new Router();
    router.post(
      "/agent",
      agUiStream(async (_ctx, emit) => {
        emit.runStarted();
        emit.textStart();
        emit.textDelta("Hello ");
        emit.textDelta("AG-UI!");
        emit.textEnd();
        emit.runFinished();
      }),
    );
    app.use(router.routes());

    const res = await request(app.callback())
      .post("/agent")
      .send({ prompt: "test" })
      .expect(200);

    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.headers["cache-control"]).toContain("no-cache");

    const events = parseSSE(res.text);
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

  it("streams tool call events", async () => {
    const app = new Koa();
    const router = new Router();
    router.post(
      "/agent",
      agUiStream(async (_ctx, emit) => {
        emit.runStarted();
        emit.toolCallStart("search");
        emit.toolCallArgs('{"q":"test"}');
        emit.toolCallEnd();
        emit.toolCallResult('{"results":[]}');
        emit.runFinished();
      }),
    );
    app.use(router.routes());

    const res = await request(app.callback()).post("/agent").send({}).expect(200);

    const events = parseSSE(res.text);
    expect(events.map((e) => e.event)).toEqual([
      "RUN_STARTED",
      "TOOL_CALL_START",
      "TOOL_CALL_ARGS",
      "TOOL_CALL_END",
      "TOOL_CALL_RESULT",
      "RUN_FINISHED",
    ]);
  });

  it("handles errors gracefully", async () => {
    const app = new Koa();
    const router = new Router();
    router.post(
      "/agent",
      agUiStream(async (_ctx, _emit) => {
        throw new Error("Agent crashed");
      }),
    );
    app.use(router.routes());

    const res = await request(app.callback()).post("/agent").send({}).expect(200);

    const events = parseSSE(res.text);
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("RUN_ERROR");
    const data = JSON.parse(events[0].data);
    expect(data.message).toBe("Agent crashed");
  });

  it("supports step events for progress tracking", async () => {
    const app = new Koa();
    const router = new Router();
    router.post(
      "/agent",
      agUiStream(async (_ctx, emit) => {
        emit.runStarted();
        emit.stepStarted("analyze");
        emit.textMessage("Analyzing...");
        emit.stepFinished("analyze");
        emit.runFinished();
      }),
    );
    app.use(router.routes());

    const res = await request(app.callback()).post("/agent").send({}).expect(200);

    const events = parseSSE(res.text);
    const types = events.map((e) => e.event);
    expect(types).toContain("STEP_STARTED");
    expect(types).toContain("STEP_FINISHED");
  });
});
