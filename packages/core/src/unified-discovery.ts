/**
 * Unified Multi-Format Discovery — single config, all agent discovery formats.
 *
 * Generates:
 * - /.well-known/ai       (AI manifest)
 * - /.well-known/agent.json (A2A Agent Card per Google A2A protocol)
 * - /agents.txt            (robots.txt-style permissions for AI agents)
 * - /llms.txt              (LLM-oriented documentation)
 * - /llms-full.txt         (auto-generated from routes)
 *
 * @see https://github.com/nichochar/open-agent-schema (agents.txt)
 * @see https://a2a-protocol.org (A2A Agent Card)
 * @see https://llmstxt.org (llms.txt)
 */

import type { A2AAgentCard, A2ASkill, A2AAuthScheme, A2ACapabilities, A2AProvider } from "./a2a.js";
import { generateAgentCard } from "./a2a.js";
import type { AIManifest, AIManifestAuth, DiscoveryConfig, LlmsTxtConfig, RouteMetadata } from "./types.js";
import { generateAIManifest } from "./discovery.js";
import { generateLlmsTxt, generateLlmsFullTxt } from "./llms-txt.js";

// ── Agents.txt Types ────────────────────────────────────────────────────

/** A rule in agents.txt (allow/disallow per user-agent) */
export interface AgentsTxtRule {
  /** Path pattern (glob-style), e.g. "/api/*", "/private/*" */
  path: string;
  /** "allow" or "disallow" */
  permission: "allow" | "disallow";
}

/** A block in agents.txt targeting one or more user-agents */
export interface AgentsTxtBlock {
  /** User-agent string, or "*" for all agents */
  userAgent: string;
  /** Rules for this user-agent */
  rules: AgentsTxtRule[];
}

/** Configuration for agents.txt generation */
export interface AgentsTxtConfig {
  /** Blocks of user-agent + rules */
  blocks: AgentsTxtBlock[];
  /** Optional sitemap URL for agents */
  sitemapUrl?: string;
  /** Optional comment at the top of the file */
  comment?: string;
}

// ── Unified Config ──────────────────────────────────────────────────────

/** Control which discovery formats are generated */
export interface DiscoveryFormats {
  /** /.well-known/ai manifest. Default: true */
  wellKnownAi?: boolean;
  /** /.well-known/agent.json (A2A Agent Card). Default: true */
  agentCard?: boolean;
  /** /agents.txt (robots.txt for AI agents). Default: true */
  agentsTxt?: boolean;
  /** /llms.txt and /llms-full.txt. Default: true */
  llmsTxt?: boolean;
}

/** Auth configuration shared across discovery formats */
export interface UnifiedAuthConfig {
  /** Auth type */
  type: "oauth2" | "api_key" | "bearer" | "none";
  /** Where the credential goes (for api_key) */
  in?: "header" | "query";
  /** Header/query param name (for api_key) */
  name?: string;
  /** OAuth2 authorization URL */
  authorizationUrl?: string;
  /** OAuth2 token URL */
  tokenUrl?: string;
  /** OAuth2 scopes */
  scopes?: Record<string, string>;
}

/** A skill/capability (maps to A2A skills, llms.txt sections, etc.) */
export interface UnifiedSkill {
  /** Unique ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Example prompts */
  examples?: string[];
  /** Input MIME types */
  inputModes?: string[];
  /** Output MIME types */
  outputModes?: string[];
}

/** Single source of truth for all discovery formats */
export interface UnifiedDiscoveryConfig {
  /** Name of the service/agent */
  name: string;
  /** Description */
  description?: string;
  /** Base URL where the service is hosted */
  url: string;
  /** Version */
  version?: string;
  /** Provider/organization info */
  provider?: A2AProvider;
  /** Contact info */
  contact?: { email?: string; url?: string };
  /** OpenAPI spec URL */
  openApiUrl?: string;
  /** Documentation URL */
  documentationUrl?: string;
  /** Capabilities (string list for AI manifest, A2A flags) */
  capabilities?: string[];
  /** A2A-specific capabilities */
  agentCapabilities?: A2ACapabilities;
  /** Auth config (shared across formats) */
  auth?: UnifiedAuthConfig;
  /** Skills/features the service offers */
  skills?: UnifiedSkill[];
  /** Route metadata for llms-full.txt auto-generation */
  routes?: RouteMetadata[];
  /** Agents.txt rules (if agents.txt format is enabled) */
  agentsTxt?: AgentsTxtConfig;
  /** Which formats to serve. All enabled by default. */
  formats?: DiscoveryFormats;
  /** Extra llms.txt sections (appended after auto-generated content) */
  llmsTxtSections?: Array<{ title: string; content: string }>;
}

// ── Generators ──────────────────────────────────────────────────────────

/** Check if a given format is enabled (defaults to true) */
export function isFormatEnabled(
  formats: DiscoveryFormats | undefined,
  format: keyof DiscoveryFormats,
): boolean {
  if (!formats) return true;
  return formats[format] !== false;
}

/** Generate /.well-known/ai manifest from unified config */
export function generateUnifiedAIManifest(config: UnifiedDiscoveryConfig): AIManifest {
  const auth: AIManifestAuth | undefined = config.auth
    ? {
        type: config.auth.type === "bearer" ? "api_key" : config.auth.type,
        authorization_url: config.auth.authorizationUrl,
        token_url: config.auth.tokenUrl,
        scopes: config.auth.scopes,
      }
    : undefined;

  const discoveryConfig: DiscoveryConfig = {
    manifest: {
      name: config.name,
      description: config.description,
      openapi_url: config.openApiUrl,
      llms_txt_url: isFormatEnabled(config.formats, "llmsTxt")
        ? `${config.url}/llms.txt`
        : undefined,
      auth,
      contact: config.contact,
      capabilities: config.capabilities,
    },
  };

  return generateAIManifest(discoveryConfig);
}

/** Generate A2A Agent Card from unified config */
export function generateUnifiedAgentCard(config: UnifiedDiscoveryConfig): A2AAgentCard {
  const authScheme: A2AAuthScheme | undefined = config.auth
    ? {
        type: config.auth.type === "api_key" ? "apiKey" : config.auth.type,
        in: config.auth.in,
        name: config.auth.name,
        authorizationUrl: config.auth.authorizationUrl,
        tokenUrl: config.auth.tokenUrl,
        scopes: config.auth.scopes,
      }
    : undefined;

  const skills: A2ASkill[] = (config.skills ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    tags: s.tags,
    examples: s.examples,
    inputModes: s.inputModes,
    outputModes: s.outputModes,
  }));

  return generateAgentCard({
    card: {
      protocolVersion: "1.0.0",
      name: config.name,
      description: config.description,
      url: config.url,
      provider: config.provider,
      version: config.version,
      documentationUrl: config.documentationUrl ?? config.openApiUrl,
      capabilities: config.agentCapabilities,
      authentication: authScheme,
      skills,
    },
  });
}

/** Generate /llms.txt from unified config */
export function generateUnifiedLlmsTxt(config: UnifiedDiscoveryConfig): string {
  const sections = [
    ...(config.skills ?? []).map((s) => ({
      title: s.name,
      content: [
        s.description ?? "",
        s.examples?.length ? `\nExamples:\n${s.examples.map((e) => `- ${e}`).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    })),
    ...(config.llmsTxtSections ?? []),
  ];

  const llmsConfig: LlmsTxtConfig = {
    title: config.name,
    description: config.description,
    sections,
  };

  return generateLlmsTxt(llmsConfig);
}

/** Generate /llms-full.txt from unified config (with routes) */
export function generateUnifiedLlmsFullTxt(config: UnifiedDiscoveryConfig): string {
  const sections = [
    ...(config.skills ?? []).map((s) => ({
      title: s.name,
      content: [
        s.description ?? "",
        s.examples?.length ? `\nExamples:\n${s.examples.map((e) => `- ${e}`).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    })),
    ...(config.llmsTxtSections ?? []),
  ];

  const llmsConfig: LlmsTxtConfig = {
    title: config.name,
    description: config.description,
    sections,
  };

  return generateLlmsFullTxt(llmsConfig, config.routes ?? []);
}

/** Generate /agents.txt from unified config */
export function generateAgentsTxt(config: UnifiedDiscoveryConfig): string {
  const agentsTxtConfig = config.agentsTxt;
  if (!agentsTxtConfig) {
    // Generate a sensible default: allow all agents to all paths
    return `# agents.txt — AI agent access rules for ${config.name}\n# See https://github.com/nichochar/open-agent-schema\n\nUser-agent: *\nAllow: /\n`;
  }

  const lines: string[] = [];

  if (agentsTxtConfig.comment) {
    for (const line of agentsTxtConfig.comment.split("\n")) {
      lines.push(`# ${line}`);
    }
    lines.push("");
  }

  for (const block of agentsTxtConfig.blocks) {
    lines.push(`User-agent: ${block.userAgent}`);
    for (const rule of block.rules) {
      const directive = rule.permission === "allow" ? "Allow" : "Disallow";
      lines.push(`${directive}: ${rule.path}`);
    }
    lines.push("");
  }

  if (agentsTxtConfig.sitemapUrl) {
    lines.push(`Sitemap: ${agentsTxtConfig.sitemapUrl}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate all enabled discovery documents from a unified config.
 * Returns a map of path → content (string for text, object for JSON).
 */
export function generateAllDiscovery(
  config: UnifiedDiscoveryConfig,
): Map<string, string | object> {
  const result = new Map<string, string | object>();

  if (isFormatEnabled(config.formats, "wellKnownAi")) {
    result.set("/.well-known/ai", generateUnifiedAIManifest(config));
  }

  if (isFormatEnabled(config.formats, "agentCard")) {
    result.set("/.well-known/agent.json", generateUnifiedAgentCard(config));
  }

  if (isFormatEnabled(config.formats, "llmsTxt")) {
    result.set("/llms.txt", generateUnifiedLlmsTxt(config));
    result.set("/llms-full.txt", generateUnifiedLlmsFullTxt(config));
  }

  if (isFormatEnabled(config.formats, "agentsTxt")) {
    result.set("/agents.txt", generateAgentsTxt(config));
  }

  return result;
}
