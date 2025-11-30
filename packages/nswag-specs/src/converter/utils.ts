/**
 * Schema converter common utility functions
 * $ref resolution, composite schema processing, format validation, etc.
 */

import type { Schema, OpenAPISpec } from '../types/index.js';
import type { ConvertWarning, WarningType, ConvertOptions } from './types.js';

/**
 * Warning collector class
 * Collects and manages warnings during conversion
 */
export class WarningCollector {
  private warnings: ConvertWarning[] = [];

  /**
   * Add warning
   *
   * @param type - Warning type
   * @param message - Warning message
   * @param path - Schema path (optional)
   */
  add(type: WarningType, message: string, path?: string): void {
    this.warnings.push({ type, message, path });
  }

  /**
   * Add simple warning (string only)
   *
   * @param message - Warning message
   */
  addSimple(message: string): void {
    this.warnings.push({ type: 'fallback-used', message });
  }

  /**
   * Return collected warning list
   *
   * @returns Warning string array
   */
  getWarnings(): string[] {
    return this.warnings.map((w) => (w.path ? `[${w.path}] ${w.message}` : w.message));
  }

  /**
   * Return detailed warning list
   *
   * @returns Warning object array
   */
  getDetailedWarnings(): ConvertWarning[] {
    return [...this.warnings];
  }

  /**
   * Check if warnings exist
   *
   * @returns true if warnings exist
   */
  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  /**
   * Clear warnings
   */
  clear(): void {
    this.warnings = [];
  }
}

/**
 * Resolve $ref reference
 * Resolve $ref references in OpenAPI spec to actual schemas
 *
 * @param ref - $ref string (e.g. '#/components/schemas/User')
 * @param rootSpec - Root OpenAPI spec
 * @returns Resolved schema
 * @throws Error if reference cannot be found
 *
 * @example
 * ```typescript
 * const userSchema = resolveRef('#/components/schemas/User', openApiSpec);
 * ```
 */
export function resolveRef(ref: string, rootSpec: OpenAPISpec): Schema {
  // Handle '#/components/schemas/SchemaName' format
  if (!ref.startsWith('#/')) {
    throw new Error(`External references are not supported: ${ref}`);
  }

  const path = ref.slice(2).split('/');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = rootSpec;

  for (const segment of path) {
    if (current === undefined || current === null) {
      throw new Error(`Cannot resolve $ref reference: ${ref}`);
    }
    current = current[segment];
  }

  if (current === undefined) {
    throw new Error(`$ref reference not found: ${ref}`);
  }

  return current as Schema;
}

/**
 * Try to resolve reference (no error thrown)
 *
 * @param ref - $ref string
 * @param rootSpec - Root OpenAPI spec
 * @param collector - Warning collector
 * @returns Resolved schema or empty object
 */
export function tryResolveRef(
  ref: string,
  rootSpec: OpenAPISpec | undefined,
  collector: WarningCollector,
): Schema {
  if (!rootSpec) {
    collector.add('unresolved-ref', `rootSpec not provided for $ref resolution: ${ref}`);
    return {};
  }

  try {
    return resolveRef(ref, rootSpec);
  } catch (error) {
    collector.add(
      'unresolved-ref',
      `Cannot resolve $ref reference: ${ref} - ${error instanceof Error ? error.message : String(error)}`,
    );
    return {};
  }
}

/**
 * Process composite schemas (oneOf, anyOf, allOf)
 * Merge or process composite schemas into a single schema
 *
 * @param schema - OpenAPI schema
 * @param options - Conversion options
 * @param collector - Warning collector
 * @returns Processed schema
 */
export function processCompositeSchema(
  schema: Schema,
  options: ConvertOptions = {},
  collector: WarningCollector,
): Schema {
  // allOf processing: merge all schemas
  if (schema.allOf && schema.allOf.length > 0) {
    let merged: Schema = {};
    for (const subSchema of schema.allOf) {
      const resolved = subSchema.$ref
        ? tryResolveRef(subSchema.$ref, options.rootSpec, collector)
        : subSchema;
      merged = mergeSchemas(merged, resolved);
    }
    return merged;
  }

  // oneOf, anyOf are returned as-is (processed by converter)
  return schema;
}

/**
 * Merge two schemas
 * Used for allOf processing
 *
 * @param base - Base schema
 * @param override - Schema to override with
 * @returns Merged schema
 */
export function mergeSchemas(base: Schema, override: Schema): Schema {
  const merged: Schema = { ...base };

  // Merge type
  if (override.type) {
    merged.type = override.type;
  }

  // Merge properties
  if (override.properties) {
    merged.properties = {
      ...(merged.properties || {}),
      ...override.properties,
    };
  }

  // Merge required
  if (override.required) {
    merged.required = [...new Set([...(merged.required || []), ...override.required])];
  }

  // Copy other attributes
  const keysToMerge = [
    'format',
    'description',
    'minimum',
    'maximum',
    'minLength',
    'maxLength',
    'pattern',
    'minItems',
    'maxItems',
    'uniqueItems',
    'nullable',
    'enum',
    'default',
  ] as const;

  for (const key of keysToMerge) {
    if (override[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[key] = override[key];
    }
  }

  return merged;
}

/**
 * Format validation function mapping
 * Validation functions for OpenAPI formats
 */
export const FORMAT_VALIDATORS: Record<string, (value: string) => boolean> = {
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  uri: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  url: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  uuid: (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  date: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)),
  'date-time': (value) => {
    const iso8601 =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
    return iso8601.test(value) && !isNaN(Date.parse(value));
  },
  time: (value) => /^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value),
  duration: (value) => /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/.test(value),
  ipv4: (value) => {
    const parts = value.split('.');
    return (
      parts.length === 4 &&
      parts.every((p) => {
        const num = parseInt(p, 10);
        return num >= 0 && num <= 255 && p === String(num);
      })
    );
  },
  ipv6: (value) => /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(value),
  hostname: (value) => /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(value),
};

/**
 * Normalize schema name
 * Convert to valid variable name for code generation
 *
 * @param name - Original name
 * @returns Normalized name
 */
export function normalizeSchemaName(name: string): string {
  // Capitalize first letter
  let normalized = name.charAt(0).toUpperCase() + name.slice(1);

  // Remove invalid characters
  normalized = normalized.replace(/[^a-zA-Z0-9_]/g, '');

  // Add _ prefix if starts with number
  if (/^\d/.test(normalized)) {
    normalized = '_' + normalized;
  }

  return normalized || 'Schema';
}

/**
 * Escape string
 * For use in string literals during code generation
 *
 * @param str - Original string
 * @returns Escaped string
 */
export function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Escape regex pattern
 * For use in regex literals during code generation
 *
 * @param pattern - Original pattern
 * @returns Escaped pattern
 */
export function escapeRegexPattern(pattern: string): string {
  // Only escape backslashes (other characters are preserved in regex)
  return pattern.replace(/\\/g, '\\\\');
}

/**
 * Apply indentation
 * Handle indentation for code generation
 *
 * @param code - Code string
 * @param level - Indentation level
 * @param indent - Indentation string
 * @returns Code with indentation applied
 */
export function applyIndent(code: string, level: number, indent: string = '  '): string {
  const prefix = indent.repeat(level);
  return code
    .split('\n')
    .map((line) => (line.trim() ? prefix + line : line))
    .join('\n');
}

/**
 * Create default conversion options
 *
 * @param options - User-provided options
 * @returns Options with defaults applied
 */
export function getDefaultOptions(options: ConvertOptions = {}): Required<
  Omit<ConvertOptions, 'rootSpec' | 'definitions' | 'schemaName'>
> & Pick<ConvertOptions, 'rootSpec' | 'definitions' | 'schemaName'> {
  return {
    nullable: options.nullable ?? 'null',
    additionalProperties: options.additionalProperties ?? true,
    defaultRequired: options.defaultRequired ?? false,
    includeImports: options.includeImports ?? true,
    schemaName: options.schemaName,
    exportSchema: options.exportSchema ?? true,
    generateTypeInference: options.generateTypeInference ?? true,
    rootSpec: options.rootSpec,
    definitions: options.definitions,
    indent: options.indent ?? '  ',
    strict: options.strict ?? false,
  };
}

/**
 * Check if OpenAPI schema is nullable
 *
 * @param schema - OpenAPI schema
 * @returns Whether nullable
 */
export function isNullable(schema: Schema): boolean {
  return schema.nullable === true;
}

/**
 * Check if OpenAPI schema property is required
 *
 * @param propertyName - Property name
 * @param parentSchema - Parent object schema
 * @returns Whether required
 */
export function isRequired(propertyName: string, parentSchema: Schema): boolean {
  return parentSchema.required?.includes(propertyName) ?? false;
}

/**
 * Convert enum values to string literals
 *
 * @param values - enum value array
 * @returns String literal array
 */
export function enumToLiterals(values: unknown[]): string[] {
  return values.map((v) => {
    if (typeof v === 'string') {
      return `'${escapeString(v)}'`;
    }
    return String(v);
  });
}

/**
 * Extract schema name from $ref
 *
 * @param ref - $ref string
 * @returns Schema name
 */
export function getSchemaNameFromRef(ref: string): string {
  const parts = ref.split('/');
  return parts[parts.length - 1] ?? ref;
}

/**
 * Check if OpenAPI type is a primitive type
 *
 * @param schema - OpenAPI schema
 * @returns Whether primitive type
 */
export function isPrimitiveType(schema: Schema): boolean {
  const primitiveTypes = ['string', 'number', 'integer', 'boolean', 'null'];
  return schema.type !== undefined && primitiveTypes.includes(schema.type);
}

/**
 * Check if schema is a composite type (oneOf, anyOf, allOf)
 *
 * @param schema - OpenAPI schema
 * @returns Whether composite type
 */
export function isCompositeType(schema: Schema): boolean {
  return Boolean(schema.oneOf || schema.anyOf || schema.allOf);
}

/**
 * Check if schema is a reference type
 *
 * @param schema - OpenAPI schema
 * @returns Whether reference type
 */
export function isRefType(schema: Schema): boolean {
  return Boolean(schema.$ref);
}
