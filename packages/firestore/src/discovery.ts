import type { RouteMetadata } from "@agent-layer/core";
import type {
  FirestoreCollectionSchema,
  FirestoreFieldDef,
  FirestoreOpenApiConfig,
  FirestoreLlmsTxtConfig,
} from "./types.js";

// ── Helpers ─────────────────────────────────────────────────────────────

function fieldTypeToOpenApi(field: FirestoreFieldDef): Record<string, unknown> {
  switch (field.type) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "timestamp":
      return { type: "string", format: "date-time" };
    case "reference":
      return { type: "string", description: field.refPath ? `Reference to ${field.refPath}` : "Document reference" };
    case "geopoint":
      return {
        type: "object",
        properties: {
          latitude: { type: "number" },
          longitude: { type: "number" },
        },
      };
    case "array":
      return {
        type: "array",
        items: field.items ? fieldTypeToOpenApi(field.items) : { type: "string" },
      };
    case "map":
      if (field.fields) {
        const properties: Record<string, unknown> = {};
        for (const [name, f] of Object.entries(field.fields)) {
          properties[name] = {
            ...fieldTypeToOpenApi(f),
            ...(f.description ? { description: f.description } : {}),
          };
        }
        return { type: "object", properties };
      }
      return { type: "object" };
    default:
      return { type: "string" };
  }
}

function buildSchemaObject(schema: FirestoreCollectionSchema): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    id: { type: "string", description: "Document ID" },
  };
  const required: string[] = [];

  for (const [name, field] of Object.entries(schema.fields)) {
    properties[name] = {
      ...fieldTypeToOpenApi(field),
      ...(field.description ? { description: field.description } : {}),
    };
    if (field.required) {
      required.push(name);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

/**
 * Convert a collection path like "schools/{schoolId}/shifts" to
 * an API path like "/api/firestore/schools/:schoolId/shifts".
 */
function collectionPathToApiPath(collectionPath: string, basePath: string): string {
  const apiPath = collectionPath.replace(/\{(\w+)\}/g, ":$1");
  return `${basePath}/${apiPath}`;
}

/**
 * Generate a safe schema name from a collection path.
 */
function schemaNameFromPath(path: string): string {
  return path
    .replace(/\{(\w+)\}/g, "By$1")
    .split("/")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

// ── OpenAPI Generation ──────────────────────────────────────────────────

function generatePathsForSchema(
  schema: FirestoreCollectionSchema,
  basePath: string,
  parentApiPath = "",
  schemas: Record<string, unknown> = {},
): { paths: Record<string, unknown>; schemas: Record<string, unknown> } {
  const paths: Record<string, unknown> = {};
  const collectionApiPath = parentApiPath
    ? `${parentApiPath}/${schema.path.replace(/\{(\w+)\}/g, ":$1")}`
    : collectionPathToApiPath(schema.path, basePath);

  const schemaName = schemaNameFromPath(
    parentApiPath
      ? `${parentApiPath.replace(basePath + "/", "")}/${schema.path}`
      : schema.path,
  );
  const schemaRef = `#/components/schemas/${schemaName}`;

  // Add schema to components
  schemas[schemaName] = buildSchemaObject(schema);

  // GET (list) + POST
  paths[collectionApiPath] = {
    get: {
      summary: `List ${schema.displayName}`,
      description: schema.description || `List all documents in ${schema.displayName}`,
      operationId: `list${schemaName}`,
      parameters: [
        { name: "limit", in: "query", schema: { type: "integer" }, description: "Maximum number of results" },
        { name: "offset", in: "query", schema: { type: "integer" }, description: "Number of results to skip" },
        { name: "sort", in: "query", schema: { type: "string" }, description: "Sort field and direction (e.g. createdAt:desc)" },
        { name: "fields", in: "query", schema: { type: "string" }, description: "Comma-separated list of fields to return" },
      ],
      responses: {
        "200": {
          description: `List of ${schema.displayName}`,
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: schemaRef } },
            },
          },
        },
      },
    },
    post: {
      summary: `Create ${schema.displayName.replace(/s$/, "")}`,
      operationId: `create${schemaName.replace(/s$/, "")}`,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: schemaRef },
          },
        },
      },
      responses: {
        "201": {
          description: "Document created",
          content: {
            "application/json": {
              schema: { $ref: schemaRef },
            },
          },
        },
      },
    },
  };

  // GET /:id, PUT /:id, DELETE /:id
  const itemPath = `${collectionApiPath}/:id`;
  paths[itemPath] = {
    get: {
      summary: `Get ${schema.displayName.replace(/s$/, "")} by ID`,
      operationId: `get${schemaName.replace(/s$/, "")}`,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Document ID" },
      ],
      responses: {
        "200": {
          description: `${schema.displayName.replace(/s$/, "")} document`,
          content: {
            "application/json": {
              schema: { $ref: schemaRef },
            },
          },
        },
        "404": { description: "Document not found" },
      },
    },
    put: {
      summary: `Update ${schema.displayName.replace(/s$/, "")}`,
      operationId: `update${schemaName.replace(/s$/, "")}`,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Document ID" },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: schemaRef },
          },
        },
      },
      responses: {
        "200": {
          description: "Document updated",
          content: {
            "application/json": {
              schema: { $ref: schemaRef },
            },
          },
        },
        "404": { description: "Document not found" },
      },
    },
    delete: {
      summary: `Delete ${schema.displayName.replace(/s$/, "")}`,
      operationId: `delete${schemaName.replace(/s$/, "")}`,
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Document ID" },
      ],
      responses: {
        "204": { description: "Document deleted" },
        "404": { description: "Document not found" },
      },
    },
  };

  // Subcollections
  if (schema.subcollections) {
    for (const sub of schema.subcollections) {
      const subResult = generatePathsForSchema(sub, basePath, `${itemPath}`, schemas);
      Object.assign(paths, subResult.paths);
      Object.assign(schemas, subResult.schemas);
    }
  }

  return { paths, schemas };
}

/**
 * Generate an OpenAPI 3.0 spec from Firestore collection schemas.
 */
export function generateFirestoreOpenApi(
  collectionSchemas: FirestoreCollectionSchema[],
  config: FirestoreOpenApiConfig,
): Record<string, unknown> {
  const basePath = config.basePath || "/api/firestore";
  let allPaths: Record<string, unknown> = {};
  let allSchemas: Record<string, unknown> = {};

  for (const schema of collectionSchemas) {
    const result = generatePathsForSchema(schema, basePath, "", allSchemas);
    Object.assign(allPaths, result.paths);
    Object.assign(allSchemas, result.schemas);
  }

  const spec: Record<string, unknown> = {
    openapi: "3.0.3",
    info: {
      title: config.title,
      version: config.version || "1.0.0",
      ...(config.description ? { description: config.description } : {}),
    },
    paths: allPaths,
    components: {
      schemas: allSchemas,
    },
  };

  if (config.servers) {
    spec.servers = config.servers;
  }

  return spec;
}

// ── Route Metadata Generation ───────────────────────────────────────────

function generateRouteMetadataForSchema(
  schema: FirestoreCollectionSchema,
  basePath: string,
  parentApiPath = "",
): RouteMetadata[] {
  const routes: RouteMetadata[] = [];
  const collectionApiPath = parentApiPath
    ? `${parentApiPath}/${schema.path.replace(/\{(\w+)\}/g, ":$1")}`
    : collectionPathToApiPath(schema.path, basePath);

  routes.push({
    method: "GET",
    path: collectionApiPath,
    summary: `List ${schema.displayName}`,
    description: schema.description,
    parameters: [
      { name: "limit", in: "query", description: "Maximum number of results" },
      { name: "offset", in: "query", description: "Number of results to skip" },
      { name: "sort", in: "query", description: "Sort field:direction (e.g. createdAt:desc)" },
      { name: "fields", in: "query", description: "Comma-separated fields to return" },
    ],
  });

  const itemPath = `${collectionApiPath}/:id`;

  routes.push({
    method: "GET",
    path: itemPath,
    summary: `Get ${schema.displayName.replace(/s$/, "")} by ID`,
    parameters: [
      { name: "id", in: "path", required: true, description: "Document ID" },
    ],
  });

  routes.push({
    method: "POST",
    path: collectionApiPath,
    summary: `Create ${schema.displayName.replace(/s$/, "")}`,
  });

  routes.push({
    method: "PUT",
    path: itemPath,
    summary: `Update ${schema.displayName.replace(/s$/, "")}`,
    parameters: [
      { name: "id", in: "path", required: true, description: "Document ID" },
    ],
  });

  routes.push({
    method: "DELETE",
    path: itemPath,
    summary: `Delete ${schema.displayName.replace(/s$/, "")}`,
    parameters: [
      { name: "id", in: "path", required: true, description: "Document ID" },
    ],
  });

  // Subcollections
  if (schema.subcollections) {
    for (const sub of schema.subcollections) {
      routes.push(...generateRouteMetadataForSchema(sub, basePath, itemPath));
    }
  }

  return routes;
}

/**
 * Generate RouteMetadata[] from Firestore collection schemas.
 */
export function generateFirestoreRouteMetadata(
  schemas: FirestoreCollectionSchema[],
  basePath = "/api/firestore",
): RouteMetadata[] {
  const routes: RouteMetadata[] = [];
  for (const schema of schemas) {
    routes.push(...generateRouteMetadataForSchema(schema, basePath));
  }
  return routes;
}

// ── LLMs.txt Generation ─────────────────────────────────────────────────

/**
 * Generate llms.txt content for Firestore collections.
 */
export function generateFirestoreLlmsTxt(
  schemas: FirestoreCollectionSchema[],
  config: FirestoreLlmsTxtConfig,
): string {
  const basePath = config.basePath || "/api/firestore";
  const lines: string[] = [];

  lines.push(`# ${config.title}`);

  if (config.description) {
    lines.push("");
    lines.push(`> ${config.description}`);
  }

  lines.push("");
  lines.push("## Collections");

  for (const schema of schemas) {
    appendCollectionToLlmsTxt(schema, basePath, lines, "");
  }

  return lines.join("\n") + "\n";
}

function appendCollectionToLlmsTxt(
  schema: FirestoreCollectionSchema,
  basePath: string,
  lines: string[],
  parentApiPath: string,
): void {
  const collectionApiPath = parentApiPath
    ? `${parentApiPath}/${schema.path.replace(/\{(\w+)\}/g, ":$1")}`
    : collectionPathToApiPath(schema.path, basePath);

  lines.push("");
  lines.push(`### ${schema.displayName}`);

  if (schema.description) {
    lines.push("");
    lines.push(schema.description);
  }

  lines.push("");
  lines.push(`- \`GET ${collectionApiPath}\` — List all`);
  lines.push(`- \`GET ${collectionApiPath}/:id\` — Get by ID`);
  lines.push(`- \`POST ${collectionApiPath}\` — Create`);
  lines.push(`- \`PUT ${collectionApiPath}/:id\` — Update`);
  lines.push(`- \`DELETE ${collectionApiPath}/:id\` — Delete`);

  lines.push("");
  lines.push("**Fields:**");
  for (const [name, field] of Object.entries(schema.fields)) {
    const req = field.required ? " (required)" : "";
    const desc = field.description ? ` — ${field.description}` : "";
    lines.push(`- \`${name}\` (${field.type})${req}${desc}`);
  }

  if (schema.subcollections) {
    const itemPath = `${collectionApiPath}/:id`;
    for (const sub of schema.subcollections) {
      appendCollectionToLlmsTxt(sub, basePath, lines, itemPath);
    }
  }
}
