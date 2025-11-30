/**
 * Schema processing utilities
 * Phase 4: API version and documentation options
 *
 * Nullable property support, schema validation options handling
 */

import type { SchemaObject, ResponseOptions } from './types.js';
import { GlobalConfigManager } from './global-config.js';

/**
 * Extended schema type (for nullable handling - OpenAPI 3.1 array type support)
 */
interface ExtendedSchemaObject extends Omit<SchemaObject, 'type'> {
  type?: string | string[];
}

// ============================================================================
// Nullable handling
// ============================================================================

/**
 * Check if schema is OpenAPI 3.1
 */
export function isOpenAPI31(specPath?: string): boolean {
  const version = GlobalConfigManager.getOpenAPIVersion(specPath);
  return version.startsWith('3.1');
}

/**
 * Normalize nullable property according to OpenAPI version
 *
 * OpenAPI 3.0: { type: 'string', nullable: true }
 * OpenAPI 3.1: { type: ['string', 'null'] }
 *
 * @example
 * // In OpenAPI 3.0
 * normalizeNullable({ type: 'string', nullable: true })
 * // => { type: 'string', nullable: true }
 *
 * // In OpenAPI 3.1
 * normalizeNullable({ type: 'string', nullable: true })
 * // => { type: ['string', 'null'] }
 */
export function normalizeNullable(schema: SchemaObject, specPath?: string): SchemaObject {
  // Process as ExtendedSchemaObject (array type support)
  const result: ExtendedSchemaObject = { ...schema };
  const is31 = isOpenAPI31(specPath);

  // Support x-nullable legacy (Swagger 2.0 compatibility)
  if ('x-nullable' in schema) {
    const xNullable = (schema as Record<string, unknown>)['x-nullable'];
    if (xNullable === true) {
      if (is31) {
        result.type = makeNullableType31(schema.type);
      } else {
        result.nullable = true;
      }
    }
    // Remove x-nullable property
    delete (result as Record<string, unknown>)['x-nullable'];
  }

  // Convert nullable property to OpenAPI 3.1
  if (result.nullable && is31) {
    result.type = makeNullableType31(result.type as string | undefined);
    delete result.nullable;
  }

  // Convert OpenAPI 3.1 array type to 3.0 (if needed)
  if (!is31 && Array.isArray(result.type)) {
    const types = result.type as string[];
    if (types.includes('null')) {
      result.type = types.find(t => t !== 'null');
      result.nullable = true;
    }
  }

  // Process nested schemas
  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, propSchema]) => [
        key,
        normalizeNullable(propSchema as SchemaObject, specPath),
      ])
    );
  }

  if (result.items) {
    result.items = normalizeNullable(result.items as SchemaObject, specPath);
  }

  if (result.allOf) {
    result.allOf = result.allOf.map(s => normalizeNullable(s as SchemaObject, specPath));
  }

  if (result.oneOf) {
    result.oneOf = result.oneOf.map(s => normalizeNullable(s as SchemaObject, specPath));
  }

  if (result.anyOf) {
    result.anyOf = result.anyOf.map(s => normalizeNullable(s as SchemaObject, specPath));
  }

  // Return as SchemaObject (convert type to string for OpenAPI 3.0 compatibility)
  // Keep OpenAPI 3.1 array types intact with type casting
  return result as unknown as SchemaObject;
}

/**
 * Create nullable type for OpenAPI 3.1
 */
function makeNullableType31(type: string | string[] | undefined): string[] {
  if (!type) {
    return ['null'];
  }
  if (Array.isArray(type)) {
    return type.includes('null') ? type : [...type, 'null'];
  }
  return [type, 'null'];
}

// ============================================================================
// Schema validation options processing
// ============================================================================

/**
 * Apply validation options to schema
 *
 * @example
 * applySchemaValidationOptions(schema, {
 *   openapiNoAdditionalProperties: true,
 *   openapiAllPropertiesRequired: true
 * });
 */
export function applySchemaValidationOptions(
  schema: SchemaObject,
  options: ResponseOptions = {}
): SchemaObject {
  const result = { ...schema };

  // Merge global config and individual options
  const noAdditionalProperties =
    options.openapiNoAdditionalProperties ??
    GlobalConfigManager.getNoAdditionalProperties();
  const allPropertiesRequired =
    options.openapiAllPropertiesRequired ??
    GlobalConfigManager.getAllPropertiesRequired();

  // Process additionalProperties
  if (noAdditionalProperties && result.type === 'object') {
    result.additionalProperties = false;
  }

  // Process required
  if (allPropertiesRequired && result.type === 'object' && result.properties) {
    result.required = Object.keys(result.properties);
  }

  // Process nested schemas
  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, propSchema]) => [
        key,
        applySchemaValidationOptions(propSchema as SchemaObject, options),
      ])
    );
  }

  if (result.items) {
    result.items = applySchemaValidationOptions(result.items, options);
  }

  if (result.allOf) {
    result.allOf = result.allOf.map(s => applySchemaValidationOptions(s, options));
  }

  if (result.oneOf) {
    result.oneOf = result.oneOf.map(s => applySchemaValidationOptions(s, options));
  }

  if (result.anyOf) {
    result.anyOf = result.anyOf.map(s => applySchemaValidationOptions(s, options));
  }

  return result;
}

/**
 * Preprocess schema (nullable + validation options)
 *
 * @example
 * const processedSchema = processSchema(rawSchema, {
 *   openapiNoAdditionalProperties: true
 * }, 'v1/openapi.json');
 */
export function processSchema(
  schema: SchemaObject,
  options: ResponseOptions = {},
  specPath?: string
): SchemaObject {
  // 1. Normalize nullable
  let result = normalizeNullable(schema, specPath);

  // 2. Apply validation options
  result = applySchemaValidationOptions(result, options);

  return result;
}

// ============================================================================
// Schema validation
// ============================================================================

/**
 * Schema validation error
 */
export interface SchemaValidationError {
  path: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

/**
 * Validate if response data matches schema
 *
 * @example
 * const errors = validateAgainstSchema(responseBody, schema, {
 *   openapiNoAdditionalProperties: true
 * });
 */
export function validateAgainstSchema(
  data: unknown,
  schema: SchemaObject,
  options: ResponseOptions = {},
  path: string = '$'
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  const processedSchema = applySchemaValidationOptions(schema, options);

  // Validate null
  if (data === null) {
    if (!processedSchema.nullable && !isNullableType(processedSchema.type)) {
      errors.push({
        path,
        message: 'null value is not allowed',
        expected: processedSchema.type,
        actual: 'null',
      });
    }
    return errors;
  }

  // Validate type
  const expectedType = getBaseType(processedSchema.type);
  const actualType = getActualType(data);

  if (expectedType && actualType !== expectedType) {
    errors.push({
      path,
      message: `type does not match`,
      expected: expectedType,
      actual: actualType,
    });
    return errors;
  }

  // Validate object
  if (processedSchema.type === 'object' && typeof data === 'object' && data !== null) {
    const dataObj = data as Record<string, unknown>;

    // Validate required fields
    if (processedSchema.required) {
      for (const requiredField of processedSchema.required) {
        if (!(requiredField in dataObj)) {
          errors.push({
            path: `${path}.${requiredField}`,
            message: 'required field is missing',
          });
        }
      }
    }

    // Validate additionalProperties
    if (processedSchema.additionalProperties === false && processedSchema.properties) {
      const allowedKeys = new Set(Object.keys(processedSchema.properties));
      for (const key of Object.keys(dataObj)) {
        if (!allowedKeys.has(key)) {
          errors.push({
            path: `${path}.${key}`,
            message: 'additional property is not allowed',
          });
        }
      }
    }

    // Recursively validate properties
    if (processedSchema.properties) {
      for (const [key, propSchema] of Object.entries(processedSchema.properties)) {
        if (key in dataObj) {
          errors.push(...validateAgainstSchema(dataObj[key], propSchema, options, `${path}.${key}`));
        }
      }
    }
  }

  // Validate array
  if (processedSchema.type === 'array' && Array.isArray(data) && processedSchema.items) {
    data.forEach((item, index) => {
      errors.push(...validateAgainstSchema(item, processedSchema.items!, options, `${path}[${index}]`));
    });
  }

  return errors;
}

/**
 * Check if type is nullable (OpenAPI 3.1 array type)
 */
function isNullableType(type: string | string[] | undefined): boolean {
  if (Array.isArray(type)) {
    return type.includes('null');
  }
  return false;
}

/**
 * Extract base type from array type
 */
function getBaseType(type: string | string[] | undefined): string | undefined {
  if (Array.isArray(type)) {
    return type.find(t => t !== 'null');
  }
  return type;
}

/**
 * Get actual type of data
 */
function getActualType(data: unknown): string {
  if (data === null) return 'null';
  if (Array.isArray(data)) return 'array';
  return typeof data;
}

// ============================================================================
// Phase 5: $ref schema reference resolution
// ============================================================================

/**
 * Schema registry type
 */
export interface SchemaRegistry {
  [path: string]: SchemaObject;
}

/**
 * Global schema registry
 */
const globalSchemaRegistry: SchemaRegistry = {};

/**
 * Register schema in schema registry
 *
 * @example
 * registerSchema('#/components/schemas/Blog', {
 *   type: 'object',
 *   properties: { id: { type: 'integer' }, title: { type: 'string' } }
 * });
 */
export function registerSchema(refPath: string, schema: SchemaObject): void {
  globalSchemaRegistry[refPath] = schema;
}

/**
 * Clear schema registry
 */
export function clearSchemaRegistry(): void {
  Object.keys(globalSchemaRegistry).forEach(key => {
    delete globalSchemaRegistry[key];
  });
}

/**
 * Get schema from schema registry
 */
export function getRegisteredSchema(refPath: string): SchemaObject | undefined {
  return globalSchemaRegistry[refPath];
}

/**
 * Resolve $ref schema reference
 *
 * @param schema - Schema containing references
 * @param registry - Schema registry (default: global registry)
 * @returns Resolved schema
 *
 * @example
 * const resolvedSchema = resolveSchemaRef({
 *   $ref: '#/components/schemas/Blog'
 * });
 *
 * @example
 * // Resolve nested references
 * const resolvedSchema = resolveSchemaRef({
 *   type: 'object',
 *   properties: {
 *     blog: { $ref: '#/components/schemas/Blog' }
 *   }
 * });
 */
export function resolveSchemaRef(
  schema: SchemaObject,
  registry: SchemaRegistry = globalSchemaRegistry,
  visited: Set<string> = new Set()
): SchemaObject {
  // Resolve if $ref exists
  if (schema.$ref) {
    // Prevent circular references
    if (visited.has(schema.$ref)) {
      return schema; // Return circular reference as is
    }

    visited.add(schema.$ref);
    const resolvedSchema = registry[schema.$ref];

    if (resolvedSchema) {
      // Resolve recursively
      return resolveSchemaRef(resolvedSchema, registry, visited);
    }

    // Return unresolved reference as is
    return schema;
  }

  // Resolve nested schemas
  const result: SchemaObject = { ...schema };

  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, propSchema]) => [
        key,
        resolveSchemaRef(propSchema as SchemaObject, registry, new Set(visited)),
      ])
    );
  }

  if (result.items) {
    result.items = resolveSchemaRef(result.items as SchemaObject, registry, new Set(visited));
  }

  if (result.allOf) {
    result.allOf = result.allOf.map(s =>
      resolveSchemaRef(s as SchemaObject, registry, new Set(visited))
    );
  }

  if (result.oneOf) {
    result.oneOf = result.oneOf.map(s =>
      resolveSchemaRef(s as SchemaObject, registry, new Set(visited))
    );
  }

  if (result.anyOf) {
    result.anyOf = result.anyOf.map(s =>
      resolveSchemaRef(s as SchemaObject, registry, new Set(visited))
    );
  }

  if (typeof result.additionalProperties === 'object' && result.additionalProperties !== null) {
    result.additionalProperties = resolveSchemaRef(
      result.additionalProperties as SchemaObject,
      registry,
      new Set(visited)
    );
  }

  return result;
}

/**
 * Register components/schemas from OpenAPI spec to registry
 *
 * @example
 * registerSchemasFromSpec({
 *   components: {
 *     schemas: {
 *       Blog: { type: 'object', properties: { id: { type: 'integer' } } }
 *     }
 *   }
 * });
 * // Result: Accessible via '#/components/schemas/Blog'
 */
export function registerSchemasFromSpec(spec: {
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
}): void {
  if (spec.components?.schemas) {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      registerSchema(`#/components/schemas/${name}`, schema);
    }
  }
}

// ============================================================================
// Phase 5: Composite schema validation (oneOf, anyOf, allOf)
// ============================================================================

/**
 * Validate oneOf schema
 * Must match exactly one schema
 *
 * @example
 * validateOneOf(data, [
 *   { type: 'string' },
 *   { type: 'number' }
 * ]);
 */
export function validateOneOf(
  data: unknown,
  schemas: SchemaObject[],
  options: ResponseOptions = {},
  path: string = '$'
): SchemaValidationError[] {
  let matchCount = 0;
  const allErrors: SchemaValidationError[] = [];

  for (const schema of schemas) {
    const errors = validateAgainstSchema(data, schema, options, path);
    if (errors.length === 0) {
      matchCount++;
    } else {
      allErrors.push(...errors);
    }
  }

  if (matchCount === 0) {
    return [{
      path,
      message: `oneOf: does not match any schema (checked ${schemas.length} schemas)`,
    }];
  }

  if (matchCount > 1) {
    return [{
      path,
      message: `oneOf: must match exactly one schema but matches ${matchCount}`,
    }];
  }

  return [];
}

/**
 * Validate anyOf schema
 * Must match one or more schemas
 *
 * @example
 * validateAnyOf(data, [
 *   { type: 'string' },
 *   { type: 'number' }
 * ]);
 */
export function validateAnyOf(
  data: unknown,
  schemas: SchemaObject[],
  options: ResponseOptions = {},
  path: string = '$'
): SchemaValidationError[] {
  for (const schema of schemas) {
    const errors = validateAgainstSchema(data, schema, options, path);
    if (errors.length === 0) {
      return []; // Success if any match
    }
  }

  return [{
    path,
    message: `anyOf: does not match any schema (checked ${schemas.length} schemas)`,
  }];
}

/**
 * Validate allOf schema
 * Must match all schemas (schema composition)
 *
 * @example
 * validateAllOf(data, [
 *   { type: 'object', properties: { name: { type: 'string' } } },
 *   { type: 'object', properties: { age: { type: 'number' } } }
 * ]);
 */
export function validateAllOf(
  data: unknown,
  schemas: SchemaObject[],
  options: ResponseOptions = {},
  path: string = '$'
): SchemaValidationError[] {
  const allErrors: SchemaValidationError[] = [];

  for (let i = 0; i < schemas.length; i++) {
    const schema = schemas[i];
    if (!schema) continue;

    const errors = validateAgainstSchema(data, schema, options, path);
    if (errors.length > 0) {
      allErrors.push({
        path,
        message: `allOf[${i}]: does not match schema`,
      });
      allErrors.push(...errors);
    }
  }

  return allErrors;
}

/**
 * Validate complete schema including composite schemas
 *
 * @example
 * validateCompositeSchema(data, {
 *   oneOf: [
 *     { $ref: '#/components/schemas/BlogA' },
 *     { $ref: '#/components/schemas/BlogB' }
 *   ]
 * });
 */
export function validateCompositeSchema(
  data: unknown,
  schema: SchemaObject,
  options: ResponseOptions = {},
  path: string = '$'
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];

  // Resolve $ref
  const resolvedSchema = resolveSchemaRef(schema);

  // Validate oneOf
  if (resolvedSchema.oneOf && resolvedSchema.oneOf.length > 0) {
    errors.push(...validateOneOf(data, resolvedSchema.oneOf, options, path));
  }

  // Validate anyOf
  if (resolvedSchema.anyOf && resolvedSchema.anyOf.length > 0) {
    errors.push(...validateAnyOf(data, resolvedSchema.anyOf, options, path));
  }

  // Validate allOf
  if (resolvedSchema.allOf && resolvedSchema.allOf.length > 0) {
    errors.push(...validateAllOf(data, resolvedSchema.allOf, options, path));
  }

  // Validate basic schema if no composite schemas
  if (!resolvedSchema.oneOf && !resolvedSchema.anyOf && !resolvedSchema.allOf) {
    errors.push(...validateAgainstSchema(data, resolvedSchema, options, path));
  }

  return errors;
}

/**
 * Merge allOf schemas
 * Merge multiple schemas into one schema.
 *
 * @example
 * const merged = mergeAllOfSchemas([
 *   { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
 *   { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] }
 * ]);
 * // => { type: 'object', properties: { a: {...}, b: {...} }, required: ['a', 'b'] }
 */
export function mergeAllOfSchemas(schemas: SchemaObject[]): SchemaObject {
  const result: SchemaObject = {};

  for (const schema of schemas) {
    const resolved = resolveSchemaRef(schema);

    // Merge type (use first valid type)
    if (resolved.type && !result.type) {
      result.type = resolved.type;
    }

    // Merge properties
    if (resolved.properties) {
      result.properties = {
        ...result.properties,
        ...resolved.properties,
      };
    }

    // Merge required (remove duplicates)
    if (resolved.required) {
      const existingRequired = result.required ?? [];
      result.required = [...new Set([...existingRequired, ...resolved.required])];
    }

    // Merge other properties
    if (resolved.additionalProperties !== undefined && result.additionalProperties === undefined) {
      result.additionalProperties = resolved.additionalProperties;
    }

    if (resolved.description && !result.description) {
      result.description = resolved.description;
    }
  }

  return result;
}
