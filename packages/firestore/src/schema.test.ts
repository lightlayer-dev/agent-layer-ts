import { describe, it, expect } from "vitest";
import { validateSchema, validateSchemas } from "./schema.js";
import { testSchemas } from "./fixtures.js";
import type { FirestoreCollectionSchema } from "./types.js";

describe("validateSchema", () => {
  it("should validate the test schemas without errors", () => {
    const errors = validateSchemas(testSchemas);
    expect(errors).toEqual([]);
  });

  it("should reject a schema with no path", () => {
    const schema: FirestoreCollectionSchema = {
      path: "",
      displayName: "Test",
      fields: { name: { type: "string" } },
    };
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("path is required");
  });

  it("should reject a schema with no displayName", () => {
    const schema: FirestoreCollectionSchema = {
      path: "test",
      displayName: "",
      fields: { name: { type: "string" } },
    };
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("displayName is required");
  });

  it("should reject a schema with no fields", () => {
    const schema: FirestoreCollectionSchema = {
      path: "test",
      displayName: "Test",
      fields: {},
    };
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("At least one field");
  });

  it("should reject an invalid field type", () => {
    const schema: FirestoreCollectionSchema = {
      path: "test",
      displayName: "Test",
      fields: { name: { type: "invalid" as any } },
    };
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("Invalid field type");
  });

  it("should reject a reference field without refPath", () => {
    const schema: FirestoreCollectionSchema = {
      path: "test",
      displayName: "Test",
      fields: { ref: { type: "reference" } },
    };
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("refPath");
  });

  it("should validate nested map fields", () => {
    const schema: FirestoreCollectionSchema = {
      path: "test",
      displayName: "Test",
      fields: {
        data: {
          type: "map",
          fields: {
            nested: { type: "invalid" as any },
          },
        },
      },
    };
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toContain("fields.data.fields.nested");
  });

  it("should validate array item types", () => {
    const schema: FirestoreCollectionSchema = {
      path: "test",
      displayName: "Test",
      fields: {
        items: {
          type: "array",
          items: { type: "invalid" as any },
        },
      },
    };
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toContain("items");
  });

  it("should validate subcollections", () => {
    const schema: FirestoreCollectionSchema = {
      path: "parent",
      displayName: "Parent",
      fields: { name: { type: "string" } },
      subcollections: [
        {
          path: "",
          displayName: "Child",
          fields: { val: { type: "number" } },
        },
      ],
    };
    const errors = validateSchema(schema);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("should warn if companyScopeField references unknown field", () => {
    const schema: FirestoreCollectionSchema = {
      path: "test",
      displayName: "Test",
      companyScopeField: "unknown.id",
      fields: { name: { type: "string" } },
    };
    const errors = validateSchema(schema);
    expect(errors.some((e) => e.message.includes("companyScopeField"))).toBe(true);
  });

  it("should accept companyScopeField with dotted path if root field exists", () => {
    const schema: FirestoreCollectionSchema = {
      path: "test",
      displayName: "Test",
      companyScopeField: "school.id",
      fields: { school: { type: "reference", refPath: "schools" } },
    };
    const errors = validateSchema(schema);
    expect(errors).toEqual([]);
  });
});
