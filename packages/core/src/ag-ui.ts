/**
 * AG-UI (Agent-User Interaction) Protocol — Server-Sent Events streaming.
 *
 * Implements the server side of the AG-UI protocol (https://docs.ag-ui.com):
 * Framework-agnostic types and helpers for streaming agent responses
 * to CopilotKit, Google ADK, and other AG-UI-compatible frontends.
 *
 * @see https://docs.ag-ui.com/concepts/events
 */

import { randomUUID } from "crypto";

// ── Event Types ──────────────────────────────────────────────────────────

export type AgUiEventType =
  // Lifecycle
  | "RUN_STARTED"
  | "RUN_FINISHED"
  | "RUN_ERROR"
  | "STEP_STARTED"
  | "STEP_FINISHED"
  // Text messages
  | "TEXT_MESSAGE_START"
  | "TEXT_MESSAGE_CONTENT"
  | "TEXT_MESSAGE_END"
  // Tool calls
  | "TOOL_CALL_START"
  | "TOOL_CALL_ARGS"
  | "TOOL_CALL_END"
  | "TOOL_CALL_RESULT"
  // State management
  | "STATE_SNAPSHOT"
  | "STATE_DELTA"
  // Custom
  | "CUSTOM";

export type AgUiRole = "developer" | "system" | "assistant" | "user" | "tool";

// ── Event interfaces ─────────────────────────────────────────────────────

export interface BaseEvent {
  type: AgUiEventType;
  timestamp?: number;
}

export interface RunStartedEvent extends BaseEvent {
  type: "RUN_STARTED";
  threadId: string;
  runId: string;
  parentRunId?: string;
}

export interface RunFinishedEvent extends BaseEvent {
  type: "RUN_FINISHED";
  threadId: string;
  runId: string;
  result?: unknown;
}

export interface RunErrorEvent extends BaseEvent {
  type: "RUN_ERROR";
  message: string;
  code?: string;
}

export interface StepStartedEvent extends BaseEvent {
  type: "STEP_STARTED";
  stepName: string;
}

export interface StepFinishedEvent extends BaseEvent {
  type: "STEP_FINISHED";
  stepName: string;
}

export interface TextMessageStartEvent extends BaseEvent {
  type: "TEXT_MESSAGE_START";
  messageId: string;
  role: AgUiRole;
}

export interface TextMessageContentEvent extends BaseEvent {
  type: "TEXT_MESSAGE_CONTENT";
  messageId: string;
  delta: string;
}

export interface TextMessageEndEvent extends BaseEvent {
  type: "TEXT_MESSAGE_END";
  messageId: string;
}

export interface ToolCallStartEvent extends BaseEvent {
  type: "TOOL_CALL_START";
  toolCallId: string;
  toolCallName: string;
  parentMessageId?: string;
}

export interface ToolCallArgsEvent extends BaseEvent {
  type: "TOOL_CALL_ARGS";
  toolCallId: string;
  delta: string;
}

export interface ToolCallEndEvent extends BaseEvent {
  type: "TOOL_CALL_END";
  toolCallId: string;
}

export interface ToolCallResultEvent extends BaseEvent {
  type: "TOOL_CALL_RESULT";
  toolCallId: string;
  result: string;
}

export interface StateSnapshotEvent extends BaseEvent {
  type: "STATE_SNAPSHOT";
  snapshot: Record<string, unknown>;
}

export interface StateDeltaEvent extends BaseEvent {
  type: "STATE_DELTA";
  delta: unknown[];
}

export interface CustomEvent extends BaseEvent {
  type: "CUSTOM";
  name: string;
  value: unknown;
}

export type AgUiEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | StepStartedEvent
  | StepFinishedEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent
  | ToolCallStartEvent
  | ToolCallArgsEvent
  | ToolCallEndEvent
  | ToolCallResultEvent
  | StateSnapshotEvent
  | StateDeltaEvent
  | CustomEvent;

// ── Encoder ──────────────────────────────────────────────────────────────

/**
 * Encode an AG-UI event as a Server-Sent Events data line.
 */
export function encodeEvent(event: AgUiEvent): string {
  const data = JSON.stringify(event);
  return `event: ${event.type}\ndata: ${data}\n\n`;
}

/**
 * Encode multiple AG-UI events.
 */
export function encodeEvents(events: AgUiEvent[]): string {
  return events.map(encodeEvent).join("");
}

// ── Emitter (framework-agnostic) ─────────────────────────────────────────

export interface AgUiEmitterOptions {
  threadId?: string;
  runId?: string;
}

/**
 * High-level AG-UI event emitter. Wraps a `write` function and provides
 * convenient methods for emitting structured events.
 *
 * Usage:
 * ```ts
 * const emitter = createAgUiEmitter((chunk) => res.write(chunk));
 * emitter.runStarted();
 * emitter.textStart();
 * emitter.textDelta("Hello ");
 * emitter.textDelta("world!");
 * emitter.textEnd();
 * emitter.runFinished();
 * ```
 */
export function createAgUiEmitter(
  write: (chunk: string) => void,
  options: AgUiEmitterOptions = {},
) {
  const threadId = options.threadId ?? randomUUID();
  const runId = options.runId ?? randomUUID();
  let currentMessageId: string | null = null;
  let currentToolCallId: string | null = null;

  function emit(event: AgUiEvent): void {
    if (!event.timestamp) {
      (event as BaseEvent).timestamp = Date.now();
    }
    write(encodeEvent(event));
  }

  return {
    /** Emit raw event. */
    emit,

    /** Get current thread/run IDs. */
    get threadId() { return threadId; },
    get runId() { return runId; },

    // ── Lifecycle ──

    runStarted(parentRunId?: string): void {
      emit({ type: "RUN_STARTED", threadId, runId, parentRunId });
    },

    runFinished(result?: unknown): void {
      emit({ type: "RUN_FINISHED", threadId, runId, result });
    },

    runError(message: string, code?: string): void {
      emit({ type: "RUN_ERROR", message, code });
    },

    stepStarted(stepName: string): void {
      emit({ type: "STEP_STARTED", stepName });
    },

    stepFinished(stepName: string): void {
      emit({ type: "STEP_FINISHED", stepName });
    },

    // ── Text messages ──

    textStart(role: AgUiRole = "assistant", messageId?: string): string {
      currentMessageId = messageId ?? randomUUID();
      emit({ type: "TEXT_MESSAGE_START", messageId: currentMessageId, role });
      return currentMessageId;
    },

    textDelta(delta: string, messageId?: string): void {
      const id = messageId ?? currentMessageId;
      if (!id) throw new Error("textDelta called without an active message. Call textStart() first.");
      emit({ type: "TEXT_MESSAGE_CONTENT", messageId: id, delta });
    },

    textEnd(messageId?: string): void {
      const id = messageId ?? currentMessageId;
      if (!id) throw new Error("textEnd called without an active message. Call textStart() first.");
      emit({ type: "TEXT_MESSAGE_END", messageId: id });
      if (id === currentMessageId) currentMessageId = null;
    },

    /**
     * Convenience: emit a complete text message (start + content + end).
     */
    textMessage(text: string, role: AgUiRole = "assistant"): string {
      const id = randomUUID();
      emit({ type: "TEXT_MESSAGE_START", messageId: id, role });
      emit({ type: "TEXT_MESSAGE_CONTENT", messageId: id, delta: text });
      emit({ type: "TEXT_MESSAGE_END", messageId: id });
      return id;
    },

    // ── Tool calls ──

    toolCallStart(toolCallName: string, toolCallId?: string, parentMessageId?: string): string {
      currentToolCallId = toolCallId ?? randomUUID();
      emit({ type: "TOOL_CALL_START", toolCallId: currentToolCallId, toolCallName, parentMessageId });
      return currentToolCallId;
    },

    toolCallArgs(delta: string, toolCallId?: string): void {
      const id = toolCallId ?? currentToolCallId;
      if (!id) throw new Error("toolCallArgs called without an active tool call. Call toolCallStart() first.");
      emit({ type: "TOOL_CALL_ARGS", toolCallId: id, delta });
    },

    toolCallEnd(toolCallId?: string): void {
      const id = toolCallId ?? currentToolCallId;
      if (!id) throw new Error("toolCallEnd called without an active tool call. Call toolCallStart() first.");
      emit({ type: "TOOL_CALL_END", toolCallId: id });
      // Don't clear currentToolCallId yet — toolCallResult may follow
    },

    toolCallResult(result: string, toolCallId?: string): void {
      const id = toolCallId ?? currentToolCallId;
      if (!id) throw new Error("toolCallResult called without an active tool call.");
      emit({ type: "TOOL_CALL_RESULT", toolCallId: id, result });
      // Now clear after result is sent
      if (id === currentToolCallId) currentToolCallId = null;
    },

    // ── State ──

    stateSnapshot(snapshot: Record<string, unknown>): void {
      emit({ type: "STATE_SNAPSHOT", snapshot });
    },

    stateDelta(delta: unknown[]): void {
      emit({ type: "STATE_DELTA", delta });
    },

    // ── Custom ──

    custom(name: string, value: unknown): void {
      emit({ type: "CUSTOM", name, value });
    },
  };
}

export type AgUiEmitter = ReturnType<typeof createAgUiEmitter>;

// ── SSE Headers ──────────────────────────────────────────────────────────

/** Standard SSE response headers for AG-UI streams. */
export const AG_UI_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no", // Disable nginx buffering
} as const;
