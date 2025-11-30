/**
 * Zod schema converter
 * Bidirectional conversion between OpenAPI JSON Schema and Zod schemas
 *
 * @example
 * ```typescript
 * import { openApiToZod, generateZodCode } from '@builder-shin/nswag-specs/converter';
 *
 * // Runtime schema generation
 * const result = openApiToZod({
 *   type: 'object',
 *   properties: {
 *     id: { type: 'integer' },
 *     email: { type: 'string', format: 'email' },
 *   },
 *   required: ['id', 'email'],
 * });
 *
 * // Validation
 * const parsed = result.schema.safeParse(data);
 *
 * // Code generation
 * const code = generateZodCode(schema, { schemaName: 'UserSchema' });
 * ```
 */

import type { Schema } from '../types/index.js';
import type { ConvertOptions, ConvertResult } from './types.js';
import {
  WarningCollector,
  tryResolveRef,
  processCompositeSchema,
  getDefaultOptions,
  escapeString,
  escapeRegexPattern,
  enumToLiterals,
  getSchemaNameFromRef,
  normalizeSchemaName,
} from './utils.js';

/**
 * Zod namespace type (for dynamic import)
 */
interface ZodNamespace {
  string: () => ZodType;
  number: () => ZodType;
  boolean: () => ZodType;
  null: () => ZodType;
  array: (schema: ZodType) => ZodType;
  object: (shape: Record<string, ZodType>) => ZodType;
  union: (schemas: ZodType[]) => ZodType;
  intersection: (a: ZodType, b: ZodType) => ZodType;
  literal: (value: unknown) => ZodType;
  enum: (values: [string, ...string[]]) => ZodType;
  any: () => ZodType;
  unknown: () => ZodType;
  never: () => ZodType;
  record: (valueType: ZodType) => ZodType;
}

/**
 * Zod type interface (internal use)
 */
interface ZodType {
  optional: () => ZodType;
  nullable: () => ZodType;
  nullish: () => ZodType;
  int: () => ZodType;
  min: (value: number) => ZodType;
  max: (value: number) => ZodType;
  gte: (value: number) => ZodType;
  lte: (value: number) => ZodType;
  gt: (value: number) => ZodType;
  lt: (value: number) => ZodType;
  multipleOf: (value: number) => ZodType;
  length: (value: number) => ZodType;
  email: () => ZodType;
  url: () => ZodType;
  uuid: () => ZodType;
  datetime: () => ZodType;
  regex: (pattern: RegExp) => ZodType;
  default: (value: unknown) => ZodType;
  describe: (description: string) => ZodType;
  passthrough: () => ZodType;
  strict: () => ZodType;
  safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: unknown };
  parse: (data: unknown) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _def: any;
}

/**
 * Zod Dynamically load instance
 *
 * @returns Zod module
 * @throws ZodError if not installed
 */
async function loadZod(): Promise<ZodNamespace> {
  try {
    const zodModule = await import('zod');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (zodModule as any).z as ZodNamespace;
  } catch {
    throw new Error(
      'The zod package is not installed. Please run npm install zod.',
    );
  }
}

/**
 * Convert OpenAPI schema to Zod schema (async)
 *
 * @param schema - OpenAPI schema
 * @param options - Conversion options
 * @returns Conversion result (schema and warnings)
 *
 * @example
 * ```typescript
 * const result = await openApiToZod({
 *   type: 'object',
 *   properties: {
 *     id: { type: 'integer' },
 *     email: { type: 'string', format: 'email' },
 *   },
 *   required: ['id', 'email'],
 * });
 *
 * const parsed = result.schema.safeParse({ id: 1, email: 'test@example.com' });
 * ```
 */
export async function openApiToZod(
  schema: Schema,
  options: ConvertOptions = {},
): Promise<ConvertResult<ZodType>> {
  const z = await loadZod();
  const collector = new WarningCollector();
  const opts = getDefaultOptions(options);

  const zodSchema = convertSchemaToZod(schema, z, opts, collector);
  const code = generateZodCode(schema, options);

  return {
    schema: zodSchema,
    code,
    warnings: collector.getWarnings(),
  };
}

/**
 * Convert OpenAPI schema to Zod schema (sync, instance required)
 *
 * @param schema - OpenAPI schema
 * @param z - Zod namespace
 * @param options - Conversion options
 * @param collector - Warning collector
 * @returns Zod schema
 */
function convertSchemaToZod(
  schema: Schema,
  z: ZodNamespace,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): ZodType {
  // $ref processing
  if (schema.$ref) {
    const resolved = tryResolveRef(schema.$ref, options.rootSpec, collector);
    if (Object.keys(resolved).length === 0) {
      return z.any();
    }
    return convertSchemaToZod(resolved, z, options, collector);
  }

  // allOf processing
  if (schema.allOf) {
    const processed = processCompositeSchema(schema, options, collector);
    return convertSchemaToZod(processed, z, options, collector);
  }

  // oneOf processing
  if (schema.oneOf && schema.oneOf.length > 0) {
    const schemas = schema.oneOf.map((s) => convertSchemaToZod(s, z, options, collector));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return z.union(schemas as [ZodType, ZodType, ...ZodType[]]);
  }

  // anyOf processing (same as oneOf)
  if (schema.anyOf && schema.anyOf.length > 0) {
    const schemas = schema.anyOf.map((s) => convertSchemaToZod(s, z, options, collector));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return z.union(schemas as [ZodType, ZodType, ...ZodType[]]);
  }

  // enum processing
  if (schema.enum && schema.enum.length > 0) {
    const values = schema.enum as string[];
    if (values.length === 1) {
      return z.literal(values[0]);
    }
    return z.enum(values as [string, ...string[]]);
  }

  // Type-specific processing
  switch (schema.type) {
    case 'string':
      return convertStringSchema(schema, z, collector);

    case 'number':
    case 'integer':
      return convertNumberSchema(schema, z, collector);

    case 'boolean':
      return z.boolean();

    case 'null':
      return z.null();

    case 'array':
      return convertArraySchema(schema, z, options, collector);

    case 'object':
      return convertObjectSchema(schema, z, options, collector);

    default:
      // If no type specified, process as any
      if (!schema.type) {
        collector.add('unsupported-type', 'Schema has no type specified. Converting to any.');
        return z.any();
      }
      collector.add('unsupported-type', `Unsupported type: ${schema.type}`);
      return z.any();
  }
}

/**
 * string Schema conversion
 */
function convertStringSchema(
  schema: Schema,
  z: ZodNamespace,
  collector: WarningCollector,
): ZodType {
  let result = z.string();

  // format processing
  if (schema.format) {
    switch (schema.format) {
      case 'email':
        result = result.email();
        break;
      case 'uri':
      case 'url':
        result = result.url();
        break;
      case 'uuid':
        result = result.uuid();
        break;
      case 'date-time':
      case 'date':
        result = result.datetime();
        break;
      case 'ipv4':
      case 'ipv6':
      case 'hostname':
        // Not directly supported by Zod, could use regex but only show warning
        collector.add(
          'unsupported-format',
          `Zod does not directly support '${schema.format}' format. Converting to basic string.`,
        );
        break;
      default:
        collector.add(
          'unsupported-format',
          `Unknown format: ${schema.format}`,
        );
    }
  }

  // Length constraints
  if (schema.minLength !== undefined) {
    result = result.min(schema.minLength);
  }
  if (schema.maxLength !== undefined) {
    result = result.max(schema.maxLength);
  }

  // pattern processing
  if (schema.pattern) {
    try {
      result = result.regex(new RegExp(schema.pattern));
    } catch (error) {
      collector.add(
        'unsupported-constraint',
        `Invalid regex pattern: ${schema.pattern}`,
      );
    }
  }

  return result;
}

/**
 * number/integer Schema conversion
 */
function convertNumberSchema(
  schema: Schema,
  z: ZodNamespace,
  _collector: WarningCollector,
): ZodType {
  let result = z.number();

  // integer processing
  if (schema.type === 'integer') {
    result = result.int();
  }

  // minimum/maximum constraints
  if (schema.minimum !== undefined) {
    result = result.gte(schema.minimum);
  }
  if (schema.maximum !== undefined) {
    result = result.lte(schema.maximum);
  }
  if (schema.exclusiveMinimum !== undefined) {
    result = result.gt(schema.exclusiveMinimum);
  }
  if (schema.exclusiveMaximum !== undefined) {
    result = result.lt(schema.exclusiveMaximum);
  }

  // multipleOf processing
  if (schema.multipleOf !== undefined) {
    result = result.multipleOf(schema.multipleOf);
  }

  return result;
}

/**
 * array Schema conversion
 */
function convertArraySchema(
  schema: Schema,
  z: ZodNamespace,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): ZodType {
  // Items schema
  const itemSchema = schema.items
    ? convertSchemaToZod(schema.items, z, options, collector)
    : z.any();

  let result = z.array(itemSchema);

  // Array length constraints
  if (schema.minItems !== undefined) {
    result = result.min(schema.minItems);
  }
  if (schema.maxItems !== undefined) {
    result = result.max(schema.maxItems);
  }

  // uniqueItems is not directly supported by Zod
  if (schema.uniqueItems) {
    collector.add(
      'unsupported-constraint',
      'uniqueItems is not directly supported by Zod. Use refine() for manual validation.',
    );
  }

  return result;
}

/**
 * object Schema conversion
 */
function convertObjectSchema(
  schema: Schema,
  z: ZodNamespace,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): ZodType {
  const shape: Record<string, ZodType> = {};
  const requiredFields = new Set(schema.required || []);

  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      let fieldSchema = convertSchemaToZod(propSchema, z, options, collector);

      // nullable processing
      if (propSchema.nullable) {
        switch (options.nullable) {
          case 'optional':
            fieldSchema = fieldSchema.optional();
            break;
          case 'nullish':
            fieldSchema = fieldSchema.nullish();
            break;
          case 'null':
          default:
            fieldSchema = fieldSchema.nullable();
        }
      }

      // optional processing
      const isRequired = options.defaultRequired || requiredFields.has(key);
      if (!isRequired && !propSchema.nullable) {
        fieldSchema = fieldSchema.optional();
      }

      // default processing
      if (propSchema.default !== undefined) {
        fieldSchema = fieldSchema.default(propSchema.default);
      }

      shape[key] = fieldSchema;
    }
  }

  let result = z.object(shape);

  // additionalProperties processing
  if (options.additionalProperties) {
    result = result.passthrough();
  } else if (options.strict) {
    result = result.strict();
  }

  return result;
}

/**
 * Zod Convert schema to OpenAPI schema
 * (Same functionality as zodToOpenApi in adapters/zod.ts - re-export)
 *
 * @param zodSchema - Zod schema
 * @returns OpenAPI schema
 */
export { zodToOpenApi } from '../adapters/zod.js';

/**
 * Generate TypeScript code from OpenAPI schema
 *
 * @param schema - OpenAPI schema
 * @param options - Conversion options
 * @returns Generated TypeScript code
 *
 * @example
 * ```typescript
 * const code = generateZodCode(
 *   {
 *     type: 'object',
 *     properties: {
 *       id: { type: 'integer' },
 *       email: { type: 'string', format: 'email' },
 *     },
 *     required: ['id', 'email'],
 *   },
 *   { schemaName: 'UserSchema', includeImports: true }
 * );
 *
 * // Output:
 * // import { z } from 'zod';
 * //
 * // export const UserSchema = z.object({
 * //   id: z.number().int(),
 * //   email: z.string().email(),
 * // });
 * ```
 */
export function generateZodCode(schema: Schema, options: ConvertOptions = {}): string {
  const opts = getDefaultOptions(options);
  const collector = new WarningCollector();
  const lines: string[] = [];

  // Generate import statement
  if (opts.includeImports) {
    lines.push("import { z } from 'zod';");
    lines.push('');
  }

  // Schema name
  const schemaName = opts.schemaName
    ? normalizeSchemaName(opts.schemaName)
    : 'GeneratedSchema';

  // Schema code generation
  const schemaCode = generateSchemaCode(schema, opts, collector, 0);

  // Export flag
  const exportPrefix = opts.exportSchema ? 'export ' : '';
  lines.push(`${exportPrefix}const ${schemaName} = ${schemaCode};`);

  // Generate type inference
  if (opts.generateTypeInference) {
    lines.push('');
    const typeName = schemaName.replace(/Schema$/, '') || schemaName;
    lines.push(`${exportPrefix}type ${typeName} = z.infer<typeof ${schemaName}>;`);
  }

  return lines.join('\n');
}

/**
 * Schema code generation (recursive)
 */
function generateSchemaCode(
  schema: Schema,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
  depth: number,
): string {
  const indent = options.indent.repeat(depth);
  const innerIndent = options.indent.repeat(depth + 1);

  // $ref processing
  if (schema.$ref) {
    const refName = getSchemaNameFromRef(schema.$ref);
    // Use the name if the referenced schema is in definitions
    return normalizeSchemaName(refName);
  }

  // allOf processing
  if (schema.allOf && schema.allOf.length > 0) {
    const schemas = schema.allOf.map((s) => generateSchemaCode(s, options, collector, depth));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return schemas.reduce((acc, s) => `${acc}.and(${s})`);
  }

  // oneOf processing
  if (schema.oneOf && schema.oneOf.length > 0) {
    const schemas = schema.oneOf.map((s) => generateSchemaCode(s, options, collector, depth));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return `z.union([${schemas.join(', ')}])`;
  }

  // anyOf processing
  if (schema.anyOf && schema.anyOf.length > 0) {
    const schemas = schema.anyOf.map((s) => generateSchemaCode(s, options, collector, depth));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return `z.union([${schemas.join(', ')}])`;
  }

  // enum processing
  if (schema.enum && schema.enum.length > 0) {
    const values = enumToLiterals(schema.enum);
    if (values.length === 1) {
      return `z.literal(${values[0]})`;
    }
    return `z.enum([${values.join(', ')}])`;
  }

  // Type-specific processing
  switch (schema.type) {
    case 'string':
      return generateStringCode(schema, collector);

    case 'number':
    case 'integer':
      return generateNumberCode(schema);

    case 'boolean':
      return 'z.boolean()';

    case 'null':
      return 'z.null()';

    case 'array':
      return generateArrayCode(schema, options, collector, depth);

    case 'object':
      return generateObjectCode(schema, options, collector, depth, indent, innerIndent);

    default:
      if (!schema.type) {
        return 'z.any()';
      }
      collector.add('unsupported-type', `Unsupported type: ${schema.type}`);
      return 'z.any()';
  }
}

/**
 * string Code generation
 */
function generateStringCode(schema: Schema, collector: WarningCollector): string {
  let code = 'z.string()';

  // format processing
  if (schema.format) {
    switch (schema.format) {
      case 'email':
        code += '.email()';
        break;
      case 'uri':
      case 'url':
        code += '.url()';
        break;
      case 'uuid':
        code += '.uuid()';
        break;
      case 'date-time':
      case 'date':
        code += '.datetime()';
        break;
      default:
        collector.add(
          'unsupported-format',
          `Zod does not directly support '${schema.format}' format.`,
        );
    }
  }

  // Length constraints
  if (schema.minLength !== undefined) {
    code += `.min(${schema.minLength})`;
  }
  if (schema.maxLength !== undefined) {
    code += `.max(${schema.maxLength})`;
  }

  // pattern processing
  if (schema.pattern) {
    const escapedPattern = escapeRegexPattern(schema.pattern);
    code += `.regex(/${escapedPattern}/)`;
  }

  return code;
}

/**
 * number Code generation
 */
function generateNumberCode(schema: Schema): string {
  let code = 'z.number()';

  // integer processing
  if (schema.type === 'integer') {
    code += '.int()';
  }

  // minimum/maximum constraints
  if (schema.minimum !== undefined) {
    code += `.gte(${schema.minimum})`;
  }
  if (schema.maximum !== undefined) {
    code += `.lte(${schema.maximum})`;
  }
  if (schema.exclusiveMinimum !== undefined) {
    code += `.gt(${schema.exclusiveMinimum})`;
  }
  if (schema.exclusiveMaximum !== undefined) {
    code += `.lt(${schema.exclusiveMaximum})`;
  }

  // multipleOf processing
  if (schema.multipleOf !== undefined) {
    code += `.multipleOf(${schema.multipleOf})`;
  }

  return code;
}

/**
 * array Code generation
 */
function generateArrayCode(
  schema: Schema,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
  depth: number,
): string {
  const itemCode = schema.items
    ? generateSchemaCode(schema.items, options, collector, depth)
    : 'z.any()';

  let code = `z.array(${itemCode})`;

  if (schema.minItems !== undefined) {
    code += `.min(${schema.minItems})`;
  }
  if (schema.maxItems !== undefined) {
    code += `.max(${schema.maxItems})`;
  }

  return code;
}

/**
 * object Code generation
 */
function generateObjectCode(
  schema: Schema,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
  depth: number,
  indent: string,
  innerIndent: string,
): string {
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    let code = 'z.object({})';
    if (options.additionalProperties) {
      code += '.passthrough()';
    }
    return code;
  }

  const requiredFields = new Set(schema.required || []);
  const propLines: string[] = [];

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    let propCode = generateSchemaCode(propSchema, options, collector, depth + 1);

    // nullable processing
    if (propSchema.nullable) {
      switch (options.nullable) {
        case 'optional':
          propCode += '.optional()';
          break;
        case 'nullish':
          propCode += '.nullish()';
          break;
        case 'null':
        default:
          propCode += '.nullable()';
      }
    }

    // optional processing
    const isRequired = options.defaultRequired || requiredFields.has(key);
    if (!isRequired && !propSchema.nullable) {
      propCode += '.optional()';
    }

    // default processing
    if (propSchema.default !== undefined) {
      const defaultValue =
        typeof propSchema.default === 'string'
          ? `'${escapeString(propSchema.default)}'`
          : JSON.stringify(propSchema.default);
      propCode += `.default(${defaultValue})`;
    }

    propLines.push(`${innerIndent}${key}: ${propCode},`);
  }

  let code = `z.object({\n${propLines.join('\n')}\n${indent}})`;

  // additionalProperties processing
  if (options.additionalProperties) {
    code += '.passthrough()';
  } else if (options.strict) {
    code += '.strict()';
  }

  return code;
}
