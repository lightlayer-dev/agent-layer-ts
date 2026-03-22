import { describe, it, expect } from "vitest";
import { formatReport, formatJson, badgeUrl } from "./reporter.js";
import type { ScoreReport } from "./types.js";

const mockReport: ScoreReport = {
  url: "https://example.com",
  timestamp: "2026-03-22T14:00:00.000Z",
  score: 65,
  durationMs: 1234,
  checks: [
    {
      id: "test-pass",
      name: "Test Pass",
      score: 10,
      maxScore: 10,
      severity: "pass",
      message: "Everything looks good",
    },
    {
      id: "test-warn",
      name: "Test Warn",
      score: 5,
      maxScore: 10,
      severity: "warn",
      message: "Could be better",
      suggestion: "Try harder",
    },
    {
      id: "test-fail",
      name: "Test Fail",
      score: 0,
      maxScore: 10,
      severity: "fail",
      message: "Not found",
      suggestion: "Add this feature",
    },
  ],
};

describe("formatReport", () => {
  it("produces terminal output with score", () => {
    const output = formatReport(mockReport);
    expect(output).toContain("65/100");
    expect(output).toContain("example.com");
  });

  it("includes suggestions for failing checks", () => {
    const output = formatReport(mockReport);
    expect(output).toContain("Add this feature");
  });
});

describe("formatJson", () => {
  it("produces valid JSON", () => {
    const json = formatJson(mockReport);
    const parsed = JSON.parse(json);
    expect(parsed.score).toBe(65);
    expect(parsed.checks).toHaveLength(3);
  });
});

describe("badgeUrl", () => {
  it("returns green for high scores", () => {
    expect(badgeUrl(90)).toContain("brightgreen");
  });

  it("returns yellow for medium scores", () => {
    expect(badgeUrl(60)).toContain("yellow");
  });

  it("returns red for low scores", () => {
    expect(badgeUrl(30)).toContain("red");
  });

  it("encodes the label", () => {
    expect(badgeUrl(80, "My Score")).toContain("My%20Score");
  });
});
