import type { LlmsTxtConfig, RouteMetadata } from "./types.js";

/**
 * Generate llms.txt content from manual config sections.
 */
export function generateLlmsTxt(config: LlmsTxtConfig): string {
  const lines: string[] = [];

  lines.push(`# ${config.title}`);

  if (config.description) {
    lines.push("");
    lines.push(`> ${config.description}`);
  }

  if (config.sections) {
    for (const section of config.sections) {
      lines.push("");
      lines.push(`## ${section.title}`);
      lines.push("");
      lines.push(section.content);
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Auto-generate llms-full.txt from route metadata.
 * Includes all route information in a format optimized for LLM consumption.
 */
export function generateLlmsFullTxt(
  config: LlmsTxtConfig,
  routes: RouteMetadata[],
): string {
  const lines: string[] = [];

  // Start with the base content
  lines.push(`# ${config.title}`);

  if (config.description) {
    lines.push("");
    lines.push(`> ${config.description}`);
  }

  if (config.sections) {
    for (const section of config.sections) {
      lines.push("");
      lines.push(`## ${section.title}`);
      lines.push("");
      lines.push(section.content);
    }
  }

  // Add auto-generated route documentation
  if (routes.length > 0) {
    lines.push("");
    lines.push("## API Endpoints");

    for (const route of routes) {
      lines.push("");
      lines.push(`### ${route.method.toUpperCase()} ${route.path}`);

      if (route.summary) {
        lines.push("");
        lines.push(route.summary);
      }

      if (route.description) {
        lines.push("");
        lines.push(route.description);
      }

      if (route.parameters && route.parameters.length > 0) {
        lines.push("");
        lines.push("**Parameters:**");
        for (const param of route.parameters) {
          const required = param.required ? " (required)" : "";
          const desc = param.description ? ` — ${param.description}` : "";
          lines.push(`- \`${param.name}\` (${param.in})${required}${desc}`);
        }
      }
    }
  }

  return lines.join("\n") + "\n";
}
