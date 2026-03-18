// ── Firestore Schema Declaration ────────────────────────────────────────

export type FirestoreFieldType =
  | "string"
  | "number"
  | "boolean"
  | "timestamp"
  | "reference"
  | "array"
  | "map"
  | "geopoint";

export interface FirestoreFieldDef {
  type: FirestoreFieldType;
  description?: string;
  required?: boolean;
  /** For references: the target collection path */
  refPath?: string;
  /** For arrays: the item type */
  items?: FirestoreFieldDef;
  /** For maps: the nested fields */
  fields?: Record<string, FirestoreFieldDef>;
}

export interface FirestoreCollectionSchema {
  /** Firestore collection path (e.g. "threads", "schools/{schoolId}/shifts") */
  path: string;
  /** Human-readable name */
  displayName: string;
  /** Description for agents */
  description?: string;
  /** Field definitions */
  fields: Record<string, FirestoreFieldDef>;
  /** Subcollections */
  subcollections?: FirestoreCollectionSchema[];
  /** Required scope to access this collection */
  scope?: string;
  /** Company-scoping field name — enforced on all queries */
  companyScopeField?: string;
}

// ── Query Parameters ────────────────────────────────────────────────────

export type FirestoreFilterOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "contains";

export interface FirestoreFilter {
  op: FirestoreFilterOp;
  value: unknown;
}

export interface FirestoreSort {
  field: string;
  order: "asc" | "desc";
}

export interface FirestoreQueryParams {
  /** Firestore filters: field[op]=value */
  filters?: Record<string, FirestoreFilter>;
  /** Sort: field:asc or field:desc */
  sort?: FirestoreSort[];
  /** Pagination */
  limit?: number;
  offset?: number;
  /** Select specific fields */
  fields?: string[];
}

// ── Generic Firestore Interfaces (for testing without firebase-admin) ───

export interface FirestoreQueryLike {
  where(field: string, op: string, value: unknown): FirestoreQueryLike;
  orderBy(field: string, direction: "asc" | "desc"): FirestoreQueryLike;
  limit(n: number): FirestoreQueryLike;
  offset(n: number): FirestoreQueryLike;
  select(...fields: string[]): FirestoreQueryLike;
}

export interface FirestoreCollectionRefLike extends FirestoreQueryLike {
  doc(id: string): unknown;
}

// ── Config ──────────────────────────────────────────────────────────────

export interface FirestoreOpenApiConfig {
  title: string;
  version?: string;
  description?: string;
  basePath?: string;
  servers?: { url: string; description?: string }[];
}

export interface FirestoreLlmsTxtConfig {
  title: string;
  description?: string;
  basePath?: string;
}
