/**
 * A2A (Agent-to-Agent) Protocol — Agent Card generation.
 *
 * Implements the /.well-known/agent.json endpoint per Google's A2A protocol
 * specification (https://a2a-protocol.org).
 *
 * An Agent Card is a JSON metadata document that describes an agent's
 * capabilities, supported input/output modes, authentication requirements,
 * and skills — enabling machine-readable discovery by other agents.
 */

// ── A2A Agent Card Types ────────────────────────────────────────────────

/** Content type supported by the agent (text, images, files, etc.) */
export interface A2AContentType {
  /** MIME type, e.g. "text/plain", "application/json", "image/png" */
  type: string;
}

/** A skill/capability the agent can perform */
export interface A2ASkill {
  /** Unique identifier for the skill */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this skill does */
  description?: string;
  /** Tags for categorization and search */
  tags?: string[];
  /** Example prompts/inputs that trigger this skill */
  examples?: string[];
  /** Input content types this skill accepts */
  inputModes?: string[];
  /** Output content types this skill produces */
  outputModes?: string[];
}

/** Authentication scheme the agent supports */
export interface A2AAuthScheme {
  /** Auth type: "apiKey", "oauth2", "bearer", "none" */
  type: string;
  /** Where to send the credential: "header", "query" */
  in?: string;
  /** Header/query parameter name */
  name?: string;
  /** OAuth2 authorization URL */
  authorizationUrl?: string;
  /** OAuth2 token URL */
  tokenUrl?: string;
  /** OAuth2 scopes */
  scopes?: Record<string, string>;
}

/** Provider/organization info */
export interface A2AProvider {
  /** Organization name */
  organization: string;
  /** URL to the provider's website */
  url?: string;
}

/** Capabilities the agent supports */
export interface A2ACapabilities {
  /** Whether the agent supports streaming responses */
  streaming?: boolean;
  /** Whether the agent supports push notifications */
  pushNotifications?: boolean;
  /** Whether the agent maintains state across messages */
  stateTransitionHistory?: boolean;
}

/** The full Agent Card document served at /.well-known/agent.json */
export interface A2AAgentCard {
  /** Agent Card spec version */
  protocolVersion: string;
  /** Unique name/identifier for the agent */
  name: string;
  /** Human-readable description */
  description?: string;
  /** URL where this agent can be reached */
  url: string;
  /** Provider/organization */
  provider?: A2AProvider;
  /** Version of this agent */
  version?: string;
  /** URL to documentation */
  documentationUrl?: string;
  /** Agent capabilities */
  capabilities?: A2ACapabilities;
  /** Authentication schemes */
  authentication?: A2AAuthScheme;
  /** Default input content types */
  defaultInputModes?: string[];
  /** Default output content types */
  defaultOutputModes?: string[];
  /** Skills/capabilities this agent offers */
  skills: A2ASkill[];
}

/** Configuration for generating an Agent Card */
export interface A2AConfig {
  /** The Agent Card data */
  card: A2AAgentCard;
}

// ── Generator ───────────────────────────────────────────────────────────

/**
 * Generate a valid A2A Agent Card JSON object.
 *
 * Ensures required fields are present and sets sensible defaults.
 */
export function generateAgentCard(config: A2AConfig): A2AAgentCard {
  const card = { ...config.card };

  // Default protocol version to latest stable
  if (!card.protocolVersion) {
    card.protocolVersion = "1.0.0";
  }

  // Default input/output modes to text
  if (!card.defaultInputModes) {
    card.defaultInputModes = ["text/plain"];
  }
  if (!card.defaultOutputModes) {
    card.defaultOutputModes = ["text/plain"];
  }

  // Ensure skills is always an array
  if (!card.skills) {
    card.skills = [];
  }

  return card;
}

/**
 * Validate an Agent Card has the minimum required fields.
 * Returns an array of error messages (empty = valid).
 */
export function validateAgentCard(card: Partial<A2AAgentCard>): string[] {
  const errors: string[] = [];

  if (!card.name) errors.push("name is required");
  if (!card.url) errors.push("url is required");
  if (!card.skills) errors.push("skills is required");
  if (!card.protocolVersion) errors.push("protocolVersion is required");

  if (card.url && !card.url.startsWith("http")) {
    errors.push("url must be an HTTP(S) URL");
  }

  if (card.skills && !Array.isArray(card.skills)) {
    errors.push("skills must be an array");
  }

  if (card.skills && Array.isArray(card.skills)) {
    for (const skill of card.skills) {
      if (!skill.id) errors.push("each skill must have an id");
      if (!skill.name) errors.push("each skill must have a name");
    }
  }

  return errors;
}
