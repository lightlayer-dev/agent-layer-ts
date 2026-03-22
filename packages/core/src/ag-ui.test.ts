import { describe, it, expect, vi } from "vitest";
import {
  encodeEvent,
  encodeEvents,
  createAgUiEmitter,
  AG_UI_HEADERS,
  type AgUiEvent,
  type TextMessageContentEvent,
  type RunStartedEvent,
} from "./ag-ui.js";

describe("encodeEvent", () => {
  it("encodes a single event as SSE", () => {
    const event: AgUiEvent = {
      type: "RUN_STARTED",
      threadId: "t1",
      runId: "r1",
      timestamp: 1000,
    };
    const sse = encodeEvent(event);
    expect(sse).toBe(
      `event: RUN_STARTED\ndata: ${JSON.stringify(event)}\n\n`,
    );
  });

  it("encodes text content event", () => {
    const event: TextMessageContentEvent = {
      type: "TEXT_MESSAGE_CONTENT",
      messageId: "m1",
      delta: "hello",
      timestamp: 2000,
    };
    const sse = encodeEvent(event);
    expect(sse).toContain("event: TEXT_MESSAGE_CONTENT");
    expect(sse).toContain('"delta":"hello"');
  });
});

describe("encodeEvents", () => {
  it("encodes multiple events", () => {
    const events: AgUiEvent[] = [
      { type: "RUN_STARTED", threadId: "t1", runId: "r1" },
      { type: "RUN_FINISHED", threadId: "t1", runId: "r1" },
    ];
    const sse = encodeEvents(events);
    expect(sse).toContain("event: RUN_STARTED");
    expect(sse).toContain("event: RUN_FINISHED");
  });
});

describe("createAgUiEmitter", () => {
  it("emits run lifecycle events", () => {
    const chunks: string[] = [];
    const emitter = createAgUiEmitter((c) => chunks.push(c), {
      threadId: "t1",
      runId: "r1",
    });

    emitter.runStarted();
    emitter.runFinished({ result: "ok" });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toContain("RUN_STARTED");
    expect(chunks[1]).toContain("RUN_FINISHED");

    // Verify threadId and runId
    const started = JSON.parse(chunks[0].split("data: ")[1]) as RunStartedEvent;
    expect(started.threadId).toBe("t1");
    expect(started.runId).toBe("r1");
  });

  it("emits text message streaming events", () => {
    const chunks: string[] = [];
    const emitter = createAgUiEmitter((c) => chunks.push(c));

    emitter.runStarted();
    const messageId = emitter.textStart();
    emitter.textDelta("Hello ");
    emitter.textDelta("world!");
    emitter.textEnd();
    emitter.runFinished();

    expect(chunks).toHaveLength(6);
    expect(chunks[1]).toContain("TEXT_MESSAGE_START");
    expect(chunks[2]).toContain("Hello ");
    expect(chunks[3]).toContain("world!");
    expect(chunks[4]).toContain("TEXT_MESSAGE_END");

    // All text events should reference the same messageId
    const startData = JSON.parse(chunks[1].split("data: ")[1]);
    const contentData = JSON.parse(chunks[2].split("data: ")[1]);
    const endData = JSON.parse(chunks[4].split("data: ")[1]);
    expect(startData.messageId).toBe(messageId);
    expect(contentData.messageId).toBe(messageId);
    expect(endData.messageId).toBe(messageId);
  });

  it("textMessage convenience emits start + content + end", () => {
    const chunks: string[] = [];
    const emitter = createAgUiEmitter((c) => chunks.push(c));

    const id = emitter.textMessage("Complete message");

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toContain("TEXT_MESSAGE_START");
    expect(chunks[1]).toContain("Complete message");
    expect(chunks[2]).toContain("TEXT_MESSAGE_END");
    expect(typeof id).toBe("string");
  });

  it("emits tool call streaming events", () => {
    const chunks: string[] = [];
    const emitter = createAgUiEmitter((c) => chunks.push(c));

    const toolCallId = emitter.toolCallStart("search", undefined, "msg-1");
    emitter.toolCallArgs('{"query":');
    emitter.toolCallArgs('"test"}');
    emitter.toolCallEnd();
    emitter.toolCallResult('{"results": []}');

    expect(chunks).toHaveLength(5);
    expect(chunks[0]).toContain("TOOL_CALL_START");
    expect(chunks[0]).toContain('"toolCallName":"search"');
    expect(chunks[1]).toContain("TOOL_CALL_ARGS");
    expect(chunks[3]).toContain("TOOL_CALL_END");
    expect(chunks[4]).toContain("TOOL_CALL_RESULT");

    // Verify toolCallId consistency
    const start = JSON.parse(chunks[0].split("data: ")[1]);
    expect(start.toolCallId).toBe(toolCallId);
    expect(start.parentMessageId).toBe("msg-1");
  });

  it("emits step events", () => {
    const chunks: string[] = [];
    const emitter = createAgUiEmitter((c) => chunks.push(c));

    emitter.stepStarted("analyze");
    emitter.stepFinished("analyze");

    expect(chunks[0]).toContain("STEP_STARTED");
    expect(chunks[0]).toContain('"stepName":"analyze"');
    expect(chunks[1]).toContain("STEP_FINISHED");
  });

  it("emits state events", () => {
    const chunks: string[] = [];
    const emitter = createAgUiEmitter((c) => chunks.push(c));

    emitter.stateSnapshot({ count: 0 });
    emitter.stateDelta([{ op: "replace", path: "/count", value: 1 }]);

    expect(chunks[0]).toContain("STATE_SNAPSHOT");
    expect(chunks[1]).toContain("STATE_DELTA");
  });

  it("emits custom events", () => {
    const chunks: string[] = [];
    const emitter = createAgUiEmitter((c) => chunks.push(c));

    emitter.custom("progress", { percent: 50 });

    expect(chunks[0]).toContain("CUSTOM");
    expect(chunks[0]).toContain('"percent":50');
  });

  it("emits error events", () => {
    const chunks: string[] = [];
    const emitter = createAgUiEmitter((c) => chunks.push(c));

    emitter.runError("Something went wrong", "INTERNAL_ERROR");

    expect(chunks[0]).toContain("RUN_ERROR");
    expect(chunks[0]).toContain("Something went wrong");
    expect(chunks[0]).toContain("INTERNAL_ERROR");
  });

  it("adds timestamps automatically", () => {
    const chunks: string[] = [];
    const emitter = createAgUiEmitter((c) => chunks.push(c));

    emitter.runStarted();

    const data = JSON.parse(chunks[0].split("data: ")[1]);
    expect(typeof data.timestamp).toBe("number");
    expect(data.timestamp).toBeGreaterThan(0);
  });

  it("generates unique IDs when not provided", () => {
    const emitter = createAgUiEmitter(() => {});

    expect(emitter.threadId).toBeTruthy();
    expect(emitter.runId).toBeTruthy();
    expect(emitter.threadId).not.toBe(emitter.runId);
  });

  it("throws when textDelta called without textStart", () => {
    const emitter = createAgUiEmitter(() => {});
    expect(() => emitter.textDelta("hello")).toThrow("textStart");
  });

  it("throws when toolCallArgs called without toolCallStart", () => {
    const emitter = createAgUiEmitter(() => {});
    expect(() => emitter.toolCallArgs("test")).toThrow("toolCallStart");
  });
});

describe("AG_UI_HEADERS", () => {
  it("has correct SSE content type", () => {
    expect(AG_UI_HEADERS["Content-Type"]).toBe("text/event-stream");
  });

  it("disables caching", () => {
    expect(AG_UI_HEADERS["Cache-Control"]).toContain("no-cache");
  });

  it("disables nginx buffering", () => {
    expect(AG_UI_HEADERS["X-Accel-Buffering"]).toBe("no");
  });
});
