// Schema
export { validateSchema, validateSchemas } from "./schema.js";
export type { SchemaValidationError } from "./schema.js";

// Discovery
export {
  generateFirestoreOpenApi,
  generateFirestoreRouteMetadata,
  generateFirestoreLlmsTxt,
} from "./discovery.js";

// Query
export { parseQueryParams, buildFirestoreQuery } from "./query.js";
export type { CompanyScopeContext } from "./query.js";

// Koa middleware
export { firestoreRoutes } from "./koa.js";
export type { KoaFirestoreConfig } from "./koa.js";

// Express middleware
export { firestoreRouter } from "./express.js";
export type { ExpressFirestoreConfig } from "./express.js";

// Types
export type {
  FirestoreFieldType,
  FirestoreFieldDef,
  FirestoreCollectionSchema,
  FirestoreFilterOp,
  FirestoreFilter,
  FirestoreSort,
  FirestoreQueryParams,
  FirestoreQueryLike,
  FirestoreCollectionRefLike,
  FirestoreOpenApiConfig,
  FirestoreLlmsTxtConfig,
} from "./types.js";
