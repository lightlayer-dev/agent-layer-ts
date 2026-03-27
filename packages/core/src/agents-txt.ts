/**
 * agents.txt — a robots.txt-style permission and capability declaration for AI agents.
 *
 * Generates a human- and machine-readable text file at /agents.txt that tells agents:
 * - What paths they can access
 * - What rate limits apply
 * - What auth is required
 * - What interface (REST, MCP, etc.) is preferred
 *
 * Inspired by robots.txt but purpose-built for the agentic web.
 */

// ── Types ───────────────────────────────────────────────────────────────

/** Rate limit declaration for agents.txt */
export interface AgentsTxtRateLimit {
  /** Maximum requests per window */
  max: number;
  /** Window size in seconds (default: 60) */
  windowSeconds?: number;
}

/** A single rule block in agents.txt */
export interface AgentsTxtRule {
  /** Agent name pattern to match (e.g. "*", "GPT-*", "ClaudeBot") */
  agent: string;
  /** Allowed path patterns (glob-style) */
  allow?: string[];
  /** Denied path patterns (glob-style) */
  deny?: string[];
  /** Rate limit for matching agents */
  rateLimit?: AgentsTxtRateLimit;
  /** Preferred interface for interacting with this service */
  preferredInterface?: "rest" | "mcp" | "graphql" | "a2a";
  /** Auth requirement description */
  auth?: {
    type: "bearer" | "api_key" | "oauth2" | "none";
    /** URL to obtain credentials */
    endpoint?: string;
    /** Docs URL for auth */
    docsUrl?: string;
  };
  /** Free-form description/instructions for the agent */
  description?: string;
}

/** Top-level agents.txt configuration */
export interface AgentsTxtConfig {
  /** Rules applied in order (first match wins per path, like robots.txt) */
  rules: AgentsTxtRule[];
  /** Optional site-wide metadata */
  siteName?: string;
  /** Contact URL or email for the site owner */
  contact?: string;
  /** URL to the full agent discovery endpoint */
  discoveryUrl?: string;
}

// ── Generator ───────────────────────────────────────────────────────────

/**
 * Generate the agents.txt file content from configuration.
 *
 * Output format:
 * ```
 * # agents.txt — AI Agent Access Policy
 * # Site: My API
 * # Contact: support@example.com
 * # Discovery: https://example.com/.well-known/ai
 *
 * User-agent: *
 * Allow: /api/public/*
 * Deny: /api/admin/*
 * Rate-limit: 100/60s
 * Preferred-interface: rest
 * Auth: bearer https://example.com/oauth/token
 * ```
 */
export function generateAgentsTxt(config: AgentsTxtConfig): string {
  const lines: string[] = [];

  // Header
  lines.push("# agents.txt — AI Agent Access Policy");

  if (config.siteName) {
    lines.push(`# Site: ${config.siteName}`);
  }

  if (config.contact) {
    lines.push(`# Contact: ${config.contact}`);
  }

  if (config.discoveryUrl) {
    lines.push(`# Discovery: ${config.discoveryUrl}`);
  }

  // Rules
  for (const rule of config.rules) {
    lines.push("");
    lines.push(`User-agent: ${rule.agent}`);

    if (rule.description) {
      lines.push(`# ${rule.description}`);
    }

    if (rule.allow) {
      for (const path of rule.allow) {
        lines.push(`Allow: ${path}`);
      }
    }

    if (rule.deny) {
      for (const path of rule.deny) {
        lines.push(`Deny: ${path}`);
      }
    }

    if (rule.rateLimit) {
      const window = rule.rateLimit.windowSeconds ?? 60;
      lines.push(`Rate-limit: ${rule.rateLimit.max}/${window}s`);
    }

    if (rule.preferredInterface) {
      lines.push(`Preferred-interface: ${rule.preferredInterface}`);
    }

    if (rule.auth) {
      const authParts: string[] = [rule.auth.type];
      if (rule.auth.endpoint) authParts.push(rule.auth.endpoint);
      lines.push(`Auth: ${authParts.join(" ")}`);
      if (rule.auth.docsUrl) {
        lines.push(`Auth-docs: ${rule.auth.docsUrl}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Parse an agents.txt string back into structured rules.
 * Useful for agents that need to read and obey agents.txt from other sites.
 */
export function parseAgentsTxt(content: string): AgentsTxtConfig {
  const lines = content.split("\n");
  const config: AgentsTxtConfig = { rules: [] };
  let currentRule: AgentsTxtRule | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Header comments
    if (line.startsWith("# Site:")) {
      config.siteName = line.slice("# Site:".length).trim();
      continue;
    }
    if (line.startsWith("# Contact:")) {
      config.contact = line.slice("# Contact:".length).trim();
      continue;
    }
    if (line.startsWith("# Discovery:")) {
      config.discoveryUrl = line.slice("# Discovery:".length).trim();
      continue;
    }

    // Skip other comments and empty lines (but only before/between rules)
    if (line === "" || (line.startsWith("#") && !currentRule)) {
      continue;
    }

    // Inline comments within a rule block — skip
    if (line.startsWith("#") && currentRule) {
      continue;
    }

    // Parse directives
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const directive = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (directive === "user-agent") {
      // Start a new rule block
      currentRule = { agent: value };
      config.rules.push(currentRule);
      continue;
    }

    if (!currentRule) continue;

    switch (directive) {
      case "allow":
        if (!currentRule.allow) currentRule.allow = [];
        currentRule.allow.push(value);
        break;

      case "deny":
        if (!currentRule.deny) currentRule.deny = [];
        currentRule.deny.push(value);
        break;

      case "rate-limit": {
        const match = value.match(/^(\d+)\/(\d+)s$/);
        if (match) {
          currentRule.rateLimit = {
            max: parseInt(match[1], 10),
            windowSeconds: parseInt(match[2], 10),
          };
        }
        break;
      }

      case "preferred-interface":
        if (["rest", "mcp", "graphql", "a2a"].includes(value)) {
          currentRule.preferredInterface = value as AgentsTxtRule["preferredInterface"];
        }
        break;

      case "auth": {
        const parts = value.split(/\s+/);
        const type = parts[0] as AgentsTxtRule["auth"] extends infer T
          ? T extends { type: infer U } ? U : never
          : never;
        currentRule.auth = {
          type: type as "bearer" | "api_key" | "oauth2" | "none",
          endpoint: parts[1],
        };
        break;
      }

      case "auth-docs":
        if (currentRule.auth) {
          currentRule.auth.docsUrl = value;
        }
        break;
    }
  }

  return config;
}

/**
 * Check whether a given agent + path combination is allowed by the rules.
 *
 * @param config - Parsed agents.txt config
 * @param agentName - The User-Agent or agent identifier
 * @param path - The request path
 * @returns true if allowed, false if denied, undefined if no matching rule
 */
export function isAgentAllowed(
  config: AgentsTxtConfig,
  agentName: string,
  path: string,
): boolean | undefined {
  // Find the most specific matching rule (exact name > pattern > wildcard)
  const matchingRule = findMatchingRule(config.rules, agentName);

  if (!matchingRule) return undefined;

  // Check deny first (deny takes precedence over allow within the same rule)
  if (matchingRule.deny) {
    for (const pattern of matchingRule.deny) {
      if (pathMatches(path, pattern)) return false;
    }
  }

  // Check allow
  if (matchingRule.allow) {
    for (const pattern of matchingRule.allow) {
      if (pathMatches(path, pattern)) return true;
    }
    // If allow rules exist but none matched, deny by default
    return false;
  }

  // No allow/deny rules — implicitly allowed
  return true;
}

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Find the best matching rule for an agent name.
 * Priority: exact match > prefix pattern > wildcard
 */
function findMatchingRule(
  rules: AgentsTxtRule[],
  agentName: string,
): AgentsTxtRule | undefined {
  let wildcardRule: AgentsTxtRule | undefined;
  let patternRule: AgentsTxtRule | undefined;
  let exactRule: AgentsTxtRule | undefined;

  for (const rule of rules) {
    if (rule.agent === "*") {
      wildcardRule = rule;
    } else if (rule.agent.endsWith("*")) {
      const prefix = rule.agent.slice(0, -1);
      if (agentName.startsWith(prefix)) {
        patternRule = rule;
      }
    } else if (rule.agent === agentName) {
      exactRule = rule;
    }
  }

  return exactRule ?? patternRule ?? wildcardRule;
}

/**
 * Simple glob-style path matching.
 * Supports trailing * for prefix matching.
 */
function pathMatches(path: string, pattern: string): boolean {
  if (pattern === "*" || pattern === "/*") return true;

  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return path.startsWith(prefix);
  }

  return path === pattern;
}
