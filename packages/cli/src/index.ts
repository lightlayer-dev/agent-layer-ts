import { scoreUrl } from "./scorer.js";
import { formatReport } from "./reporter.js";

const HELP = `
  🤖 @agent-layer/cli — Agent-Readiness Score

  Score any API URL for how well it works with AI agents.
  Like Lighthouse, but for agent-readiness.

  Usage:
    agent-layer score <url> [options]

  Options:
    --json     Output raw JSON instead of formatted report
    --help     Show this help message

  Examples:
    agent-layer score https://api.example.com
    agent-layer score https://api.example.com --json
`;

interface ParsedArgs {
  command: string | null;
  url: string | null;
  json: boolean;
  help: boolean;
}

export function parseArgs(argv: string[]): ParsedArgs {
  // Skip node and script path (first two args)
  const args = argv.slice(2);

  const result: ParsedArgs = {
    command: null,
    url: null,
    json: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === "--json") {
      result.json = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (!result.command) {
      result.command = arg;
    } else if (!result.url) {
      result.url = arg;
    }
  }

  return result;
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv);

  if (parsed.help || !parsed.command) {
    console.log(HELP);
    process.exit(parsed.help ? 0 : 1);
  }

  if (parsed.command !== "score") {
    console.error(`\n  Unknown command: ${parsed.command}\n`);
    console.log(HELP);
    process.exit(1);
  }

  if (!parsed.url) {
    console.error("\n  Error: Please provide a URL to score\n");
    console.log("  Usage: agent-layer score <url>\n");
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(parsed.url);
  } catch {
    console.error(`\n  Error: Invalid URL: ${parsed.url}\n`);
    process.exit(1);
  }

  try {
    const result = await scoreUrl(parsed.url);

    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatReport(result));
    }

    // Exit with non-zero if score is very low
    process.exit(result.totalScore < 20 ? 1 : 0);
  } catch (err) {
    console.error(
      `\n  Error scoring ${parsed.url}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  }
}

// Only run when executed as CLI, not when imported (e.g., by tests via vitest)
const isVitest = typeof process !== "undefined" && process.env["VITEST"];

if (!isVitest) {
  main();
}
