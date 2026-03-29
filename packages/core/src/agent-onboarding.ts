/**
 * Agent Onboarding — Self-registration via webhook-based credential provisioning.
 *
 * Agents discover the registration endpoint through /.well-known/agent.json and /llms.txt,
 * POST to /agent/register with their identity, and receive credentials back. The middleware
 * forwards the request to the API owner's provisioning webhook and returns the result.
 * The middleware never stores credentials — it's a stateless facilitator.
 *
 * Ported from the LightLayer Gateway's Go implementation.
 *
 * @see https://github.com/lightlayer-dev/gateway
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { AgentErrorEnvelope } from "./types.js";

// ── Types ────────────────────────────────────────────────────────────────

/** Configuration for the agent onboarding middleware. */
export interface OnboardingConfig {
  /** URL to POST agent registrations to (required). */
  provisioningWebhook: string;
  /** HMAC-SHA256 secret for signing webhook calls. If empty, no signature is sent. */
  webhookSecret?: string;
  /** Timeout for webhook HTTP calls in ms. Default: 10000. */
  webhookTimeoutMs?: number;
  /** If true, agent must present identity_token to register. */
  requireIdentity?: boolean;
  /** If set, only these providers can register. Empty = allow all. */
  allowedProviders?: string[];
  /** URL to auth documentation, included in 401 responses. */
  authDocs?: string;
  /** Rate limit config for registration endpoint. */
  rateLimit?: {
    /** Max registrations per IP per window. Default: 10. */
    maxRegistrations: number;
    /** Window size in ms. Default: 3600000 (1 hour). */
    windowMs: number;
  };
}

/** The body an agent sends to POST /agent/register. */
export interface RegistrationRequest {
  agent_id: string;
  agent_name: string;
  agent_provider: string;
  identity_token?: string;
  metadata?: Record<string, unknown>;
}

/** Standardized response to a registration request. */
export interface RegistrationResponse {
  status: "provisioned" | "rejected";
  credentials?: Credential;
  reason?: string;
}

/** Provisioned credentials in one of three formats. */
export interface Credential {
  type: "api_key" | "oauth2_client_credentials" | "bearer";
  // api_key fields
  token?: string;
  header?: string;
  // oauth2 fields
  client_id?: string;
  client_secret?: string;
  scopes?: string[];
  token_endpoint?: string;
  // bearer fields
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: string;
}

/** Sent to the API owner's provisioning webhook. */
export interface WebhookRequest {
  agent_id: string;
  agent_name: string;
  agent_provider: string;
  identity_verified: boolean;
  request_ip: string;
  timestamp: string; // ISO 8601
}

/** Returned as 401 when an unauthenticated agent hits the API. */
export interface AuthRequiredResponse {
  error: "auth_required";
  message: string;
  register_url: string;
  auth_docs?: string;
  supported_credential_types: string[];
}

/** Supported credential types agents can receive. */
export const SUPPORTED_CREDENTIAL_TYPES = [
  "api_key",
  "oauth2_client_credentials",
  "bearer",
] as const;

/** Paths that should never trigger a 401 auth-required response. */
const EXEMPT_PATHS = new Set([
  "/agent/register",
  "/llms.txt",
  "/llms-full.txt",
  "/agents.txt",
  "/robots.txt",
]);

// ── Rate Limiting (in-memory sliding window) ─────────────────────────────

interface RateLimitWindow {
  count: number;
  resetAt: number; // epoch ms
}

// ── HMAC Helpers ─────────────────────────────────────────────────────────

/** Compute HMAC-SHA256 of a payload using the given secret. */
export function signWebhookPayload(body: string, secret: string): string {
  const mac = createHmac("sha256", secret);
  mac.update(body);
  return mac.digest("hex");
}

/** Verify that a signature header matches the expected HMAC-SHA256. */
export function verifyWebhookSignature(
  body: string,
  secret: string,
  signature: string
): boolean {
  const expected = `sha256=${signWebhookPayload(body, secret)}`;
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ── Handler Factory ──────────────────────────────────────────────────────

type HandlerResult = {
  status: number;
  body: RegistrationResponse | AuthRequiredResponse | AgentErrorEnvelope;
};

export function createOnboardingHandler(config: OnboardingConfig) {
  const {
    provisioningWebhook,
    webhookSecret,
    webhookTimeoutMs = 10_000,
    requireIdentity = false,
    allowedProviders,
    authDocs,
    rateLimit,
  } = config;

  // In-memory rate limit state.
  const windows = new Map<string, RateLimitWindow>();

  function checkRateLimit(ip: string): boolean {
    if (!rateLimit) return true;
    const now = Date.now();
    const { maxRegistrations, windowMs } = rateLimit;

    const win = windows.get(ip);
    if (!win || now >= win.resetAt) {
      windows.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (win.count >= maxRegistrations) return false;
    win.count++;
    return true;
  }

  function makeError(
    status: number,
    code: string,
    message: string
  ): AgentErrorEnvelope {
    return {
      type: "agent_error",
      code,
      message,
      status,
      is_retriable: status === 429 || status === 502,
    };
  }

  async function callWebhook(
    webhookReq: WebhookRequest
  ): Promise<RegistrationResponse> {
    const bodyStr = JSON.stringify(webhookReq);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (webhookSecret) {
      headers["X-Webhook-Signature"] = `sha256=${signWebhookPayload(bodyStr, webhookSecret)}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), webhookTimeoutMs);

    try {
      const resp = await fetch(provisioningWebhook, {
        method: "POST",
        headers,
        body: bodyStr,
        signal: controller.signal,
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(
          `Webhook returned status ${resp.status}: ${text.slice(0, 200)}`
        );
      }

      return (await resp.json()) as RegistrationResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Handle POST /agent/register. */
  async function handleRegister(
    body: RegistrationRequest,
    clientIp: string
  ): Promise<HandlerResult> {
    // Rate limit check.
    if (!checkRateLimit(clientIp)) {
      return {
        status: 429,
        body: makeError(
          429,
          "rate_limit_exceeded",
          "Too many registration attempts. Try again later."
        ),
      };
    }

    // Validate required fields.
    if (!body.agent_id) {
      return {
        status: 400,
        body: makeError(400, "missing_field", "agent_id is required"),
      };
    }
    if (!body.agent_name) {
      return {
        status: 400,
        body: makeError(400, "missing_field", "agent_name is required"),
      };
    }
    if (!body.agent_provider) {
      return {
        status: 400,
        body: makeError(400, "missing_field", "agent_provider is required"),
      };
    }

    // Check identity requirement.
    if (requireIdentity && !body.identity_token) {
      return {
        status: 400,
        body: makeError(
          400,
          "identity_required",
          "This API requires an identity_token for registration"
        ),
      };
    }

    // Check allowed providers.
    if (allowedProviders && allowedProviders.length > 0) {
      const allowed = allowedProviders.some(
        (p) => p.toLowerCase() === body.agent_provider.toLowerCase()
      );
      if (!allowed) {
        return {
          status: 403,
          body: makeError(
            403,
            "provider_not_allowed",
            `Agent provider "${body.agent_provider}" is not allowed`
          ),
        };
      }
    }

    // Build webhook request.
    const webhookReq: WebhookRequest = {
      agent_id: body.agent_id,
      agent_name: body.agent_name,
      agent_provider: body.agent_provider,
      identity_verified: !!body.identity_token,
      request_ip: clientIp,
      timestamp: new Date().toISOString(),
    };

    // Call provisioning webhook.
    let resp: RegistrationResponse;
    try {
      resp = await callWebhook(webhookReq);
    } catch (err) {
      return {
        status: 502,
        body: makeError(
          502,
          "webhook_error",
          "Failed to provision credentials. Please try again later."
        ),
      };
    }

    const status = resp.status === "rejected" ? 403 : 200;
    return { status, body: resp };
  }

  /** Check if a request should get a 401 auth-required response. */
  function shouldReturn401(
    path: string,
    headers: Record<string, string | undefined>
  ): boolean {
    // Don't block discovery/well-known paths.
    if (path.startsWith("/.well-known/") || EXEMPT_PATHS.has(path)) {
      return false;
    }
    // Check for any auth credential.
    if (headers["authorization"]) return false;
    if (headers["x-api-key"]) return false;
    return true;
  }

  /** Get the standard 401 response body. */
  function getAuthRequiredResponse(): AuthRequiredResponse {
    return {
      error: "auth_required",
      message:
        "This API requires authentication. Register to get credentials.",
      register_url: "/agent/register",
      auth_docs: authDocs,
      supported_credential_types: [...SUPPORTED_CREDENTIAL_TYPES],
    };
  }

  return { handleRegister, shouldReturn401, getAuthRequiredResponse };
}
