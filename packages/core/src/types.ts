// ── Error Envelope ──────────────────────────────────────────────────────

export interface AgentErrorEnvelope {
  type: string;
  code: string;
  message: string;
  status: number;
  is_retriable: boolean;
  retry_after?: number;
  param?: string;
  docs_url?: string;
}

export interface AgentErrorOptions {
  type?: string;
  code: string;
  message: string;
  status?: number;
  is_retriable?: boolean;
  retry_after?: number;
  param?: string;
  docs_url?: string;
}

// ── Rate Limiting ───────────────────────────────────────────────────────

export interface RateLimitStore {
  /** Increment the counter for a key. Returns the current count after increment. */
  increment(key: string, windowMs: number): Promise<number>;
  /** Get the current count for a key. */
  get(key: string): Promise<number>;
  /** Reset the counter for a key. */
  reset(key: string): Promise<void>;
}

export interface RateLimitConfig {
  /** Maximum number of requests per window. */
  max: number;
  /** Window size in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
  /** Key extractor function. Default: returns a fixed key (global limit). */
  keyFn?: (req: unknown) => string;
  /** Pluggable store. Default: MemoryStore. */
  store?: RateLimitStore;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  retryAfter?: number;
}

// ── LLMs.txt ────────────────────────────────────────────────────────────

export interface LlmsTxtSection {
  title: string;
  content: string;
}

export interface LlmsTxtConfig {
  /** Site/API title. */
  title: string;
  /** Short description. */
  description?: string;
  /** Manual sections to include. */
  sections?: LlmsTxtSection[];
}

export interface RouteMetadata {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  parameters?: RouteParameter[];
}

export interface RouteParameter {
  name: string;
  in: "path" | "query" | "header" | "body";
  required?: boolean;
  description?: string;
}

// ── Discovery / .well-known/ai ──────────────────────────────────────────

export interface AIManifest {
  /** Human-readable name of the API/service. */
  name: string;
  /** Short description. */
  description?: string;
  /** URL to OpenAPI spec. */
  openapi_url?: string;
  /** URL to llms.txt. */
  llms_txt_url?: string;
  /** Authentication info. */
  auth?: AIManifestAuth;
  /** Contact info. */
  contact?: {
    email?: string;
    url?: string;
  };
  /** Additional capabilities. */
  capabilities?: string[];
}

export interface AIManifestAuth {
  type: "oauth2" | "api_key" | "bearer" | "none";
  authorization_url?: string;
  token_url?: string;
  scopes?: Record<string, string>;
}

export interface DiscoveryConfig {
  manifest: AIManifest;
  /** OpenAPI spec object — passed through as-is. */
  openApiSpec?: Record<string, unknown>;
}

// ── Agent Meta (HTML transform) ─────────────────────────────────────────

export interface AgentMetaConfig {
  /** Agent identifier attribute name. Default: "data-agent-id". */
  agentIdAttribute?: string;
  /** Inject ARIA landmarks. Default: true. */
  ariaLandmarks?: boolean;
  /** Extra meta tags to inject. */
  metaTags?: Record<string, string>;
}

// ── Agent Auth ───────────────────────────────────────────────────────────

export interface AgentAuthConfig {
  /** OAuth issuer URL. */
  issuer?: string;
  /** Authorization endpoint. */
  authorizationUrl?: string;
  /** Token endpoint. */
  tokenUrl?: string;
  /** Available scopes. */
  scopes?: Record<string, string>;
  /** Realm for WWW-Authenticate header. */
  realm?: string;
}

// ── Top-level composition ────────────────────────────────────────────────

export interface AgentLayerConfig {
  errors?: boolean | Partial<AgentErrorOptions>;
  rateLimit?: false | RateLimitConfig;
  llmsTxt?: false | LlmsTxtConfig;
  discovery?: false | DiscoveryConfig;
  agentMeta?: false | AgentMetaConfig;
  agentAuth?: false | AgentAuthConfig;
}
