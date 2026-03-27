/**
 * robots.txt generation with AI agent rules.
 *
 * Generates a robots.txt that explicitly addresses AI agents (GPTBot, ClaudeBot, etc.)
 * to signal intentional access control rather than leaving it ambiguous.
 */

// ── Well-known AI agents ────────────────────────────────────────────────

export const AI_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "Google-Extended",
  "Anthropic",
  "ClaudeBot",
  "CCBot",
  "Amazonbot",
  "Bytespider",
  "Applebot-Extended",
  "PerplexityBot",
  "Cohere-ai",
] as const;

// ── Types ───────────────────────────────────────────────────────────────

export interface RobotsTxtRule {
  /** User-Agent string (e.g. "*", "GPTBot", "ClaudeBot") */
  userAgent: string;
  /** Allowed paths */
  allow?: string[];
  /** Disallowed paths */
  disallow?: string[];
  /** Crawl delay in seconds */
  crawlDelay?: number;
}

export interface RobotsTxtConfig {
  /** Rules in order. If omitted, generates sensible defaults for AI agents. */
  rules?: RobotsTxtRule[];
  /** Sitemap URL(s) to include */
  sitemaps?: string[];
  /** If true, adds rules for all known AI agents. Default: true */
  includeAiAgents?: boolean;
  /** Default policy for AI agents: "allow" or "disallow". Default: "allow" */
  aiAgentPolicy?: "allow" | "disallow";
  /** Paths to allow for AI agents (when using default AI agent rules) */
  aiAllow?: string[];
  /** Paths to disallow for AI agents (when using default AI agent rules) */
  aiDisallow?: string[];
}

// ── Generator ───────────────────────────────────────────────────────────

/**
 * Generate a robots.txt string with AI agent awareness.
 */
export function generateRobotsTxt(config: RobotsTxtConfig = {}): string {
  const lines: string[] = [];

  if (config.rules) {
    // Use explicit rules
    for (const rule of config.rules) {
      lines.push(`User-agent: ${rule.userAgent}`);
      if (rule.allow) {
        for (const path of rule.allow) lines.push(`Allow: ${path}`);
      }
      if (rule.disallow) {
        for (const path of rule.disallow) lines.push(`Disallow: ${path}`);
      }
      if (rule.crawlDelay) {
        lines.push(`Crawl-delay: ${rule.crawlDelay}`);
      }
      lines.push("");
    }
  } else {
    // Generate defaults
    lines.push("User-agent: *");
    lines.push("Allow: /");
    lines.push("");
  }

  // Add AI agent rules if requested (default: true)
  const includeAi = config.includeAiAgents !== false;
  if (includeAi && !config.rules) {
    const policy = config.aiAgentPolicy ?? "allow";
    const aiAllow = config.aiAllow ?? ["/"];
    const aiDisallow = config.aiDisallow ?? [];

    for (const agent of AI_AGENTS) {
      lines.push(`User-agent: ${agent}`);
      if (policy === "allow") {
        for (const path of aiAllow) lines.push(`Allow: ${path}`);
        for (const path of aiDisallow) lines.push(`Disallow: ${path}`);
      } else {
        lines.push("Disallow: /");
      }
      lines.push("");
    }
  }

  // Add sitemaps
  if (config.sitemaps) {
    for (const sitemap of config.sitemaps) {
      lines.push(`Sitemap: ${sitemap}`);
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}
