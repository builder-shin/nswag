/**
 * TypeBox Adapter
 * Convert TypeBox schemas to OpenAPI schemas
 *
 * TypeBox is already based on JSON Schema, so most conversions are straightforward.
 *
 * Limitations:
 * - Type.Recursive(): Recursive types not supported
 * - Type.This(): Self-referencing types not supported
 * - Type.Unsafe(): Unsafe types not supported
 * - Type.Transform(): Transform types not supported
 */

import type { Schema } from '../types/index.js';

/**
 * TypeBox schema type (simplified interface)
 * TypeBox is already JSON Schema compatible, so conversion is straightforward
 */
export interface TypeBoxSchema {
  type?: string;
  properties?: Record<string, TypeBoxSchema>;
  required?: string[];
  items?: TypeBoxSchema | TypeBoxSchema[];
  anyOf?: TypeBoxSchema[];
  oneOf?: TypeBoxSchema[];
  allOf?: TypeBoxSchema[];
  not?: TypeBoxSchema;
  const?: unknown;
  enum?: unknown[];
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minProperties?: number;
  maxProperties?: number;
  additionalProperties?: boolean | TypeBoxSchema;
  description?: string;
  default?: unknown;
  title?: string;
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  nullable?: boolean;
  // TypeBox-specific properties
  $id?: string;
  kind?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * TypeBox-specific properties to remove in OpenAPI
 */
const TYPEBOX_ONLY_KEYS = ['$id', 'kind', '$static', 'transform', 'params'];

/**
 * Convert TypeBox schema to OpenAPI schema
 * TypeBox is already based on JSON Schema, so most conversions are straightforward
 *
 * @param typeboxSchema - TypeBox schema to convert
 * @returns OpenAPI compatible schema
 *
 * @example
 * ```typescript
 * import { Type } from '@sinclair/typebox';
 * import { typeboxToOpenApi } from '@aspect/nswag-specs/typebox';
 *
 * const BlogSchema = Type.Object({
 *   id: Type.Integer(),
 *   title: Type.String({ minLength: 1, maxLength: 200 }),
 *   content: Type.String(),
 * });
 *
 * const openApiSchema = typeboxToOpenApi(BlogSchema);
 * ```
 */
export function typeboxToOpenApi(typeboxSchema: TypeBoxSchema): Schema {
  // Remove TypeBox-specific fields like $id, kind that are not needed in OpenAPI
  const cleanedSchema = cleanTypeBoxSchema(typeboxSchema);

  // Recursively convert
  return convertSchema(cleanedSchema);
}

/**
 * Remove TypeBox-specific properties
 */
function cleanTypeBoxSchema(schema: TypeBoxSchema): TypeBoxSchema {
  const cleaned: TypeBoxSchema = {};

  for (const [key, value] of Object.entries(schema)) {
    // Skip TypeBox-specific properties
    if (TYPEBOX_ONLY_KEYS.includes(key)) {
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

/**
 * Convert schema
 */
function convertSchema(schema: TypeBoxSchema): Schema {
  const result: Schema = {};

  // Basic type
  if (schema.type) {
    result.type = schema.type;
  }

  // format
  if (schema.format) {
    result.format = schema.format;
  }

  // description
  if (schema.description) {
    result.description = schema.description;
  }

  // enum
  if (schema.enum) {
    result.enum = schema.enum;
  }

  // const (supported in OpenAPI 3.1+, converted to enum in 3.0)
  if (schema.const !== undefined) {
    result.enum = [schema.const];
  }

  // default
  if (schema.default !== undefined) {
    result.default = schema.default;
  }

  // nullable
  if (schema.nullable) {
    result.nullable = schema.nullable;
  }

  // String constraints
  if (schema.minLength !== undefined) {
    result.minLength = schema.minLength;
  }
  if (schema.maxLength !== undefined) {
    result.maxLength = schema.maxLength;
  }
  if (schema.pattern) {
    result.pattern = schema.pattern;
  }

  // Number constraints
  if (schema.minimum !== undefined) {
    result.minimum = schema.minimum;
  }
  if (schema.maximum !== undefined) {
    result.maximum = schema.maximum;
  }
  if (schema.exclusiveMinimum !== undefined) {
    result.exclusiveMinimum = schema.exclusiveMinimum;
  }
  if (schema.exclusiveMaximum !== undefined) {
    result.exclusiveMaximum = schema.exclusiveMaximum;
  }
  if (schema.multipleOf !== undefined) {
    result.multipleOf = schema.multipleOf;
  }

  // Array constraints
  if (schema.minItems !== undefined) {
    result.minItems = schema.minItems;
  }
  if (schema.maxItems !== undefined) {
    result.maxItems = schema.maxItems;
  }
  if (schema.uniqueItems !== undefined) {
    result.uniqueItems = schema.uniqueItems;
  }

  // Object constraints
  if (schema.minProperties !== undefined) {
    result.minProperties = schema.minProperties;
  }
  if (schema.maxProperties !== undefined) {
    result.maxProperties = schema.maxProperties;
  }

  // properties (Object)
  if (schema.properties) {
    result.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      result.properties[key] = typeboxToOpenApi(value);
    }
  }

  // required
  if (schema.required && schema.required.length > 0) {
    result.required = schema.required;
  }

  // additionalProperties
  if (schema.additionalProperties !== undefined) {
    if (typeof schema.additionalProperties === 'boolean') {
      result.additionalProperties = schema.additionalProperties;
    } else {
      result.additionalProperties = typeboxToOpenApi(schema.additionalProperties);
    }
  }

  // items (Array)
  if (schema.items) {
    if (Array.isArray(schema.items)) {
      // Tuple: items is an array
      result.items = {
        oneOf: schema.items.map((item) => typeboxToOpenApi(item)),
      };
      result.minItems = schema.items.length;
      result.maxItems = schema.items.length;
    } else {
      result.items = typeboxToOpenApi(schema.items);
    }
  }

  // anyOf
  if (schema.anyOf) {
    result.anyOf = schema.anyOf.map((s) => typeboxToOpenApi(s));
  }

  // oneOf
  if (schema.oneOf) {
    result.oneOf = schema.oneOf.map((s) => typeboxToOpenApi(s));
  }

  // allOf
  if (schema.allOf) {
    result.allOf = schema.allOf.map((s) => typeboxToOpenApi(s));
  }

  // not
  if (schema.not) {
    result.not = typeboxToOpenApi(schema.not);
  }

  // Handle $ref
  if (schema.$ref) {
    result.$ref = schema.$ref;
  }

  // Other metadata
  if (schema.title) {
    result.title = schema.title;
  }
  if (schema.deprecated) {
    result.deprecated = schema.deprecated;
  }
  if (schema.readOnly) {
    result.readOnly = schema.readOnly;
  }
  if (schema.writeOnly) {
    result.writeOnly = schema.writeOnly;
  }

  return result;
}

/**
 * Resolve references ($ref) in TypeBox schema
 *
 * @param schema - Schema to resolve
 * @param definitions - Defined schemas
 * @returns Resolved schema
 */
export function resolveTypeBoxRefs(
  schema: TypeBoxSchema,
  definitions: Record<string, TypeBoxSchema>
): Schema {
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/$defs/', '').replace('#/definitions/', '');
    const resolved = definitions[refPath];
    if (resolved) {
      return typeboxToOpenApi(resolved);
    }
  }

  return typeboxToOpenApi(schema);
}
