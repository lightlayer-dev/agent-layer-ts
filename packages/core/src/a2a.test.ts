import { describe, it, expect } from "vitest";
import { generateAgentCard, validateAgentCard } from "./a2a.js";
import type { A2AConfig, A2AAgentCard } from "./a2a.js";

const minimalConfig: A2AConfig = {
  card: {
    protocolVersion: "1.0.0",
    name: "test-agent",
    url: "https://example.com/agent",
    skills: [
      { id: "search", name: "Web Search", description: "Search the web" },
    ],
  },
};

describe("generateAgentCard", () => {
  it("returns a valid agent card from minimal config", () => {
    const card = generateAgentCard(minimalConfig);
    expect(card.name).toBe("test-agent");
    expect(card.url).toBe("https://example.com/agent");
    expect(card.protocolVersion).toBe("1.0.0");
    expect(card.skills).toHaveLength(1);
    expect(card.skills[0].id).toBe("search");
  });

  it("sets default input/output modes to text/plain", () => {
    const card = generateAgentCard(minimalConfig);
    expect(card.defaultInputModes).toEqual(["text/plain"]);
    expect(card.defaultOutputModes).toEqual(["text/plain"]);
  });

  it("preserves custom input/output modes", () => {
    const card = generateAgentCard({
      card: {
        ...minimalConfig.card,
        defaultInputModes: ["application/json"],
        defaultOutputModes: ["application/json", "text/plain"],
      },
    });
    expect(card.defaultInputModes).toEqual(["application/json"]);
    expect(card.defaultOutputModes).toEqual(["application/json", "text/plain"]);
  });

  it("defaults protocolVersion to 1.0.0 when omitted", () => {
    const card = generateAgentCard({
      card: { ...minimalConfig.card, protocolVersion: "" as any },
    });
    expect(card.protocolVersion).toBe("1.0.0");
  });

  it("includes optional fields when provided", () => {
    const card = generateAgentCard({
      card: {
        ...minimalConfig.card,
        description: "A test agent",
        version: "2.1.0",
        provider: { organization: "LightLayer", url: "https://lightlayer.dev" },
        documentationUrl: "https://docs.example.com",
        capabilities: { streaming: true, pushNotifications: false },
        authentication: { type: "apiKey", in: "header", name: "X-Agent-Key" },
      },
    });
    expect(card.description).toBe("A test agent");
    expect(card.version).toBe("2.1.0");
    expect(card.provider?.organization).toBe("LightLayer");
    expect(card.capabilities?.streaming).toBe(true);
    expect(card.authentication?.type).toBe("apiKey");
  });

  it("includes skill tags and examples", () => {
    const card = generateAgentCard({
      card: {
        ...minimalConfig.card,
        skills: [
          {
            id: "translate",
            name: "Translation",
            tags: ["nlp", "i18n"],
            examples: ["Translate hello to French"],
            inputModes: ["text/plain"],
            outputModes: ["text/plain"],
          },
        ],
      },
    });
    expect(card.skills[0].tags).toEqual(["nlp", "i18n"]);
    expect(card.skills[0].examples).toEqual(["Translate hello to French"]);
  });
});

describe("validateAgentCard", () => {
  it("returns no errors for a valid card", () => {
    const errors = validateAgentCard(minimalConfig.card);
    expect(errors).toEqual([]);
  });

  it("catches missing name", () => {
    const errors = validateAgentCard({ ...minimalConfig.card, name: "" as any });
    expect(errors).toContain("name is required");
  });

  it("catches missing url", () => {
    const errors = validateAgentCard({ ...minimalConfig.card, url: "" as any });
    expect(errors).toContain("url is required");
  });

  it("catches invalid url scheme", () => {
    const errors = validateAgentCard({ ...minimalConfig.card, url: "ftp://bad" });
    expect(errors).toContain("url must be an HTTP(S) URL");
  });

  it("catches missing skills", () => {
    const errors = validateAgentCard({ name: "x", url: "https://x.com", protocolVersion: "1.0.0" } as any);
    expect(errors).toContain("skills is required");
  });

  it("catches skills without id or name", () => {
    const errors = validateAgentCard({
      ...minimalConfig.card,
      skills: [{ id: "", name: "" } as any],
    });
    expect(errors).toContain("each skill must have an id");
    expect(errors).toContain("each skill must have a name");
  });
});
