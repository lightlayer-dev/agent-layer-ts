import { describe, it, expect } from "vitest";
import { formatError, AgentError, notFoundError, rateLimitError } from "./errors.js";

describe("formatError", () => {
  it("returns a complete error envelope with defaults", () => {
    const envelope = formatError({ code: "bad_input", message: "Invalid field" });
    expect(envelope).toEqual({
      type: "api_error",
      code: "bad_input",
      message: "Invalid field",
      status: 500,
      is_retriable: true,
    });
  });

  it("auto-maps status to type", () => {
    const envelope = formatError({
      code: "missing_token",
      message: "No token",
      status: 401,
    });
    expect(envelope.type).toBe("authentication_error");
    expect(envelope.is_retriable).toBe(false);
  });

  it("uses explicit type over auto-mapped type", () => {
    const envelope = formatError({
      type: "custom_error",
      code: "custom",
      message: "Custom",
      status: 400,
    });
    expect(envelope.type).toBe("custom_error");
  });

  it("includes optional fields when provided", () => {
    const envelope = formatError({
      code: "rate_limit",
      message: "Slow down",
      status: 429,
      retry_after: 30,
      param: "api_key",
      docs_url: "https://docs.example.com",
    });
    expect(envelope.retry_after).toBe(30);
    expect(envelope.param).toBe("api_key");
    expect(envelope.docs_url).toBe("https://docs.example.com");
    expect(envelope.is_retriable).toBe(true);
  });

  it("omits optional fields when not provided", () => {
    const envelope = formatError({ code: "test", message: "test", status: 400 });
    expect(envelope).not.toHaveProperty("retry_after");
    expect(envelope).not.toHaveProperty("param");
    expect(envelope).not.toHaveProperty("docs_url");
  });

  it("marks 429 as retriable by default", () => {
    const envelope = formatError({
      code: "rate_limit",
      message: "Too many",
      status: 429,
    });
    expect(envelope.is_retriable).toBe(true);
  });

  it("marks 5xx as retriable by default", () => {
    const e502 = formatError({ code: "bad_gw", message: "Bad gateway", status: 502 });
    expect(e502.is_retriable).toBe(true);
  });

  it("allows overriding is_retriable", () => {
    const envelope = formatError({
      code: "perm",
      message: "No",
      status: 500,
      is_retriable: false,
    });
    expect(envelope.is_retriable).toBe(false);
  });
});

describe("AgentError", () => {
  it("extends Error with envelope", () => {
    const err = new AgentError({ code: "oops", message: "Something broke", status: 500 });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AgentError");
    expect(err.message).toBe("Something broke");
    expect(err.status).toBe(500);
    expect(err.envelope.code).toBe("oops");
  });

  it("serializes to JSON", () => {
    const err = new AgentError({ code: "test", message: "Test error", status: 400 });
    const json = err.toJSON();
    expect(json).toHaveProperty("error");
    expect(json.error.code).toBe("test");
    expect(json.error.status).toBe(400);
  });
});

describe("notFoundError", () => {
  it("returns a 404 envelope with default message", () => {
    const envelope = notFoundError();
    expect(envelope.status).toBe(404);
    expect(envelope.code).toBe("not_found");
    expect(envelope.type).toBe("not_found_error");
    expect(envelope.is_retriable).toBe(false);
  });

  it("accepts a custom message", () => {
    const envelope = notFoundError("User not found");
    expect(envelope.message).toBe("User not found");
  });
});

describe("rateLimitError", () => {
  it("returns a 429 envelope with retry_after", () => {
    const envelope = rateLimitError(60);
    expect(envelope.status).toBe(429);
    expect(envelope.code).toBe("rate_limit_exceeded");
    expect(envelope.is_retriable).toBe(true);
    expect(envelope.retry_after).toBe(60);
  });
});
