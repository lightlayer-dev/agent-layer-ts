/**
 * Unified Discovery — serve all agent discovery formats from a single config.
 *
 * The agent discovery landscape is fragmenting fast:
 * - /.well-known/ai (custom manifest)
 * - /.well-known/agent.json (Google A2A protocol)
 * - /agents.txt (robots.txt for agents)
 * - /llms.txt + /llms-full.txt (LLM documentation)
 * - JSON-LD structured data
 *
 * This module generates all formats from one source of truth.
 */

import type { AIManifest, AIManifestAuth, LlmsTxtConfig, DiscoveryConfig } from "./types.js";
import type { A2AAgentCard, A2AConfig, A2ASkill, A2AAuthScheme } from "./a2a.js";
import type { AgentsTxtConfig, AgentsTxtRule } from "./agents-txt.js";
import { generateAIManifest, generateJsonLd } from "./discovery.js";
import { generateAgentCard } from "./a2a.js";
import { generateLlmsTxt, generateLlmsFullTxt } from "./llms-txt.js";
import { generateAgentsTxt } from "./agents-txt.js";
import type { RouteMetadata } from "./types.js";

// ── Unified Config ──────────────────────────────────────────────────────

/** Capability/skill declaration used across all formats */
export interface UnifiedSkill {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this capability does */
  description?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Example inputs */
  examples?: string[];
}

/** Auth configuration used across all formats */
export interface UnifiedAuth {
  type: "oauth2" | "api_key" | "bearer" | "none";
  /** OAuth2 authorization URL */
  authorizationUrl?: string;
  /** OAuth2 token URL */
  tokenUrl?: string;
  /** Available scopes */
  scopes?: Record<string, string>;
  /** Docs URL for auth */
  docsUrl?: string;
}

/** Agent access rule (maps to agents.txt) */
export interface UnifiedAgentRule {
  /** Agent name pattern (* for all, prefix* for prefix match) */
  agent: string;
  /** Allowed paths */
  allow?: string[];
  /** Denied paths */
  deny?: string[];
  /** Rate limit */
  rateLimit?: { max: number; windowSeconds?: number };
  /** Preferred interface */
  preferredInterface?: "rest" | "mcp" | "graphql" | "a2a";
}

/** Control which discovery formats are served */
export interface UnifiedDiscoveryFormats {
  /** /.well-known/ai manifest (default: true) */
  wellKnownAi?: boolean;
  /** /.well-known/agent.json A2A Agent Card (default: true) */
  agentCard?: boolean;
  /** /agents.txt (default: true) */
  agentsTxt?: boolean;
  /** /llms.txt + /llms-full.txt (default: true) */
  llmsTxt?: boolean;
  /** JSON-LD structured data (default: true) */
  jsonLd?: boolean;
}

/** Single source of truth for all discovery formats */
export interface UnifiedDiscoveryConfig {
  /** Service/API name (required — used across all formats) */
  name: string;
  /** Short description */
  description?: string;
  /** Service version */
  version?: string;
  /** Base URL where the service is hosted */
  url?: string;
  /** Provider/organization info */
  provider?: { organization: string; url?: string };
  /** Contact info */
  contact?: { email?: string; url?: string };
  /** URL to OpenAPI spec */
  openapiUrl?: string;
  /** OpenAPI spec object (served at /openapi.json) */
  openApiSpec?: Record<string, unknown>;
  /** Auth configuration */
  auth?: UnifiedAuth;
  /** Capabilities/skills */
  skills?: UnifiedSkill[];
  /** Agent capabilities */
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  };
  /** Agent access rules for agents.txt */
  agentRules?: UnifiedAgentRule[];
  /** Additional llms.txt sections */
  llmsSections?: Array<{ title: string; content: string }>;
  /** Route metadata for llms-full.txt generation */
  routes?: RouteMetadata[];
  /** Control which formats are generated */
  formats?: UnifiedDiscoveryFormats;
}

// ── Generated Outputs ───────────────────────────────────────────────────

export interface UnifiedDiscoveryOutput {
  /** /.well-known/ai manifest JSON */
  wellKnownAi?: AIManifest;
  /** /.well-known/agent.json A2A Agent Card */
  agentCard?: A2AAgentCard;
  /** /agents.txt content string */
  agentsTxt?: string;
  /** /llms.txt content string */
  llmsTxt?: string;
  /** /llms-full.txt content string */
  llmsFullTxt?: string;
  /** JSON-LD structured data object */
  jsonLd?: Record<string, unknown>;
}

// ── Generator ───────────────────────────────────────────────────────────

/**
 * Generate all enabled discovery formats from a single config.
 */
export function generateUnifiedDiscovery(config: UnifiedDiscoveryConfig): UnifiedDiscoveryOutput {
  const formats = {
    wellKnownAi: true,
    agentCard: true,
    agentsTxt: true,
    llmsTxt: true,
    jsonLd: true,
    ...config.formats,
  };

  const output: UnifiedDiscoveryOutput = {};

  // ── /.well-known/ai ────────────────────────────────────────────────
  if (formats.wellKnownAi) {
    const discoveryConfig: DiscoveryConfig = {
      manifest: buildAIManifest(config),
      openApiSpec: config.openApiSpec,
    };
    output.wellKnownAi = generateAIManifest(discoveryConfig);
  }

  // ── JSON-LD ────────────────────────────────────────────────────────
  if (formats.jsonLd) {
    const discoveryConfig: DiscoveryConfig = {
      manifest: buildAIManifest(config),
    };
    output.jsonLd = generateJsonLd(discoveryConfig);
  }

  // ── /.well-known/agent.json (A2A) ─────────────────────────────────
  if (formats.agentCard) {
    const a2aConfig: A2AConfig = {
      card: buildAgentCard(config),
    };
    output.agentCard = generateAgentCard(a2aConfig);
  }

  // ── /agents.txt ────────────────────────────────────────────────────
  if (formats.agentsTxt) {
    const agentsTxtConfig: AgentsTxtConfig = buildAgentsTxtConfig(config);
    output.agentsTxt = generateAgentsTxt(agentsTxtConfig);
  }

  // ── /llms.txt + /llms-full.txt ─────────────────────────────────────
  if (formats.llmsTxt) {
    const llmsConfig: LlmsTxtConfig = {
      title: config.name,
      description: config.description,
      sections: config.llmsSections,
    };
    output.llmsTxt = generateLlmsTxt(llmsConfig);
    output.llmsFullTxt = generateLlmsFullTxt(llmsConfig, config.routes ?? []);
  }

  return output;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function buildAIManifest(config: UnifiedDiscoveryConfig): AIManifest {
  const manifest: AIManifest = {
    name: config.name,
    description: config.description,
    openapi_url: config.openapiUrl,
    contact: config.contact,
  };

  if (config.auth) {
    manifest.auth = {
      type: config.auth.type,
      authorization_url: config.auth.authorizationUrl,
      token_url: config.auth.tokenUrl,
      scopes: config.auth.scopes,
    } as AIManifestAuth;
  }

  if (config.skills) {
    manifest.capabilities = config.skills.map((s) => s.name);
  }

  // Add llms.txt URL hint
  manifest.llms_txt_url = "/llms.txt";

  return manifest;
}

function buildAgentCard(config: UnifiedDiscoveryConfig): A2AAgentCard {
  const skills: A2ASkill[] = (config.skills ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    tags: s.tags,
    examples: s.examples,
    inputModes: ["text/plain"],
    outputModes: ["text/plain", "application/json"],
  }));

  const card: A2AAgentCard = {
    protocolVersion: "1.0.0",
    name: config.name,
    description: config.description,
    url: config.url ?? "",
    provider: config.provider,
    version: config.version,
    capabilities: config.capabilities,
    skills,
  };

  if (config.auth) {
    card.authentication = buildA2AAuth(config.auth);
  }

  return card;
}

function buildA2AAuth(auth: UnifiedAuth): A2AAuthScheme {
  const scheme: A2AAuthScheme = { type: auth.type };

  if (auth.type === "api_key" || auth.type === "bearer") {
    scheme.in = "header";
    scheme.name = auth.type === "api_key" ? "X-Agent-Key" : "Authorization";
  }

  if (auth.authorizationUrl) scheme.authorizationUrl = auth.authorizationUrl;
  if (auth.tokenUrl) scheme.tokenUrl = auth.tokenUrl;
  if (auth.scopes) scheme.scopes = auth.scopes;

  return scheme;
}

function buildAgentsTxtConfig(config: UnifiedDiscoveryConfig): AgentsTxtConfig {
  const rules: AgentsTxtRule[] = (config.agentRules ?? []).map((r) => ({
    agent: r.agent,
    allow: r.allow,
    deny: r.deny,
    rateLimit: r.rateLimit,
    preferredInterface: r.preferredInterface,
  }));

  // If no rules defined, add a permissive default
  if (rules.length === 0) {
    rules.push({ agent: "*" });
  }

  return {
    rules,
    siteName: config.name,
    contact: config.contact?.email ?? config.contact?.url,
    discoveryUrl: "/.well-known/ai",
  };
}
