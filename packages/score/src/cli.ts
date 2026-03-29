#!/usr/bin/env node

/**
 * CLI entry point for agent-layer-score.
 *
 * Usage: npx @agent-layer/score https://example.com
 */

import { Command } from "commander";
import ora from "ora";
import { scan } from "./scanner.js";
import { formatReport, formatJson, badgeUrl, badgeMarkdown } from "./reporter.js";

const program = new Command();

program
  .name("agent-layer-score")
  .description("Score any API or website for agent-readiness — like Lighthouse for AI agents")
  .version("0.1.0")
  .argument("<url>", "URL to score")
  .option("--json", "Output results as JSON")
  .option("--badge", "Output a shields.io badge URL")
  .option("--timeout <ms>", "Request timeout in ms", "10000")
  .option("--threshold <score>", "Minimum score (0-100). Exit 1 if below threshold.")
  .option("--user-agent <string>", "Custom User-Agent string")
  .action(async (url: string, options: Record<string, string | boolean | undefined>) => {
    const spinner = ora(`Scanning ${url}...`).start();

    try {
      const report = await scan({
        url,
        timeoutMs: parseInt(options.timeout as string, 10) || 10000,
        userAgent: options["user-agent"] as string | undefined,
      });

      spinner.stop();

      if (options.json) {
        console.log(formatJson(report));
      } else if (options.badge) {
        console.log("Badge URL:");
        console.log(badgeUrl(report.score));
        console.log("\nMarkdown (copy to your README):");
        console.log(badgeMarkdown(report.score));
        console.log("\nScored by @agent-layer/score — https://github.com/lightlayer-dev/agent-layer-ts");
      } else {
        console.log(formatReport(report));
      }

      const threshold = options.threshold
        ? parseInt(options.threshold as string, 10)
        : 20;

      if (report.score < threshold) {
        console.error(
          `\nScore ${report.score} is below threshold ${threshold}`,
        );
        process.exit(1);
      }
    } catch (error) {
      spinner.fail("Scan failed");
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
