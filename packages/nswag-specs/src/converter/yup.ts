/**
 * Yup schema converter
 * Bidirectional conversion between OpenAPI JSON Schema and Yup schemas
 *
 * @example
 * ```typescript
 * import { openApiToYup, generateYupCode } from '@aspect/nswag-specs/converter';
 *
 * // Runtime schema generation
 * const result = await openApiToYup({
 *   type: 'object',
 *   properties: {
 *     id: { type: 'integer' },
 *     email: { type: 'string', format: 'email' },
 *   },
 *   required: ['id', 'email'],
 * });
 *
 * // Validation
 * const isValid = await result.schema.isValid(data);
 *
 * // Code generation
 * const code = generateYupCode(schema, { schemaName: 'userSchema' });
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
 * Yup type interface (internal use)
 */
interface YupType {
  required: (message?: string) => YupType;
  optional: () => YupType;
  nullable: () => YupType;
  notRequired: () => YupType;
  defined: () => YupType;
  default: (value: unknown) => YupType;
  min: (value: number, message?: string) => YupType;
  max: (value: number, message?: string) => YupType;
  length: (value: number, message?: string) => YupType;
  email: (message?: string) => YupType;
  url: (message?: string) => YupType;
  uuid: (message?: string) => YupType;
  matches: (pattern: RegExp, message?: string) => YupType;
  integer: (message?: string) => YupType;
  positive: (message?: string) => YupType;
  negative: (message?: string) => YupType;
  moreThan: (value: number, message?: string) => YupType;
  lessThan: (value: number, message?: string) => YupType;
  oneOf: (values: unknown[], message?: string) => YupType;
  of: (schema: YupType) => YupType;
  shape: (shape: Record<string, YupType>) => YupType;
  noUnknown: (onlyKnown?: boolean, message?: string) => YupType;
  strict: (isStrict?: boolean) => YupType;
  validate: (data: unknown) => Promise<unknown>;
  validateSync: (data: unknown) => unknown;
  isValid: (data: unknown) => Promise<boolean>;
  isValidSync: (data: unknown) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  describe: () => any;
}

/**
 * Yup namespace type
 */
interface YupNamespace {
  string: () => YupType;
  number: () => YupType;
  boolean: () => YupType;
  date: () => YupType;
  array: (schema?: YupType) => YupType;
  object: (shape?: Record<string, YupType>) => YupType;
  mixed: () => YupType;
  lazy: (fn: (value: unknown) => YupType) => YupType;
}

/**
 * Yup Dynamically load instance
 *
 * @returns Yup module
 * @throws Error if Yup is not installed
 */
async function loadYup(): Promise<YupNamespace> {
  try {
    const yupModule = await import('yup');
    return yupModule as unknown as YupNamespace;
  } catch {
    throw new Error(
      'The yup package is not installed. Please run npm install yup.',
    );
  }
}

/**
 * Convert OpenAPI schema to Yup schema (async)
 *
 * @param schema - OpenAPI schema
 * @param options - Conversion options
 * @returns Conversion result (schema and warnings)
 *
 * @example
 * ```typescript
 * const result = await openApiToYup({
 *   type: 'object',
 *   properties: {
 *     id: { type: 'integer' },
 *     email: { type: 'string', format: 'email' },
 *   },
 *   required: ['id', 'email'],
 * });
 *
 * const isValid = await result.schema.isValid({ id: 1, email: 'test@example.com' });
 * ```
 */
export async function openApiToYup(
  schema: Schema,
  options: ConvertOptions = {},
): Promise<ConvertResult<YupType>> {
  const yup = await loadYup();
  const collector = new WarningCollector();
  const opts = getDefaultOptions(options);

  const yupSchema = convertSchemaToYup(schema, yup, opts, collector);
  const code = generateYupCode(schema, options);

  return {
    schema: yupSchema,
    code,
    warnings: collector.getWarnings(),
  };
}

/**
 * Convert OpenAPI schema to Yup schema (sync, instance required)
 *
 * @param schema - OpenAPI schema
 * @param yup - Yup namespace
 * @param options - Conversion options
 * @param collector - Warning collector
 * @returns Yup schema
 */
function convertSchemaToYup(
  schema: Schema,
  yup: YupNamespace,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): YupType {
  // $ref processing
  if (schema.$ref) {
    const resolved = tryResolveRef(schema.$ref, options.rootSpec, collector);
    if (Object.keys(resolved).length === 0) {
      return yup.mixed();
    }
    return convertSchemaToYup(resolved, yup, options, collector);
  }

  // allOf processing
  if (schema.allOf) {
    const processed = processCompositeSchema(schema, options, collector);
    return convertSchemaToYup(processed, yup, options, collector);
  }

  // oneOf/anyOf processing (in Yup, converted to mixed().oneOf())
  if (schema.oneOf || schema.anyOf) {
    collector.add(
      'complex-composition',
      'oneOf/anyOf has limited support in Yup. Converting to mixed() type.',
    );
    return yup.mixed();
  }

  // enum processing
  if (schema.enum && schema.enum.length > 0) {
    const baseSchema = getBaseSchemaForEnum(schema, yup);
    return baseSchema.oneOf(schema.enum);
  }

  // Type-specific processing
  switch (schema.type) {
    case 'string':
      return convertStringSchema(schema, yup, collector);

    case 'number':
    case 'integer':
      return convertNumberSchema(schema, yup, collector);

    case 'boolean':
      return yup.boolean();

    case 'null':
      return yup.mixed().nullable();

    case 'array':
      return convertArraySchema(schema, yup, options, collector);

    case 'object':
      return convertObjectSchema(schema, yup, options, collector);

    default:
      if (!schema.type) {
        collector.add('unsupported-type', 'Schema has no type specified. Converting to mixed.');
        return yup.mixed();
      }
      collector.add('unsupported-type', `Unsupported type: ${schema.type}`);
      return yup.mixed();
  }
}

/**
 * Determine base schema type for enum
 */
function getBaseSchemaForEnum(schema: Schema, yup: YupNamespace): YupType {
  if (schema.enum && schema.enum.length > 0) {
    const firstValue = schema.enum[0];
    if (typeof firstValue === 'string') {
      return yup.string();
    }
    if (typeof firstValue === 'number') {
      return yup.number();
    }
  }
  return yup.mixed();
}

/**
 * string Schema conversion
 */
function convertStringSchema(
  schema: Schema,
  yup: YupNamespace,
  collector: WarningCollector,
): YupType {
  let result = yup.string();

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
        // Yup's date() expects Date object, not string
        // Use matches if you need string validation
        collector.add(
          'unsupported-format',
          'date/date-time format is processed as Date object in Yup. Use matches() if string validation is needed.',
        );
        break;
      case 'ipv4':
        result = result.matches(
          /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
        );
        break;
      case 'ipv6':
        result = result.matches(/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/);
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
      result = result.matches(new RegExp(schema.pattern));
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
  yup: YupNamespace,
  collector: WarningCollector,
): YupType {
  let result = yup.number();

  // integer processing
  if (schema.type === 'integer') {
    result = result.integer();
  }

  // minimum/maximum constraints
  if (schema.minimum !== undefined) {
    result = result.min(schema.minimum);
  }
  if (schema.maximum !== undefined) {
    result = result.max(schema.maximum);
  }
  if (schema.exclusiveMinimum !== undefined) {
    result = result.moreThan(schema.exclusiveMinimum);
  }
  if (schema.exclusiveMaximum !== undefined) {
    result = result.lessThan(schema.exclusiveMaximum);
  }

  // multipleOf processing - Not directly supported by Yup
  if (schema.multipleOf !== undefined) {
    collector.add(
      'unsupported-constraint',
      'multipleOf is not directly supported by Yup. Use test() for manual validation.',
    );
  }

  return result;
}

/**
 * array Schema conversion
 */
function convertArraySchema(
  schema: Schema,
  yup: YupNamespace,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): YupType {
  // items schema
  const itemSchema = schema.items
    ? convertSchemaToYup(schema.items, yup, options, collector)
    : yup.mixed();

  let result = yup.array(itemSchema);

  // Array length constraints
  if (schema.minItems !== undefined) {
    result = result.min(schema.minItems);
  }
  if (schema.maxItems !== undefined) {
    result = result.max(schema.maxItems);
  }

  // uniqueItems is not directly supported by Yup
  if (schema.uniqueItems) {
    collector.add(
      'unsupported-constraint',
      'uniqueItems is not directly supported by Yup. Use test() for manual validation.',
    );
  }

  return result;
}

/**
 * object Schema conversion
 */
function convertObjectSchema(
  schema: Schema,
  yup: YupNamespace,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): YupType {
  const shape: Record<string, YupType> = {};
  const requiredFields = new Set(schema.required || []);

  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      let fieldSchema = convertSchemaToYup(propSchema, yup, options, collector);

      // nullable processing
      if (propSchema.nullable) {
        fieldSchema = fieldSchema.nullable();
      }

      // required processing
      const isRequired = options.defaultRequired || requiredFields.has(key);
      if (isRequired) {
        fieldSchema = fieldSchema.required();
      } else {
        fieldSchema = fieldSchema.notRequired();
      }

      // default processing
      if (propSchema.default !== undefined) {
        fieldSchema = fieldSchema.default(propSchema.default);
      }

      shape[key] = fieldSchema;
    }
  }

  let result = yup.object(shape);

  // additionalProperties processing
  if (!options.additionalProperties) {
    result = result.noUnknown(true);
  }

  if (options.strict) {
    result = result.strict(true);
  }

  return result;
}

/**
 * Convert Yup schema to OpenAPI schema
 * (Same functionality as yupToOpenApi in adapters/yup.ts - re-export)
 *
 * @param yupSchema - Yup schema
 * @returns OpenAPI schema
 */
export { yupToOpenApi } from '../adapters/yup.js';

/**
 * Generate TypeScript code from OpenAPI schema
 *
 * @param schema - OpenAPI schema
 * @param options - Conversion options
 * @returns Generated TypeScript code
 *
 * @example
 * ```typescript
 * const code = generateYupCode(
 *   {
 *     type: 'object',
 *     properties: {
 *       id: { type: 'integer' },
 *       email: { type: 'string', format: 'email' },
 *     },
 *     required: ['id', 'email'],
 *   },
 *   { schemaName: 'userSchema', includeImports: true }
 * );
 *
 * // Output:
 * // import * as yup from 'yup';
 * //
 * // export const userSchema = yup.object({
 * //   id: yup.number().integer().required(),
 * //   email: yup.string().email().required(),
 * // });
 * ```
 */
export function generateYupCode(schema: Schema, options: ConvertOptions = {}): string {
  const opts = getDefaultOptions(options);
  const collector = new WarningCollector();
  const lines: string[] = [];

  // Generate import statement
  if (opts.includeImports) {
    lines.push("import * as yup from 'yup';");
    lines.push('');
  }

  // Schema name (Yup uses camelCase convention)
  const schemaName = opts.schemaName
    ? opts.schemaName.charAt(0).toLowerCase() + opts.schemaName.slice(1)
    : 'generatedSchema';

  // Schema code generation
  const schemaCode = generateSchemaCode(schema, opts, collector, 0);

  // Export flag
  const exportPrefix = opts.exportSchema ? 'export ' : '';
  lines.push(`${exportPrefix}const ${schemaName} = ${schemaCode};`);

  // Generate type inference
  if (opts.generateTypeInference) {
    lines.push('');
    const typeName = normalizeSchemaName(schemaName.replace(/Schema$/i, '')) || 'Generated';
    lines.push(`${exportPrefix}type ${typeName} = yup.InferType<typeof ${schemaName}>;`);
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
    return refName.charAt(0).toLowerCase() + refName.slice(1);
  }

  // allOf processing
  if (schema.allOf && schema.allOf.length > 0) {
    collector.add('complex-composition', 'allOf is converted to a merged object.');
    const processed = processCompositeSchema(schema, options, collector);
    return generateSchemaCode(processed, options, collector, depth);
  }

  // oneOf/anyOf processing
  if (schema.oneOf || schema.anyOf) {
    collector.add('complex-composition', 'oneOf/anyOf has limited support in Yup.');
    return 'yup.mixed()';
  }

  // enum processing
  if (schema.enum && schema.enum.length > 0) {
    const values = enumToLiterals(schema.enum);
    const baseType = typeof schema.enum[0] === 'string' ? 'yup.string()' : 'yup.number()';
    return `${baseType}.oneOf([${values.join(', ')}])`;
  }

  // Type-specific processing
  switch (schema.type) {
    case 'string':
      return generateStringCode(schema, collector);

    case 'number':
    case 'integer':
      return generateNumberCode(schema, collector);

    case 'boolean':
      return 'yup.boolean()';

    case 'null':
      return 'yup.mixed().nullable()';

    case 'array':
      return generateArrayCode(schema, options, collector, depth);

    case 'object':
      return generateObjectCode(schema, options, collector, depth, indent, innerIndent);

    default:
      if (!schema.type) {
        return 'yup.mixed()';
      }
      collector.add('unsupported-type', `Unsupported type: ${schema.type}`);
      return 'yup.mixed()';
  }
}

/**
 * string Code generation
 */
function generateStringCode(schema: Schema, collector: WarningCollector): string {
  let code = 'yup.string()';

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
      case 'ipv4':
        code +=
          '.matches(/^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/)';
        break;
      case 'ipv6':
        code += '.matches(/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/)';
        break;
      default:
        collector.add(
          'unsupported-format',
          `Yup does not directly support '${schema.format}' format.`,
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
    code += `.matches(/${escapedPattern}/)`;
  }

  return code;
}

/**
 * number Code generation
 */
function generateNumberCode(schema: Schema, collector: WarningCollector): string {
  let code = 'yup.number()';

  // integer processing
  if (schema.type === 'integer') {
    code += '.integer()';
  }

  // minimum/maximum constraints
  if (schema.minimum !== undefined) {
    code += `.min(${schema.minimum})`;
  }
  if (schema.maximum !== undefined) {
    code += `.max(${schema.maximum})`;
  }
  if (schema.exclusiveMinimum !== undefined) {
    code += `.moreThan(${schema.exclusiveMinimum})`;
  }
  if (schema.exclusiveMaximum !== undefined) {
    code += `.lessThan(${schema.exclusiveMaximum})`;
  }

  // multipleOf processing
  if (schema.multipleOf !== undefined) {
    collector.add(
      'unsupported-constraint',
      `multipleOf(${schema.multipleOf}) is not directly supported by Yup.`,
    );
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
    : 'yup.mixed()';

  let code = `yup.array().of(${itemCode})`;

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
    let code = 'yup.object()';
    if (!options.additionalProperties) {
      code += '.noUnknown()';
    }
    return code;
  }

  const requiredFields = new Set(schema.required || []);
  const propLines: string[] = [];

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    let propCode = generateSchemaCode(propSchema, options, collector, depth + 1);

    // nullable processing
    if (propSchema.nullable) {
      propCode += '.nullable()';
    }

    // required processing
    const isRequired = options.defaultRequired || requiredFields.has(key);
    if (isRequired) {
      propCode += '.required()';
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

  let code = `yup.object({\n${propLines.join('\n')}\n${indent}})`;

  // additionalProperties processing
  if (!options.additionalProperties) {
    code += '.noUnknown()';
  }

  if (options.strict) {
    code += '.strict()';
  }

  return code;
}
