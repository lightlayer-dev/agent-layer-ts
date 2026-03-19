// ── Types ───────────────────────────────────────────────────────────────

export interface ScopedApiKey {
  keyId: string;
  companyId: string;
  userId: string;
  scopes: string[];
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ApiKeyStore {
  /** Resolve a raw API key string to a ScopedApiKey, or null if not found. */
  resolve(rawKey: string): Promise<ScopedApiKey | null>;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  key?: ScopedApiKey;
  error?: string;
}

export interface CreateApiKeyOptions {
  companyId: string;
  userId: string;
  scopes: string[];
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateApiKeyResult {
  rawKey: string;
  key: ScopedApiKey;
}

// ── MemoryApiKeyStore ───────────────────────────────────────────────────

/**
 * In-memory API key store for development and testing.
 */
export class MemoryApiKeyStore implements ApiKeyStore {
  private keys = new Map<string, ScopedApiKey>();

  async resolve(rawKey: string): Promise<ScopedApiKey | null> {
    return this.keys.get(rawKey) ?? null;
  }

  /** Store a key mapping. Used internally by createApiKey. */
  set(rawKey: string, key: ScopedApiKey): void {
    this.keys.set(rawKey, key);
  }

  /** Remove a key mapping. */
  delete(rawKey: string): void {
    this.keys.delete(rawKey);
  }

  /** Number of stored keys. */
  get size(): number {
    return this.keys.size;
  }
}

// ── Key generation ──────────────────────────────────────────────────────

/** Convert a Uint8Array to a hex string. */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generate cryptographically random hex string of the given byte length. */
function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  // globalThis.crypto is available in Node 18+ and all modern browsers
  (globalThis as any).crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/**
 * Generate a new scoped API key and store it.
 * Key format: `al_` prefix + 32 random hex characters.
 */
export function createApiKey(
  store: MemoryApiKeyStore,
  opts: CreateApiKeyOptions,
): CreateApiKeyResult {
  const rawKey = `al_${randomHex(16)}`;
  const keyId = randomHex(8);

  const key: ScopedApiKey = {
    keyId,
    companyId: opts.companyId,
    userId: opts.userId,
    scopes: opts.scopes,
    ...(opts.expiresAt != null && { expiresAt: opts.expiresAt }),
    ...(opts.metadata != null && { metadata: opts.metadata }),
  };

  store.set(rawKey, key);

  return { rawKey, key };
}

// ── Validation ──────────────────────────────────────────────────────────

/**
 * Validate a raw API key string against a store.
 * Checks existence and expiry.
 */
export async function validateApiKey(
  store: ApiKeyStore,
  rawKey: string,
): Promise<ApiKeyValidationResult> {
  const key = await store.resolve(rawKey);

  if (!key) {
    return { valid: false, error: "invalid_api_key" };
  }

  if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
    return { valid: false, error: "api_key_expired" };
  }

  return { valid: true, key };
}

// ── Scope checking ──────────────────────────────────────────────────────

/**
 * Check if a scoped API key has the required scope(s).
 * Supports wildcard `*` which grants all scopes.
 */
export function hasScope(
  key: ScopedApiKey,
  required: string | string[],
): boolean {
  if (key.scopes.includes("*")) {
    return true;
  }

  const requiredScopes = Array.isArray(required) ? required : [required];
  return requiredScopes.every((scope) => key.scopes.includes(scope));
}
