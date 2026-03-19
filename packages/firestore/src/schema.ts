import type { FirestoreCollectionSchema, FirestoreFieldDef, FirestoreFieldType } from "./types.js";

const VALID_FIELD_TYPES: FirestoreFieldType[] = [
  "string",
  "number",
  "boolean",
  "timestamp",
  "reference",
  "array",
  "map",
  "geopoint",
];

export interface SchemaValidationError {
  path: string;
  message: string;
}

/**
 * Validate a single field definition.
 */
function validateField(
  field: FirestoreFieldDef,
  fieldPath: string,
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];

  if (!field.type || !VALID_FIELD_TYPES.includes(field.type)) {
    errors.push({
      path: fieldPath,
      message: `Invalid field type "${field.type}". Must be one of: ${VALID_FIELD_TYPES.join(", ")}`,
    });
  }

  if (field.type === "reference" && !field.refPath) {
    errors.push({
      path: fieldPath,
      message: 'Reference fields must specify "refPath"',
    });
  }

  if (field.type === "array" && field.items) {
    errors.push(
      ...validateField(field.items, `${fieldPath}.items`),
    );
  }

  if (field.type === "map" && field.fields) {
    for (const [name, nestedField] of Object.entries(field.fields)) {
      errors.push(
        ...validateField(nestedField, `${fieldPath}.fields.${name}`),
      );
    }
  }

  return errors;
}

/**
 * Validate a collection schema and all its subcollections recursively.
 */
export function validateSchema(
  schema: FirestoreCollectionSchema,
  parentPath = "",
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  const schemaPath = parentPath ? `${parentPath}.${schema.path}` : schema.path;

  if (!schema.path || typeof schema.path !== "string") {
    errors.push({
      path: schemaPath || "(root)",
      message: "Collection path is required and must be a string",
    });
  }

  if (!schema.displayName || typeof schema.displayName !== "string") {
    errors.push({
      path: schemaPath,
      message: "displayName is required and must be a string",
    });
  }

  if (!schema.fields || typeof schema.fields !== "object" || Object.keys(schema.fields).length === 0) {
    errors.push({
      path: schemaPath,
      message: "At least one field must be defined",
    });
  } else {
    for (const [name, field] of Object.entries(schema.fields)) {
      errors.push(...validateField(field, `${schemaPath}.fields.${name}`));
    }
  }

  if (schema.companyScopeField) {
    // companyScopeField can be a dotted path (e.g. "school.id")
    const rootField = schema.companyScopeField.split(".")[0];
    if (!schema.fields[rootField]) {
      errors.push({
        path: schemaPath,
        message: `companyScopeField "${schema.companyScopeField}" references unknown root field "${rootField}"`,
      });
    }
  }

  if (schema.subcollections) {
    for (const sub of schema.subcollections) {
      errors.push(...validateSchema(sub, schemaPath));
    }
  }

  return errors;
}

/**
 * Validate an array of schemas. Returns all errors across all schemas.
 */
export function validateSchemas(
  schemas: FirestoreCollectionSchema[],
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  for (const schema of schemas) {
    errors.push(...validateSchema(schema));
  }
  return errors;
}
