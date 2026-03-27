import type { RouteMetadata, RouteParameter } from "@agent-layer/core";

// ── Types ───────────────────────────────────────────────────────────────

export interface StrapiAttribute {
  type: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
  relation?: string;
  target?: string;
  [key: string]: unknown;
}

export interface StrapiContentType {
  kind: "collectionType" | "singleType";
  collectionName?: string;
  info: {
    singularName: string;
    pluralName: string;
    displayName: string;
    description?: string;
  };
  attributes: Record<string, StrapiAttribute>;
}

export interface IntrospectionConfig {
  include?: string[];
  exclude?: string[];
}

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description?: string;
    version: string;
  };
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, unknown>;
  };
}

// ── Attribute Type Mapping ──────────────────────────────────────────────

interface OpenAPIType {
  type: string;
  format?: string;
  enum?: string[];
  items?: Record<string, unknown>;
}

function mapAttributeToOpenAPI(attr: StrapiAttribute): OpenAPIType {
  switch (attr.type) {
    case "string":
    case "text":
    case "richtext":
    case "email":
    case "password":
    case "uid":
      return { type: "string" };
    case "integer":
      return { type: "integer" };
    case "biginteger":
      return { type: "integer", format: "int64" };
    case "decimal":
    case "float":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "date":
      return { type: "string", format: "date" };
    case "datetime":
      return { type: "string", format: "date-time" };
    case "time":
      return { type: "string", format: "time" };
    case "json":
      return { type: "object" };
    case "enumeration":
      return { type: "string", ...(attr.enum ? { enum: attr.enum } : {}) };
    case "relation":
      return { type: "object" };
    case "media":
      return { type: "object" };
    case "component":
      return { type: "object" };
    case "dynamiczone":
      return { type: "array", items: { type: "object" } };
    default:
      return { type: "string" };
  }
}

// ── Filtering ───────────────────────────────────────────────────────────

/**
 * Filter content types to only `api::` prefixed types,
 * then apply include/exclude lists.
 */
export function filterContentTypes(
  contentTypes: Record<string, StrapiContentType>,
  config?: IntrospectionConfig,
): Record<string, StrapiContentType> {
  const result: Record<string, StrapiContentType> = {};

  for (const [uid, ct] of Object.entries(contentTypes)) {
    // Only include api:: content types
    if (!uid.startsWith("api::")) continue;

    // If include list is set, only include those
    if (config?.include && config.include.length > 0) {
      if (!config.include.includes(uid)) continue;
    }

    // If exclude list is set, skip those
    if (config?.exclude && config.exclude.length > 0) {
      if (config.exclude.includes(uid)) continue;
    }

    result[uid] = ct;
  }

  return result;
}

// ── Schema Generation ───────────────────────────────────────────────────

function generateSchemaForContentType(
  ct: StrapiContentType,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [name, attr] of Object.entries(ct.attributes)) {
    const openApiType = mapAttributeToOpenAPI(attr);
    const prop: Record<string, unknown> = { ...openApiType };

    if (attr.default !== undefined) {
      prop.default = attr.default;
    }

    properties[name] = prop;

    if (attr.required) {
      required.push(name);
    }
  }

  const schema: Record<string, unknown> = {
    type: "object",
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

// ── Route Metadata Generation ───────────────────────────────────────────

/**
 * Generate RouteMetadata[] for llms.txt from content types.
 */
export function generateRouteMetadata(
  contentTypes: Record<string, StrapiContentType>,
  config?: IntrospectionConfig,
): RouteMetadata[] {
  const filtered = filterContentTypes(contentTypes, config);
  const routes: RouteMetadata[] = [];

  for (const [, ct] of Object.entries(filtered)) {
    if (ct.kind !== "collectionType") continue;

    const plural = ct.info.pluralName;
    const display = ct.info.displayName;
    const basePath = `/api/${plural}`;

    routes.push({
      method: "GET",
      path: basePath,
      summary: `List all ${display} entries`,
      parameters: [
        { name: "sort", in: "query", description: "Sort by field" },
        { name: "filters", in: "query", description: "Filter criteria" },
        {
          name: "pagination[page]",
          in: "query",
          description: "Page number",
        },
        {
          name: "pagination[pageSize]",
          in: "query",
          description: "Page size",
        },
        { name: "populate", in: "query", description: "Relations to populate" },
      ],
    });

    routes.push({
      method: "GET",
      path: `${basePath}/:id`,
      summary: `Get a single ${display} by ID`,
      parameters: [
        { name: "id", in: "path", required: true, description: `${display} ID` },
        { name: "populate", in: "query", description: "Relations to populate" },
      ],
    });

    routes.push({
      method: "POST",
      path: basePath,
      summary: `Create a new ${display}`,
      parameters: [
        { name: "data", in: "body", required: true, description: `${display} data` },
      ],
    });

    routes.push({
      method: "PUT",
      path: `${basePath}/:id`,
      summary: `Update a ${display} by ID`,
      parameters: [
        { name: "id", in: "path", required: true, description: `${display} ID` },
        { name: "data", in: "body", required: true, description: `Updated ${display} data` },
      ],
    });

    routes.push({
      method: "DELETE",
      path: `${basePath}/:id`,
      summary: `Delete a ${display} by ID`,
      parameters: [
        { name: "id", in: "path", required: true, description: `${display} ID` },
      ],
    });
  }

  return routes;
}

// ── OpenAPI Spec Generation ─────────────────────────────────────────────

/**
 * Generate a full OpenAPI 3.0 spec from Strapi content types.
 */
export function generateOpenAPISpec(
  contentTypes: Record<string, StrapiContentType>,
  options: {
    title: string;
    description?: string;
    version?: string;
    config?: IntrospectionConfig;
  },
): OpenAPISpec {
  const filtered = filterContentTypes(contentTypes, options.config);
  const paths: Record<string, Record<string, unknown>> = {};
  const schemas: Record<string, unknown> = {};

  for (const [uid, ct] of Object.entries(filtered)) {
    if (ct.kind !== "collectionType") continue;

    const plural = ct.info.pluralName;
    const display = ct.info.displayName;
    const schemaName = ct.info.singularName.charAt(0).toUpperCase() + ct.info.singularName.slice(1);
    const basePath = `/api/${plural}`;

    // Generate schema
    schemas[schemaName] = generateSchemaForContentType(ct);

    // List
    paths[basePath] = {
      get: {
        summary: `List all ${display} entries`,
        operationId: `find${schemaName}s`,
        tags: [display],
        parameters: [
          { name: "sort", in: "query", schema: { type: "string" } },
          { name: "filters", in: "query", schema: { type: "object" } },
          { name: "pagination[page]", in: "query", schema: { type: "integer" } },
          { name: "pagination[pageSize]", in: "query", schema: { type: "integer" } },
          { name: "populate", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: `List of ${display}`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: `#/components/schemas/${schemaName}` },
                    },
                    meta: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: `Create a new ${display}`,
        operationId: `create${schemaName}`,
        tags: [display],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: `#/components/schemas/${schemaName}` },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: `Created ${display}`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: `#/components/schemas/${schemaName}` },
                    meta: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
    };

    // Single item
    paths[`${basePath}/{id}`] = {
      get: {
        summary: `Get a single ${display} by ID`,
        operationId: `findOne${schemaName}`,
        tags: [display],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          { name: "populate", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: `Single ${display}`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: `#/components/schemas/${schemaName}` },
                    meta: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        summary: `Update a ${display} by ID`,
        operationId: `update${schemaName}`,
        tags: [display],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { $ref: `#/components/schemas/${schemaName}` },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: `Updated ${display}`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: `#/components/schemas/${schemaName}` },
                    meta: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
      delete: {
        summary: `Delete a ${display} by ID`,
        operationId: `delete${schemaName}`,
        tags: [display],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: {
          "200": {
            description: `Deleted ${display}`,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { $ref: `#/components/schemas/${schemaName}` },
                    meta: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  return {
    openapi: "3.0.0",
    info: {
      title: options.title,
      ...(options.description ? { description: options.description } : {}),
      version: options.version ?? "1.0.0",
    },
    paths,
    components: {
      schemas,
    },
  };
}
