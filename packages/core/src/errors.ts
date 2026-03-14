import type { AgentErrorEnvelope, AgentErrorOptions } from "./types.js";

const STATUS_TYPES: Record<number, string> = {
  400: "invalid_request_error",
  401: "authentication_error",
  403: "permission_error",
  404: "not_found_error",
  409: "conflict_error",
  422: "validation_error",
  429: "rate_limit_error",
  500: "api_error",
};

function typeForStatus(status: number): string {
  return STATUS_TYPES[status] ?? "api_error";
}

/**
 * Format an error into the standard agent-friendly envelope.
 */
export function formatError(opts: AgentErrorOptions): AgentErrorEnvelope {
  const status = opts.status ?? 500;
  return {
    type: opts.type ?? typeForStatus(status),
    code: opts.code,
    message: opts.message,
    status,
    is_retriable: opts.is_retriable ?? (status === 429 || status >= 500),
    ...(opts.retry_after != null && { retry_after: opts.retry_after }),
    ...(opts.param != null && { param: opts.param }),
    ...(opts.docs_url != null && { docs_url: opts.docs_url }),
  };
}

/**
 * Custom error class that carries the agent error envelope.
 */
export class AgentError extends Error {
  public readonly envelope: AgentErrorEnvelope;

  constructor(opts: AgentErrorOptions) {
    super(opts.message);
    this.name = "AgentError";
    this.envelope = formatError(opts);
  }

  get status(): number {
    return this.envelope.status;
  }

  toJSON(): { error: AgentErrorEnvelope } {
    return { error: this.envelope };
  }
}

/**
 * Create a 404 Not Found error envelope.
 */
export function notFoundError(
  message = "The requested resource was not found.",
): AgentErrorEnvelope {
  return formatError({ code: "not_found", message, status: 404 });
}

/**
 * Create a 429 Rate Limit error envelope.
 */
export function rateLimitError(retryAfter: number): AgentErrorEnvelope {
  return formatError({
    code: "rate_limit_exceeded",
    message: "Too many requests. Please retry after the specified time.",
    status: 429,
    is_retriable: true,
    retry_after: retryAfter,
  });
}
