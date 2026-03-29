import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createOnboardingHandler,
  signWebhookPayload,
  verifyWebhookSignature,
  type OnboardingConfig,
  type RegistrationRequest,
  type RegistrationResponse,
} from "./agent-onboarding.js";

// ── Test Helpers ─────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<OnboardingConfig> = {}): OnboardingConfig {
  return {
    provisioningWebhook: "https://api.example.com/provision",
    ...overrides,
  };
}

function makeRequest(overrides: Partial<RegistrationRequest> = {}): RegistrationRequest {
  return {
    agent_id: "agent-123",
    agent_name: "Test Agent",
    agent_provider: "openai",
    ...overrides,
  };
}

const PROVISIONED_RESPONSE: RegistrationResponse = {
  status: "provisioned",
  credentials: {
    type: "api_key",
    token: "sk-test-abc123",
    header: "X-API-Key",
  },
};

const REJECTED_RESPONSE: RegistrationResponse = {
  status: "rejected",
  reason: "Agent not approved",
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("agent-onboarding", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(PROVISIONED_RESPONSE),
        text: () => Promise.resolve(""),
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("handleRegister", () => {
    it("registers an agent successfully", async () => {
      const handler = createOnboardingHandler(makeConfig());
      const result = await handler.handleRegister(makeRequest(), "1.2.3.4");

      expect(result.status).toBe(200);
      expect(result.body).toEqual(PROVISIONED_RESPONSE);
      expect(fetch).toHaveBeenCalledOnce();

      const call = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(call[1]!.body as string);
      expect(body.agent_id).toBe("agent-123");
      expect(body.agent_name).toBe("Test Agent");
      expect(body.agent_provider).toBe("openai");
      expect(body.identity_verified).toBe(false);
      expect(body.request_ip).toBe("1.2.3.4");
      expect(body.timestamp).toBeDefined();
    });

    it("sends webhook signature when secret is configured", async () => {
      const handler = createOnboardingHandler(
        makeConfig({ webhookSecret: "test-secret" })
      );
      await handler.handleRegister(makeRequest(), "1.2.3.4");

      const call = vi.mocked(fetch).mock.calls[0];
      const headers = call[1]!.headers as Record<string, string>;
      expect(headers["X-Webhook-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("rejects when agent_id is missing", async () => {
      const handler = createOnboardingHandler(makeConfig());
      const result = await handler.handleRegister(
        makeRequest({ agent_id: "" }),
        "1.2.3.4"
      );

      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ code: "missing_field" });
    });

    it("rejects when agent_name is missing", async () => {
      const handler = createOnboardingHandler(makeConfig());
      const result = await handler.handleRegister(
        makeRequest({ agent_name: "" }),
        "1.2.3.4"
      );

      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ code: "missing_field" });
    });

    it("rejects when agent_provider is missing", async () => {
      const handler = createOnboardingHandler(makeConfig());
      const result = await handler.handleRegister(
        makeRequest({ agent_provider: "" }),
        "1.2.3.4"
      );

      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ code: "missing_field" });
    });

    it("rejects when identity is required but not provided", async () => {
      const handler = createOnboardingHandler(
        makeConfig({ requireIdentity: true })
      );
      const result = await handler.handleRegister(makeRequest(), "1.2.3.4");

      expect(result.status).toBe(400);
      expect(result.body).toMatchObject({ code: "identity_required" });
    });

    it("accepts when identity is required and provided", async () => {
      const handler = createOnboardingHandler(
        makeConfig({ requireIdentity: true })
      );
      const result = await handler.handleRegister(
        makeRequest({ identity_token: "eyJ..." }),
        "1.2.3.4"
      );

      expect(result.status).toBe(200);

      const call = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(call[1]!.body as string);
      expect(body.identity_verified).toBe(true);
    });

    it("rejects when provider is not in allowed list", async () => {
      const handler = createOnboardingHandler(
        makeConfig({ allowedProviders: ["anthropic", "google"] })
      );
      const result = await handler.handleRegister(makeRequest(), "1.2.3.4");

      expect(result.status).toBe(403);
      expect(result.body).toMatchObject({ code: "provider_not_allowed" });
    });

    it("allows provider with case-insensitive matching", async () => {
      const handler = createOnboardingHandler(
        makeConfig({ allowedProviders: ["OpenAI"] })
      );
      const result = await handler.handleRegister(makeRequest(), "1.2.3.4");

      expect(result.status).toBe(200);
    });

    it("rate limits registrations per IP", async () => {
      const handler = createOnboardingHandler(
        makeConfig({
          rateLimit: { maxRegistrations: 2, windowMs: 60_000 },
        })
      );

      const r1 = await handler.handleRegister(makeRequest(), "1.2.3.4");
      const r2 = await handler.handleRegister(makeRequest(), "1.2.3.4");
      const r3 = await handler.handleRegister(makeRequest(), "1.2.3.4");

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r3.status).toBe(429);
      expect(r3.body).toMatchObject({ code: "rate_limit_exceeded" });
    });

    it("rate limits per IP independently", async () => {
      const handler = createOnboardingHandler(
        makeConfig({
          rateLimit: { maxRegistrations: 1, windowMs: 60_000 },
        })
      );

      const r1 = await handler.handleRegister(makeRequest(), "1.2.3.4");
      const r2 = await handler.handleRegister(makeRequest(), "5.6.7.8");

      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
    });

    it("returns 403 for rejected registrations", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(REJECTED_RESPONSE),
          text: () => Promise.resolve(""),
        })
      );

      const handler = createOnboardingHandler(makeConfig());
      const result = await handler.handleRegister(makeRequest(), "1.2.3.4");

      expect(result.status).toBe(403);
      expect(result.body).toEqual(REJECTED_RESPONSE);
    });

    it("returns 502 when webhook fails", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Internal Server Error"),
        })
      );

      const handler = createOnboardingHandler(makeConfig());
      const result = await handler.handleRegister(makeRequest(), "1.2.3.4");

      expect(result.status).toBe(502);
      expect(result.body).toMatchObject({ code: "webhook_error" });
    });

    it("returns 502 when webhook throws (timeout/network)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("network error"))
      );

      const handler = createOnboardingHandler(makeConfig());
      const result = await handler.handleRegister(makeRequest(), "1.2.3.4");

      expect(result.status).toBe(502);
      expect(result.body).toMatchObject({ code: "webhook_error" });
    });
  });

  describe("shouldReturn401", () => {
    const handler = createOnboardingHandler(makeConfig());

    it("returns true for unauthenticated requests to regular paths", () => {
      expect(handler.shouldReturn401("/api/data", {})).toBe(true);
    });

    it("returns false when Authorization header is present", () => {
      expect(
        handler.shouldReturn401("/api/data", {
          authorization: "Bearer token",
        })
      ).toBe(false);
    });

    it("returns false when X-API-Key header is present", () => {
      expect(
        handler.shouldReturn401("/api/data", { "x-api-key": "key123" })
      ).toBe(false);
    });

    it("returns false for /.well-known/ paths", () => {
      expect(handler.shouldReturn401("/.well-known/agent.json", {})).toBe(
        false
      );
    });

    it("returns false for /llms.txt", () => {
      expect(handler.shouldReturn401("/llms.txt", {})).toBe(false);
    });

    it("returns false for /llms-full.txt", () => {
      expect(handler.shouldReturn401("/llms-full.txt", {})).toBe(false);
    });

    it("returns false for /agents.txt", () => {
      expect(handler.shouldReturn401("/agents.txt", {})).toBe(false);
    });

    it("returns false for /robots.txt", () => {
      expect(handler.shouldReturn401("/robots.txt", {})).toBe(false);
    });

    it("returns false for /agent/register", () => {
      expect(handler.shouldReturn401("/agent/register", {})).toBe(false);
    });
  });

  describe("getAuthRequiredResponse", () => {
    it("returns standard auth-required response", () => {
      const handler = createOnboardingHandler(
        makeConfig({ authDocs: "https://docs.example.com/auth" })
      );
      const resp = handler.getAuthRequiredResponse();

      expect(resp.error).toBe("auth_required");
      expect(resp.register_url).toBe("/agent/register");
      expect(resp.auth_docs).toBe("https://docs.example.com/auth");
      expect(resp.supported_credential_types).toEqual([
        "api_key",
        "oauth2_client_credentials",
        "bearer",
      ]);
    });
  });

  describe("signWebhookPayload / verifyWebhookSignature", () => {
    it("produces a valid hex signature", () => {
      const sig = signWebhookPayload('{"test":true}', "secret");
      expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });

    it("verifies a valid signature", () => {
      const body = '{"agent_id":"test"}';
      const secret = "my-secret";
      const sig = `sha256=${signWebhookPayload(body, secret)}`;
      expect(verifyWebhookSignature(body, secret, sig)).toBe(true);
    });

    it("rejects an invalid signature", () => {
      expect(
        verifyWebhookSignature('{"test":true}', "secret", "sha256=bad")
      ).toBe(false);
    });

    it("rejects a signature with wrong prefix", () => {
      const body = '{"test":true}';
      const sig = signWebhookPayload(body, "secret");
      expect(verifyWebhookSignature(body, "secret", sig)).toBe(false);
    });
  });
});
