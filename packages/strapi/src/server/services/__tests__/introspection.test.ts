import { describe, it, expect } from "vitest";
import {
  filterContentTypes,
  generateRouteMetadata,
  generateOpenAPISpec,
} from "../introspection.js";
import type { StrapiContentType } from "../introspection.js";

const mockContentTypes: Record<string, StrapiContentType> = {
  "api::posting.posting": {
    kind: "collectionType",
    collectionName: "postings",
    info: {
      singularName: "posting",
      pluralName: "postings",
      displayName: "Posting",
      description: "",
    },
    attributes: {
      status: {
        type: "enumeration",
        enum: ["draft", "active", "cancelled"],
        required: true,
        default: "draft",
      },
      workType: { type: "string", required: true },
      time: { type: "datetime" },
      address: { type: "string" },
      totalOpenings: { type: "integer", required: true },
      ratePerHourCAD: { type: "decimal" },
      company: {
        type: "relation",
        relation: "manyToOne",
        target: "api::company.company",
      },
      shifts: {
        type: "relation",
        relation: "oneToMany",
        target: "api::shift.shift",
      },
    },
  },
  "api::shift.shift": {
    kind: "collectionType",
    collectionName: "shifts",
    info: {
      singularName: "shift",
      pluralName: "shifts",
      displayName: "Shift",
      description: "",
    },
    attributes: {
      shiftClockIn: { type: "datetime" },
      shiftClockOut: { type: "datetime" },
      amountEarnedCAD: { type: "decimal" },
      paymentStatus: {
        type: "enumeration",
        enum: ["Awaiting Approval", "Processing", "Paid"],
        required: true,
      },
      user: {
        type: "relation",
        relation: "manyToOne",
        target: "plugin::users-permissions.user",
      },
      posting: {
        type: "relation",
        relation: "manyToOne",
        target: "api::posting.posting",
      },
    },
  },
  "admin::permission": {
    kind: "collectionType",
    info: {
      singularName: "permission",
      pluralName: "permissions",
      displayName: "Permission",
    },
    attributes: { action: { type: "string" } },
  } as StrapiContentType,
  "plugin::users-permissions.user": {
    kind: "collectionType",
    info: {
      singularName: "user",
      pluralName: "users",
      displayName: "User",
    },
    attributes: { email: { type: "email" }, username: { type: "string" } },
  } as StrapiContentType,
};

// ── filterContentTypes ──────────────────────────────────────────────────

describe("filterContentTypes", () => {
  it("should filter out admin:: and plugin:: content types", () => {
    const filtered = filterContentTypes(mockContentTypes);
    const uids = Object.keys(filtered);

    expect(uids).toContain("api::posting.posting");
    expect(uids).toContain("api::shift.shift");
    expect(uids).not.toContain("admin::permission");
    expect(uids).not.toContain("plugin::users-permissions.user");
    expect(uids).toHaveLength(2);
  });

  it("should apply include filter", () => {
    const filtered = filterContentTypes(mockContentTypes, {
      include: ["api::posting.posting"],
    });
    const uids = Object.keys(filtered);

    expect(uids).toEqual(["api::posting.posting"]);
  });

  it("should apply exclude filter", () => {
    const filtered = filterContentTypes(mockContentTypes, {
      exclude: ["api::shift.shift"],
    });
    const uids = Object.keys(filtered);

    expect(uids).toEqual(["api::posting.posting"]);
  });

  it("should return empty for include with no api:: matches", () => {
    const filtered = filterContentTypes(mockContentTypes, {
      include: ["admin::permission"],
    });

    expect(Object.keys(filtered)).toHaveLength(0);
  });

  it("should handle empty content types", () => {
    const filtered = filterContentTypes({});
    expect(Object.keys(filtered)).toHaveLength(0);
  });
});

// ── generateRouteMetadata ───────────────────────────────────────────────

describe("generateRouteMetadata", () => {
  it("should generate 5 routes per collection type", () => {
    const routes = generateRouteMetadata(mockContentTypes);

    // 2 api:: collection types × 5 routes each = 10
    expect(routes).toHaveLength(10);
  });

  it("should generate correct paths for postings", () => {
    const routes = generateRouteMetadata(mockContentTypes, {
      include: ["api::posting.posting"],
    });

    const paths = routes.map((r) => `${r.method} ${r.path}`);
    expect(paths).toEqual([
      "GET /api/postings",
      "GET /api/postings/:id",
      "POST /api/postings",
      "PUT /api/postings/:id",
      "DELETE /api/postings/:id",
    ]);
  });

  it("should include proper summaries", () => {
    const routes = generateRouteMetadata(mockContentTypes, {
      include: ["api::posting.posting"],
    });

    expect(routes[0].summary).toBe("List all Posting entries");
    expect(routes[1].summary).toBe("Get a single Posting by ID");
    expect(routes[2].summary).toBe("Create a new Posting");
    expect(routes[3].summary).toBe("Update a Posting by ID");
    expect(routes[4].summary).toBe("Delete a Posting by ID");
  });

  it("should include query parameters for list endpoint", () => {
    const routes = generateRouteMetadata(mockContentTypes, {
      include: ["api::posting.posting"],
    });

    const listRoute = routes[0];
    expect(listRoute.parameters).toBeDefined();
    const paramNames = listRoute.parameters!.map((p) => p.name);
    expect(paramNames).toContain("sort");
    expect(paramNames).toContain("filters");
    expect(paramNames).toContain("pagination[page]");
    expect(paramNames).toContain("populate");
  });

  it("should respect include/exclude config", () => {
    const routes = generateRouteMetadata(mockContentTypes, {
      exclude: ["api::shift.shift"],
    });

    const allPaths = routes.map((r) => r.path);
    expect(allPaths.some((p) => p.includes("postings"))).toBe(true);
    expect(allPaths.some((p) => p.includes("shifts"))).toBe(false);
  });
});

// ── generateOpenAPISpec ─────────────────────────────────────────────────

describe("generateOpenAPISpec", () => {
  it("should generate valid OpenAPI 3.0 structure", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "CampusThreads API",
      description: "REST API for campus ambassador management",
    });

    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toBe("CampusThreads API");
    expect(spec.info.description).toBe("REST API for campus ambassador management");
    expect(spec.info.version).toBe("1.0.0");
    expect(spec.components.schemas).toBeDefined();
    expect(spec.paths).toBeDefined();
  });

  it("should generate schemas for api:: content types only", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "Test API",
    });

    const schemaNames = Object.keys(spec.components.schemas);
    expect(schemaNames).toContain("Posting");
    expect(schemaNames).toContain("Shift");
    expect(schemaNames).not.toContain("Permission");
    expect(schemaNames).not.toContain("User");
  });

  it("should generate correct paths", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "Test API",
    });

    expect(spec.paths["/api/postings"]).toBeDefined();
    expect(spec.paths["/api/postings/{id}"]).toBeDefined();
    expect(spec.paths["/api/shifts"]).toBeDefined();
    expect(spec.paths["/api/shifts/{id}"]).toBeDefined();
  });

  it("should map string attribute to string type", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "Test API",
      config: { include: ["api::posting.posting"] },
    });

    const schema = spec.components.schemas.Posting as Record<string, unknown>;
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.workType.type).toBe("string");
  });

  it("should map enumeration attribute correctly", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "Test API",
      config: { include: ["api::posting.posting"] },
    });

    const schema = spec.components.schemas.Posting as Record<string, unknown>;
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.status.type).toBe("string");
    expect(props.status.enum).toEqual(["draft", "active", "cancelled"]);
    expect(props.status.default).toBe("draft");
  });

  it("should map datetime attribute to string with date-time format", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "Test API",
      config: { include: ["api::posting.posting"] },
    });

    const schema = spec.components.schemas.Posting as Record<string, unknown>;
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.time.type).toBe("string");
    expect(props.time.format).toBe("date-time");
  });

  it("should map integer attribute to integer type", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "Test API",
      config: { include: ["api::posting.posting"] },
    });

    const schema = spec.components.schemas.Posting as Record<string, unknown>;
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.totalOpenings.type).toBe("integer");
  });

  it("should map decimal attribute to number type", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "Test API",
      config: { include: ["api::posting.posting"] },
    });

    const schema = spec.components.schemas.Posting as Record<string, unknown>;
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.ratePerHourCAD.type).toBe("number");
  });

  it("should map relation attribute to object type", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "Test API",
      config: { include: ["api::posting.posting"] },
    });

    const schema = spec.components.schemas.Posting as Record<string, unknown>;
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.company.type).toBe("object");
  });

  it("should include required fields in schema", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "Test API",
      config: { include: ["api::posting.posting"] },
    });

    const schema = spec.components.schemas.Posting as Record<string, unknown>;
    expect(schema.required).toEqual(
      expect.arrayContaining(["status", "workType", "totalOpenings"]),
    );
  });

  it("should include HTTP methods for collection paths", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "Test API",
      config: { include: ["api::posting.posting"] },
    });

    const listPath = spec.paths["/api/postings"] as Record<string, unknown>;
    expect(listPath.get).toBeDefined();
    expect(listPath.post).toBeDefined();

    const itemPath = spec.paths["/api/postings/{id}"] as Record<string, unknown>;
    expect(itemPath.get).toBeDefined();
    expect(itemPath.put).toBeDefined();
    expect(itemPath.delete).toBeDefined();
  });

  it("should respect include config", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "Test API",
      config: { include: ["api::shift.shift"] },
    });

    expect(Object.keys(spec.components.schemas)).toEqual(["Shift"]);
    expect(spec.paths["/api/shifts"]).toBeDefined();
    expect(spec.paths["/api/postings"]).toBeUndefined();
  });

  it("should map Shift paymentStatus enumeration correctly", () => {
    const spec = generateOpenAPISpec(mockContentTypes, {
      title: "Test API",
      config: { include: ["api::shift.shift"] },
    });

    const schema = spec.components.schemas.Shift as Record<string, unknown>;
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.paymentStatus.type).toBe("string");
    expect(props.paymentStatus.enum).toEqual(["Awaiting Approval", "Processing", "Paid"]);
  });
});
