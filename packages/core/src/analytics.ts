/**
 * Agent traffic analytics — detect AI agent requests and collect telemetry.
 *
 * Middleware records each agent request and flushes batches to a configurable
 * endpoint (e.g. LightLayer dashboard) or a local callback.
 */

// ── Known Agent User-Agent patterns ─────────────────────────────────────

const AGENT_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /ChatGPT-User/i, name: "ChatGPT" },
  { pattern: /GPTBot/i, name: "GPTBot" },
  { pattern: /Google-Extended/i, name: "Google-Extended" },
  { pattern: /Googlebot/i, name: "Googlebot" },
  { pattern: /Bingbot/i, name: "Bingbot" },
  { pattern: /ClaudeBot/i, name: "ClaudeBot" },
  { pattern: /Claude-Web/i, name: "Claude-Web" },
  { pattern: /Anthropic/i, name: "Anthropic" },
  { pattern: /PerplexityBot/i, name: "PerplexityBot" },
  { pattern: /Cohere-AI/i, name: "Cohere" },
  { pattern: /YouBot/i, name: "YouBot" },
  { pattern: /CCBot/i, name: "CCBot" },
  { pattern: /Bytespider/i, name: "Bytespider" },
  { pattern: /Applebot/i, name: "Applebot" },
  { pattern: /Meta-ExternalAgent/i, name: "Meta-ExternalAgent" },
  { pattern: /AI2Bot/i, name: "AI2Bot" },
  { pattern: /Diffbot/i, name: "Diffbot" },
  { pattern: /Amazonbot/i, name: "Amazonbot" },
];

/** Detect an AI agent from a User-Agent string. Returns agent name or null. */
export function detectAgent(userAgent: string | undefined | null): string | null {
  if (!userAgent) return null;
  for (const { pattern, name } of AGENT_PATTERNS) {
    if (pattern.test(userAgent)) return name;
  }
  return null;
}

// ── Types ───────────────────────────────────────────────────────────────

export interface AgentEvent {
  /** Detected agent name (e.g. "ChatGPT", "ClaudeBot"). */
  agent: string;
  /** Raw User-Agent string. */
  userAgent: string;
  /** HTTP method. */
  method: string;
  /** Request path. */
  path: string;
  /** Response status code. */
  statusCode: number;
  /** Response time in milliseconds. */
  durationMs: number;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Optional: content type of the response. */
  contentType?: string;
  /** Optional: response body size in bytes. */
  responseSize?: number;
}

export interface AnalyticsConfig {
  /**
   * Remote endpoint to flush events to (e.g. "https://dash.lightlayer.dev/api/agent-events/").
   * If not set, events are only passed to the onEvent callback.
   */
  endpoint?: string;

  /** API key for authenticating with the remote endpoint. */
  apiKey?: string;

  /**
   * Callback invoked for each agent event. Use for custom logging,
   * local storage, or forwarding to your own analytics system.
   */
  onEvent?: (event: AgentEvent) => void;

  /**
   * Maximum events to buffer before flushing. Default: 50.
   */
  bufferSize?: number;

  /**
   * Flush interval in milliseconds. Default: 30_000 (30 seconds).
   */
  flushIntervalMs?: number;

  /**
   * Whether to also track non-agent requests. Default: false (only AI agents).
   */
  trackAll?: boolean;

  /**
   * Custom agent detection function. If provided, called instead of built-in detection.
   * Return agent name string or null.
   */
  detectAgent?: (userAgent: string) => string | null;
}

// ── Event Buffer ────────────────────────────────────────────────────────

export class EventBuffer {
  private buffer: AgentEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly config: Required<
    Pick<AnalyticsConfig, "bufferSize" | "flushIntervalMs">
  > & Pick<AnalyticsConfig, "endpoint" | "apiKey" | "onEvent">;

  constructor(config: AnalyticsConfig) {
    this.config = {
      bufferSize: config.bufferSize ?? 50,
      flushIntervalMs: config.flushIntervalMs ?? 30_000,
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      onEvent: config.onEvent,
    };

    if (this.config.endpoint) {
      this.timer = setInterval(() => this.flush(), this.config.flushIntervalMs);
      // Allow the process to exit even if the timer is still running.
      if (this.timer && typeof this.timer === "object" && "unref" in this.timer) {
        (this.timer as { unref: () => void }).unref();
      }
    }
  }

  push(event: AgentEvent): void {
    // Always call the local callback immediately
    this.config.onEvent?.(event);

    if (this.config.endpoint) {
      this.buffer.push(event);
      if (this.buffer.length >= this.config.bufferSize) {
        void this.flush();
      }
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.endpoint) return;

    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.config.apiKey) {
        headers["X-API-Key"] = this.config.apiKey;
      }
      await fetch(this.config.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Re-queue failed events (drop if buffer is full to prevent memory leak)
      if (this.buffer.length < this.config.bufferSize * 3) {
        this.buffer.unshift(...batch);
      }
    }
  }

  /** Stop the flush timer and flush remaining events. */
  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.flush();
  }

  get pending(): number {
    return this.buffer.length;
  }
}

// ── Framework-agnostic analytics creator ────────────────────────────────

export interface AnalyticsInstance {
  /** Record an agent event manually. */
  record(event: AgentEvent): void;
  /** Flush pending events. */
  flush(): Promise<void>;
  /** Stop the flush timer and flush remaining. */
  shutdown(): Promise<void>;
  /** The underlying event buffer. */
  buffer: EventBuffer;
  /** The detect function in use. */
  detect: (userAgent: string | undefined | null) => string | null;
  /** The config. */
  config: AnalyticsConfig;
}

/**
 * Create an analytics instance. Framework adapters (Express, Fastify, etc.)
 * wrap this to create middleware.
 */
export function createAnalytics(config: AnalyticsConfig): AnalyticsInstance {
  const buffer = new EventBuffer(config);
  const detect = config.detectAgent
    ? (ua: string | undefined | null) => (ua ? config.detectAgent!(ua) : null)
    : detectAgent;

  return {
    record: (event) => buffer.push(event),
    flush: () => buffer.flush(),
    shutdown: () => buffer.shutdown(),
    buffer,
    detect,
    config,
  };
}
