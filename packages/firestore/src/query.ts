import type {
  FirestoreCollectionSchema,
  FirestoreFilterOp,
  FirestoreQueryParams,
  FirestoreQueryLike,
} from "./types.js";

// ── Filter op mapping ───────────────────────────────────────────────────

const FILTER_OP_MAP: Record<FirestoreFilterOp, string> = {
  eq: "==",
  neq: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  in: "in",
  contains: "array-contains",
};

// ── Query Parameter Parsing ─────────────────────────────────────────────

/**
 * Parse REST-style query parameters into structured FirestoreQueryParams.
 *
 * Supports:
 * - `field[op]=value` for filters (e.g. `status[eq]=active`, `time[gte]=2024-01-01`)
 * - `sort=field:asc` or `sort=field:desc` (comma-separated for multiple)
 * - `limit=10`, `offset=5`
 * - `fields=name,status,createdAt`
 */
export function parseQueryParams(query: Record<string, string>): FirestoreQueryParams {
  const params: FirestoreQueryParams = {};

  for (const [key, value] of Object.entries(query)) {
    // Filter pattern: field[op]=value
    const filterMatch = key.match(/^(.+)\[(\w+)\]$/);
    if (filterMatch) {
      const [, field, op] = filterMatch;
      if (isValidFilterOp(op)) {
        if (!params.filters) params.filters = {};
        params.filters[field] = {
          op,
          value: parseFilterValue(value, op),
        };
      }
      continue;
    }

    switch (key) {
      case "sort": {
        params.sort = value.split(",").map((s) => {
          const [field, dir] = s.trim().split(":");
          return {
            field,
            order: (dir === "desc" ? "desc" : "asc") as "asc" | "desc",
          };
        });
        break;
      }
      case "limit": {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n > 0) params.limit = n;
        break;
      }
      case "offset": {
        const n = parseInt(value, 10);
        if (!isNaN(n) && n >= 0) params.offset = n;
        break;
      }
      case "fields": {
        params.fields = value.split(",").map((f) => f.trim()).filter(Boolean);
        break;
      }
    }
  }

  return params;
}

function isValidFilterOp(op: string): op is FirestoreFilterOp {
  return op in FILTER_OP_MAP;
}

function parseFilterValue(value: string, op: FirestoreFilterOp): unknown {
  // "in" operator expects comma-separated list
  if (op === "in") {
    return value.split(",").map((v) => coerceValue(v.trim()));
  }
  return coerceValue(value);
}

function coerceValue(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;

  const num = Number(value);
  if (!isNaN(num) && value.trim() !== "") return num;

  return value;
}

// ── Query Building ──────────────────────────────────────────────────────

export interface CompanyScopeContext {
  companyId: string;
}

/**
 * Build a Firestore query from parsed parameters.
 *
 * SECURITY: If the schema declares `companyScopeField`, a where clause
 * is automatically added filtering by the user's companyId.
 */
export function buildFirestoreQuery(
  collection: FirestoreQueryLike,
  params: FirestoreQueryParams,
  schema: FirestoreCollectionSchema,
  scopeCtx?: CompanyScopeContext,
): FirestoreQueryLike {
  let query = collection;

  // SECURITY: Enforce company scope if declared
  if (schema.companyScopeField) {
    if (!scopeCtx?.companyId) {
      throw new Error(
        `Collection "${schema.path}" requires company scope but no companyId was provided`,
      );
    }
    query = query.where(schema.companyScopeField, "==", scopeCtx.companyId);
  }

  // Apply filters
  if (params.filters) {
    for (const [field, filter] of Object.entries(params.filters)) {
      const firestoreOp = FILTER_OP_MAP[filter.op];
      if (firestoreOp) {
        query = query.where(field, firestoreOp, filter.value);
      }
    }
  }

  // Apply sort
  if (params.sort) {
    for (const s of params.sort) {
      query = query.orderBy(s.field, s.order);
    }
  }

  // Apply field selection
  if (params.fields && params.fields.length > 0) {
    query = query.select(...params.fields);
  }

  // Apply pagination
  if (params.offset !== undefined && params.offset > 0) {
    query = query.offset(params.offset);
  }

  if (params.limit !== undefined && params.limit > 0) {
    query = query.limit(params.limit);
  }

  return query;
}
