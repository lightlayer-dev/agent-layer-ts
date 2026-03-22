export {
  formatToolName,
  buildInputSchema,
  generateToolDefinitions,
  generateServerInfo,
  parseToolName,
  handleJsonRpc,
} from "./mcp.js";
export type {
  McpToolDefinition,
  McpServerInfo,
  McpServerConfig,
  JsonRpcRequest,
  JsonRpcResponse,
  ToolCallHandler,
} from "./mcp.js";
export { generateAgentCard, validateAgentCard } from "./a2a.js";
export type {
  A2AAgentCard,
  A2ASkill,
  A2AAuthScheme,
  A2AProvider,
  A2ACapabilities,
  A2AContentType,
  A2AConfig,
} from "./a2a.js";
export {
  parseSpiffeId,
  isSpiffeTrusted,
  decodeJwtClaims,
  extractClaims,
  validateClaims,
  evaluateAuthz,
  buildAuditEvent,
} from "./agent-identity.js";
export type {
  SpiffeId,
  AgentIdentityClaims,
  AgentAuthzPolicy,
  AuthzContext,
  AuthzResult,
  AgentIdentityConfig,
  TokenValidationError,
  AgentIdentityAuditEvent,
} from "./agent-identity.js";
export { formatError, AgentError, notFoundError, rateLimitError } from "./errors.js";
export { MemoryStore, createRateLimiter } from "./rate-limit.js";
export { generateLlmsTxt, generateLlmsFullTxt } from "./llms-txt.js";
export { generateAIManifest, generateJsonLd } from "./discovery.js";
export { detectAgent, createAnalytics, EventBuffer } from "./analytics.js";
export type { AgentEvent, AnalyticsConfig, AnalyticsInstance } from "./analytics.js";
export {
  MemoryApiKeyStore,
  createApiKey,
  validateApiKey,
  hasScope,
} from "./api-keys.js";
export type {
  AgentErrorEnvelope,
  AgentErrorOptions,
  RateLimitStore,
  RateLimitConfig,
  RateLimitResult,
  LlmsTxtSection,
  LlmsTxtConfig,
  RouteMetadata,
  RouteParameter,
  AIManifest,
  AIManifestAuth,
  DiscoveryConfig,
  AgentMetaConfig,
  AgentAuthConfig,
  ApiKeyConfig,
  ScopedApiKey,
  ApiKeyStore,
  ApiKeyValidationResult,
  CreateApiKeyOptions,
  CreateApiKeyResult,
  AgentLayerConfig,
} from "./types.js";
export {
  generateUnifiedAIManifest,
  generateUnifiedAgentCard,
  generateUnifiedLlmsTxt,
  generateUnifiedLlmsFullTxt,
  generateAgentsTxt,
  generateAllDiscovery,
  isFormatEnabled,
} from "./unified-discovery.js";
export type {
  AgentsTxtRule,
  AgentsTxtBlock,
  UnifiedAgentsTxtConfig,
  DiscoveryFormats,
  UnifiedAuthConfig,
  UnifiedSkill,
  UnifiedDiscoveryConfig,
} from "./unified-discovery.js";
// Backwards compat: re-export UnifiedAgentsTxtConfig as AgentsTxtConfig for existing consumers
export type { UnifiedAgentsTxtConfig as AgentsTxtConfig } from "./unified-discovery.js";
export {
  generateAgentsTxt as generateStandaloneAgentsTxt,
  parseAgentsTxt,
  isAgentAllowed,
} from "./agents-txt.js";
export type {
  AgentsTxtConfig as StandaloneAgentsTxtConfig,
  AgentsTxtRule as StandaloneAgentsTxtRule,
  AgentsTxtRateLimit,
} from "./agents-txt.js";
export {
  HttpFacilitatorClient,
  resolvePrice,
  buildRequirements,
  buildPaymentRequired,
  encodePaymentRequired,
  decodePaymentPayload,
  matchRoute,
  X402_VERSION,
  HEADER_PAYMENT_REQUIRED,
  HEADER_PAYMENT_SIGNATURE,
  HEADER_PAYMENT_RESPONSE,
} from "./x402.js";
export type {
  Network,
  Price,
  X402Config,
  X402RouteConfig,
  PaymentRequirements,
  PaymentRequired,
  PaymentPayload,
  ResourceInfo,
  VerifyResponse,
  SettleResponse,
  FacilitatorClient,
} from "./x402.js";

// ── Core handler functions (framework-agnostic) ─────────────────────────
export {
  prefersJson,
  renderHtmlError,
  buildErrorEnvelope,
  buildErrorResponse,
  buildNotFoundResponse,
} from "./error-handler.js";
export type { ErrorResponseAction } from "./error-handler.js";

export {
  buildOauthDiscoveryDocument,
  buildWwwAuthenticate,
  checkRequireAuth,
} from "./auth-handler.js";
export type { RequireAuthResult } from "./auth-handler.js";

export {
  extractAndVerifyToken,
  handleRequireIdentity,
  handleOptionalIdentity,
} from "./identity-handler.js";
export type { IdentityError, IdentitySuccess } from "./identity-handler.js";

export { handleX402 } from "./x402-handler.js";
export type {
  X402Skip,
  X402PaymentRequired,
  X402Success,
  X402Error,
  X402FlowResult,
} from "./x402-handler.js";

// ── Shared middleware config ────────────────────────────────────────────
export type { AgentsTxtMiddlewareConfig } from "./agents-txt-middleware.js";

// ── AG-UI (Agent-User Interaction) Protocol ─────────────────────────────
export {
  encodeEvent,
  encodeEvents,
  createAgUiEmitter,
  AG_UI_HEADERS,
} from "./ag-ui.js";
export type {
  AgUiEventType,
  AgUiRole,
  AgUiEvent,
  AgUiEmitter,
  AgUiEmitterOptions,
  BaseEvent,
  RunStartedEvent,
  RunFinishedEvent,
  RunErrorEvent,
  StepStartedEvent,
  StepFinishedEvent,
  TextMessageStartEvent,
  TextMessageContentEvent,
  TextMessageEndEvent,
  ToolCallStartEvent,
  ToolCallArgsEvent,
  ToolCallEndEvent,
  ToolCallResultEvent,
  StateSnapshotEvent,
  StateDeltaEvent,
  CustomEvent,
} from "./ag-ui.js";

// ── Test utilities ──────────────────────────────────────────────────────
export {
  makeJwt,
  validJwtPayload,
  baseIdentityConfig,
  testRoutes,
  testMcpConfig,
  makeCustomVerifier,
} from "./test-utils.js";
