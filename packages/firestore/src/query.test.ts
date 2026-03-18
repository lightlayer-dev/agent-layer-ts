import { describe, it, expect, vi } from "vitest";
import { parseQueryParams, buildFirestoreQuery } from "./query.js";
import type { FirestoreQueryLike } from "./types.js";
import { testSchemas } from "./fixtures.js";

// ── Mock Firestore Query ────────────────────────────────────────────────

function createMockQuery(): FirestoreQueryLike & { calls: { method: string; args: unknown[] }[] } {
  const calls: { method: string; args: unknown[] }[] = [];

  const mock: any = {
    calls,
    where(field: string, op: string, value: unknown) {
      calls.push({ method: "where", args: [field, op, value] });
      return mock;
    },
    orderBy(field: string, direction: "asc" | "desc") {
      calls.push({ method: "orderBy", args: [field, direction] });
      return mock;
    },
    limit(n: number) {
      calls.push({ method: "limit", args: [n] });
      return mock;
    },
    offset(n: number) {
      calls.push({ method: "offset", args: [n] });
      return mock;
    },
    select(...fields: string[]) {
      calls.push({ method: "select", args: fields });
      return mock;
    },
  };

  return mock;
}

// ── parseQueryParams ────────────────────────────────────────────────────

describe("parseQueryParams", () => {
  it("should parse basic filter", () => {
    const result = parseQueryParams({ "status[eq]": "active" });
    expect(result.filters).toEqual({
      status: { op: "eq", value: "active" },
    });
  });

  it("should parse multiple filters", () => {
    const result = parseQueryParams({
      "status[eq]": "active",
      "count[gte]": "10",
    });
    expect(result.filters?.status).toEqual({ op: "eq", value: "active" });
    expect(result.filters?.count).toEqual({ op: "gte", value: 10 });
  });

  it("should parse 'in' filter as array", () => {
    const result = parseQueryParams({ "status[in]": "active,pending,closed" });
    expect(result.filters?.status).toEqual({
      op: "in",
      value: ["active", "pending", "closed"],
    });
  });

  it("should coerce boolean values", () => {
    const result = parseQueryParams({ "resolved[eq]": "true" });
    expect(result.filters?.resolved).toEqual({ op: "eq", value: true });
  });

  it("should coerce numeric values", () => {
    const result = parseQueryParams({ "count[gt]": "5" });
    expect(result.filters?.count).toEqual({ op: "gt", value: 5 });
  });

  it("should coerce null values", () => {
    const result = parseQueryParams({ "field[eq]": "null" });
    expect(result.filters?.field).toEqual({ op: "eq", value: null });
  });

  it("should parse sort", () => {
    const result = parseQueryParams({ sort: "createdAt:desc" });
    expect(result.sort).toEqual([{ field: "createdAt", order: "desc" }]);
  });

  it("should parse multiple sorts", () => {
    const result = parseQueryParams({ sort: "name:asc,createdAt:desc" });
    expect(result.sort).toEqual([
      { field: "name", order: "asc" },
      { field: "createdAt", order: "desc" },
    ]);
  });

  it("should default sort direction to asc", () => {
    const result = parseQueryParams({ sort: "name" });
    expect(result.sort).toEqual([{ field: "name", order: "asc" }]);
  });

  it("should parse limit and offset", () => {
    const result = parseQueryParams({ limit: "10", offset: "20" });
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(20);
  });

  it("should ignore invalid limit", () => {
    const result = parseQueryParams({ limit: "abc" });
    expect(result.limit).toBeUndefined();
  });

  it("should ignore negative limit", () => {
    const result = parseQueryParams({ limit: "-5" });
    expect(result.limit).toBeUndefined();
  });

  it("should parse fields", () => {
    const result = parseQueryParams({ fields: "name,status,createdAt" });
    expect(result.fields).toEqual(["name", "status", "createdAt"]);
  });

  it("should ignore invalid filter ops", () => {
    const result = parseQueryParams({ "status[invalid]": "active" });
    expect(result.filters).toBeUndefined();
  });

  it("should handle empty query", () => {
    const result = parseQueryParams({});
    expect(result).toEqual({});
  });

  it("should handle dotted field names in filters", () => {
    const result = parseQueryParams({ "school.id[eq]": "abc123" });
    expect(result.filters?.["school.id"]).toEqual({ op: "eq", value: "abc123" });
  });
});

// ── buildFirestoreQuery ─────────────────────────────────────────────────

describe("buildFirestoreQuery", () => {
  const threadsSchema = testSchemas[0]; // has companyScopeField: "school.id"
  const shiftsSchema = testSchemas[1]; // no companyScopeField

  it("should apply filters", () => {
    const mock = createMockQuery();
    buildFirestoreQuery(
      mock,
      { filters: { resolved: { op: "eq", value: true } } },
      shiftsSchema,
    );
    expect(mock.calls).toContainEqual({
      method: "where",
      args: ["resolved", "==", true],
    });
  });

  it("should apply sort", () => {
    const mock = createMockQuery();
    buildFirestoreQuery(
      mock,
      { sort: [{ field: "createdAt", order: "desc" }] },
      shiftsSchema,
    );
    expect(mock.calls).toContainEqual({
      method: "orderBy",
      args: ["createdAt", "desc"],
    });
  });

  it("should apply limit and offset", () => {
    const mock = createMockQuery();
    buildFirestoreQuery(mock, { limit: 10, offset: 5 }, shiftsSchema);
    expect(mock.calls).toContainEqual({ method: "limit", args: [10] });
    expect(mock.calls).toContainEqual({ method: "offset", args: [5] });
  });

  it("should apply field selection", () => {
    const mock = createMockQuery();
    buildFirestoreQuery(mock, { fields: ["name", "status"] }, shiftsSchema);
    expect(mock.calls).toContainEqual({
      method: "select",
      args: ["name", "status"],
    });
  });

  it("should map filter operators correctly", () => {
    const ops: Array<{ op: any; expected: string }> = [
      { op: "eq", expected: "==" },
      { op: "neq", expected: "!=" },
      { op: "gt", expected: ">" },
      { op: "gte", expected: ">=" },
      { op: "lt", expected: "<" },
      { op: "lte", expected: "<=" },
      { op: "in", expected: "in" },
      { op: "contains", expected: "array-contains" },
    ];

    for (const { op, expected } of ops) {
      const mock = createMockQuery();
      buildFirestoreQuery(
        mock,
        { filters: { field: { op, value: "test" } } },
        shiftsSchema,
      );
      expect(mock.calls).toContainEqual({
        method: "where",
        args: ["field", expected, "test"],
      });
    }
  });

  // Company scope enforcement
  describe("company scope enforcement", () => {
    it("should enforce companyScopeField when declared", () => {
      const mock = createMockQuery();
      buildFirestoreQuery(mock, {}, threadsSchema, { companyId: "company-123" });

      expect(mock.calls[0]).toEqual({
        method: "where",
        args: ["school.id", "==", "company-123"],
      });
    });

    it("should throw if companyScopeField declared but no companyId provided", () => {
      const mock = createMockQuery();
      expect(() => {
        buildFirestoreQuery(mock, {}, threadsSchema);
      }).toThrow("requires company scope");
    });

    it("should throw if companyScopeField declared but companyId is empty", () => {
      const mock = createMockQuery();
      expect(() => {
        buildFirestoreQuery(mock, {}, threadsSchema, { companyId: "" });
      }).toThrow("requires company scope");
    });

    it("should not enforce scope on schemas without companyScopeField", () => {
      const mock = createMockQuery();
      buildFirestoreQuery(mock, {}, shiftsSchema);
      expect(mock.calls.filter((c) => c.method === "where")).toHaveLength(0);
    });

    it("should add company scope BEFORE user filters", () => {
      const mock = createMockQuery();
      buildFirestoreQuery(
        mock,
        { filters: { resolved: { op: "eq", value: true } } },
        threadsSchema,
        { companyId: "company-123" },
      );

      // Company scope should be first
      expect(mock.calls[0]).toEqual({
        method: "where",
        args: ["school.id", "==", "company-123"],
      });
      // User filter should be second
      expect(mock.calls[1]).toEqual({
        method: "where",
        args: ["resolved", "==", true],
      });
    });
  });
});
