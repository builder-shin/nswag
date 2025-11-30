/**
 * TypeBox schema converter
 * Bidirectional conversion between OpenAPI JSON Schema and TypeBox schemas
 *
 * @example
 * ```typescript
 * import { openApiToTypeBox, generateTypeBoxCode } from '@builder-shin/nswag-specs/converter';
 * import { Value } from '@sinclair/typebox/value';
 *
 * // Runtime schema generation
 * const result = await openApiToTypeBox({
 *   type: 'object',
 *   properties: {
 *     id: { type: 'integer' },
 *     email: { type: 'string', format: 'email' },
 *   },
 *   required: ['id', 'email'],
 * });
 *
 * // Validation
 * const isValid = Value.Check(result.schema, data);
 *
 * // Code generation
 * const code = generateTypeBoxCode(schema, { schemaName: 'UserSchema' });
 * ```
 */

import type { Schema } from '../types/index.js';
import type { ConvertOptions, ConvertResult } from './types.js';
import {
  WarningCollector,
  tryResolveRef,
  getDefaultOptions,
  escapeRegexPattern,
  enumToLiterals,
  getSchemaNameFromRef,
  normalizeSchemaName,
} from './utils.js';

/**
 * TypeBox type interface (internal use)
 */
interface TSchema {
  [kind: symbol]: string;
  type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * TypeBox Type builder interface
 */
interface TypeBuilder {
  String: (options?: Record<string, unknown>) => TSchema;
  Number: (options?: Record<string, unknown>) => TSchema;
  Integer: (options?: Record<string, unknown>) => TSchema;
  Boolean: (options?: Record<string, unknown>) => TSchema;
  Null: (options?: Record<string, unknown>) => TSchema;
  Array: (items: TSchema, options?: Record<string, unknown>) => TSchema;
  Object: (properties: Record<string, TSchema>, options?: Record<string, unknown>) => TSchema;
  Union: (schemas: TSchema[], options?: Record<string, unknown>) => TSchema;
  Intersect: (schemas: TSchema[], options?: Record<string, unknown>) => TSchema;
  Literal: (value: unknown, options?: Record<string, unknown>) => TSchema;
  Enum: (enumType: Record<string, string | number>, options?: Record<string, unknown>) => TSchema;
  Optional: (schema: TSchema) => TSchema;
  Any: (options?: Record<string, unknown>) => TSchema;
  Unknown: (options?: Record<string, unknown>) => TSchema;
  Record: (key: TSchema, value: TSchema, options?: Record<string, unknown>) => TSchema;
}

/**
 * TypeBox Dynamically load instance
 *
 * @returns TypeBox Type builder
 * @throws TypeBoxError if not installed
 */
async function loadTypeBox(): Promise<TypeBuilder> {
  try {
    const typeboxModule = await import('@sinclair/typebox');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (typeboxModule as any).Type as TypeBuilder;
  } catch {
    throw new Error(
      'The @sinclair/typebox package is not installed. Please run npm install @sinclair/typebox.',
    );
  }
}

/**
 * Convert OpenAPI schema to TypeBox schema (async)
 *
 * @param schema - OpenAPI schema
 * @param options - Conversion options
 * @returns Conversion result (schema and warnings)
 *
 * @example
 * ```typescript
 * import { Value } from '@sinclair/typebox/value';
 *
 * const result = await openApiToTypeBox({
 *   type: 'object',
 *   properties: {
 *     id: { type: 'integer' },
 *     email: { type: 'string', format: 'email' },
 *   },
 *   required: ['id', 'email'],
 * });
 *
 * const isValid = Value.Check(result.schema, { id: 1, email: 'test@example.com' });
 * ```
 */
export async function openApiToTypeBox(
  schema: Schema,
  options: ConvertOptions = {},
): Promise<ConvertResult<TSchema>> {
  const Type = await loadTypeBox();
  const collector = new WarningCollector();
  const opts = getDefaultOptions(options);

  const typeboxSchema = convertSchemaToTypeBox(schema, Type, opts, collector);
  const code = generateTypeBoxCode(schema, options);

  return {
    schema: typeboxSchema,
    code,
    warnings: collector.getWarnings(),
  };
}

/**
 * Convert OpenAPI schema to TypeBox schema (sync, Type builder required)
 *
 * @param schema - OpenAPI schema
 * @param Type - TypeBox Type builder
 * @param options - Conversion options
 * @param collector - Warning collector
 * @returns TypeBox schema
 */
function convertSchemaToTypeBox(
  schema: Schema,
  Type: TypeBuilder,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): TSchema {
  // $ref processing
  if (schema.$ref) {
    const resolved = tryResolveRef(schema.$ref, options.rootSpec, collector);
    if (Object.keys(resolved).length === 0) {
      return Type.Any();
    }
    return convertSchemaToTypeBox(resolved, Type, options, collector);
  }

  // allOf processing
  if (schema.allOf && schema.allOf.length > 0) {
    const schemas = schema.allOf.map((s) => convertSchemaToTypeBox(s, Type, options, collector));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return Type.Intersect(schemas);
  }

  // oneOf processing
  if (schema.oneOf && schema.oneOf.length > 0) {
    const schemas = schema.oneOf.map((s) => convertSchemaToTypeBox(s, Type, options, collector));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return Type.Union(schemas);
  }

  // anyOf processing
  if (schema.anyOf && schema.anyOf.length > 0) {
    const schemas = schema.anyOf.map((s) => convertSchemaToTypeBox(s, Type, options, collector));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return Type.Union(schemas);
  }

  // enum processing
  if (schema.enum && schema.enum.length > 0) {
    if (schema.enum.length === 1) {
      return Type.Literal(schema.enum[0]);
    }
    const literals = schema.enum.map((v) => Type.Literal(v));
    return Type.Union(literals);
  }

  // Type-specific processing
  switch (schema.type) {
    case 'string':
      return convertStringSchema(schema, Type, collector);

    case 'number':
      return convertNumberSchema(schema, Type, collector);

    case 'integer':
      return convertIntegerSchema(schema, Type, collector);

    case 'boolean':
      return Type.Boolean();

    case 'null':
      return Type.Null();

    case 'array':
      return convertArraySchema(schema, Type, options, collector);

    case 'object':
      return convertObjectSchema(schema, Type, options, collector);

    default:
      if (!schema.type) {
        collector.add('unsupported-type', 'Schema has no type specified. Converting to Any.');
        return Type.Any();
      }
      collector.add('unsupported-type', `Unsupported type: ${schema.type}`);
      return Type.Any();
  }
}

/**
 * string Schema conversion
 */
function convertStringSchema(
  schema: Schema,
  Type: TypeBuilder,
  collector: WarningCollector,
): TSchema {
  const options: Record<string, unknown> = {};

  // format processing
  if (schema.format) {
    options.format = schema.format;

    // Warning for formats not supported by TypeBox
    const unsupportedFormats = ['hostname', 'byte', 'binary', 'password'];
    if (unsupportedFormats.includes(schema.format)) {
      collector.add(
        'unsupported-format',
        `TypeBox does not validate '${schema.format}' format. It will only be stored as metadata.`,
      );
    }
  }

  // Length constraints
  if (schema.minLength !== undefined) {
    options.minLength = schema.minLength;
  }
  if (schema.maxLength !== undefined) {
    options.maxLength = schema.maxLength;
  }

  // pattern processing
  if (schema.pattern) {
    options.pattern = schema.pattern;
  }

  return Type.String(Object.keys(options).length > 0 ? options : undefined);
}

/**
 * number Schema conversion
 */
function convertNumberSchema(
  schema: Schema,
  Type: TypeBuilder,
  _collector: WarningCollector,
): TSchema {
  const options: Record<string, unknown> = {};

  // minimum/maximum constraints
  if (schema.minimum !== undefined) {
    options.minimum = schema.minimum;
  }
  if (schema.maximum !== undefined) {
    options.maximum = schema.maximum;
  }
  if (schema.exclusiveMinimum !== undefined) {
    options.exclusiveMinimum = schema.exclusiveMinimum;
  }
  if (schema.exclusiveMaximum !== undefined) {
    options.exclusiveMaximum = schema.exclusiveMaximum;
  }

  // multipleOf processing
  if (schema.multipleOf !== undefined) {
    options.multipleOf = schema.multipleOf;
  }

  return Type.Number(Object.keys(options).length > 0 ? options : undefined);
}

/**
 * integer Schema conversion
 */
function convertIntegerSchema(
  schema: Schema,
  Type: TypeBuilder,
  _collector: WarningCollector,
): TSchema {
  const options: Record<string, unknown> = {};

  // minimum/maximum constraints
  if (schema.minimum !== undefined) {
    options.minimum = schema.minimum;
  }
  if (schema.maximum !== undefined) {
    options.maximum = schema.maximum;
  }
  if (schema.exclusiveMinimum !== undefined) {
    options.exclusiveMinimum = schema.exclusiveMinimum;
  }
  if (schema.exclusiveMaximum !== undefined) {
    options.exclusiveMaximum = schema.exclusiveMaximum;
  }

  // multipleOf processing
  if (schema.multipleOf !== undefined) {
    options.multipleOf = schema.multipleOf;
  }

  return Type.Integer(Object.keys(options).length > 0 ? options : undefined);
}

/**
 * array Schema conversion
 */
function convertArraySchema(
  schema: Schema,
  Type: TypeBuilder,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): TSchema {
  // items schema
  const itemSchema = schema.items
    ? convertSchemaToTypeBox(schema.items, Type, options, collector)
    : Type.Any();

  const arrayOptions: Record<string, unknown> = {};

  // Array length constraints
  if (schema.minItems !== undefined) {
    arrayOptions.minItems = schema.minItems;
  }
  if (schema.maxItems !== undefined) {
    arrayOptions.maxItems = schema.maxItems;
  }

  // uniqueItems
  if (schema.uniqueItems) {
    arrayOptions.uniqueItems = true;
  }

  return Type.Array(
    itemSchema,
    Object.keys(arrayOptions).length > 0 ? arrayOptions : undefined,
  );
}

/**
 * object Schema conversion
 */
function convertObjectSchema(
  schema: Schema,
  Type: TypeBuilder,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): TSchema {
  const properties: Record<string, TSchema> = {};
  const requiredFields = new Set(schema.required || []);

  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      let fieldSchema = convertSchemaToTypeBox(propSchema, Type, options, collector);

      // optional processing
      const isRequired = options.defaultRequired || requiredFields.has(key);
      if (!isRequired) {
        fieldSchema = Type.Optional(fieldSchema);
      }

      properties[key] = fieldSchema;
    }
  }

  const objectOptions: Record<string, unknown> = {};

  // additionalProperties processing
  if (schema.additionalProperties === false || !options.additionalProperties) {
    objectOptions.additionalProperties = false;
  } else if (typeof schema.additionalProperties === 'object') {
    objectOptions.additionalProperties = convertSchemaToTypeBox(
      schema.additionalProperties,
      Type,
      options,
      collector,
    );
  }

  return Type.Object(
    properties,
    Object.keys(objectOptions).length > 0 ? objectOptions : undefined,
  );
}

/**
 * Convert TypeBox schema to OpenAPI schema
 * (Same functionality as typeboxToOpenApi in adapters/typebox.ts - re-export)
 *
 * @param typeboxSchema - TypeBox schema
 * @returns OpenAPI schema
 */
export { typeboxToOpenApi } from '../adapters/typebox.js';

/**
 * Generate TypeScript code from OpenAPI schema
 *
 * @param schema - OpenAPI schema
 * @param options - Conversion options
 * @returns Generated TypeScript code
 *
 * @example
 * ```typescript
 * const code = generateTypeBoxCode(
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
 * // import { Type, Static } from '@sinclair/typebox';
 * //
 * // export const UserSchema = Type.Object({
 * //   id: Type.Integer(),
 * //   email: Type.String({ format: 'email' }),
 * // });
 * //
 * // export type User = Static<typeof UserSchema>;
 * ```
 */
export function generateTypeBoxCode(schema: Schema, options: ConvertOptions = {}): string {
  const opts = getDefaultOptions(options);
  const collector = new WarningCollector();
  const lines: string[] = [];

  // Generate import statement
  if (opts.includeImports) {
    lines.push("import { Type, Static } from '@sinclair/typebox';");
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
    lines.push(`${exportPrefix}type ${typeName} = Static<typeof ${schemaName}>;`);
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
    return normalizeSchemaName(refName);
  }

  // allOf processing
  if (schema.allOf && schema.allOf.length > 0) {
    const schemas = schema.allOf.map((s) => generateSchemaCode(s, options, collector, depth));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return `Type.Intersect([${schemas.join(', ')}])`;
  }

  // oneOf processing
  if (schema.oneOf && schema.oneOf.length > 0) {
    const schemas = schema.oneOf.map((s) => generateSchemaCode(s, options, collector, depth));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return `Type.Union([${schemas.join(', ')}])`;
  }

  // anyOf processing
  if (schema.anyOf && schema.anyOf.length > 0) {
    const schemas = schema.anyOf.map((s) => generateSchemaCode(s, options, collector, depth));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return `Type.Union([${schemas.join(', ')}])`;
  }

  // enum processing
  if (schema.enum && schema.enum.length > 0) {
    const values = enumToLiterals(schema.enum);
    if (values.length === 1) {
      return `Type.Literal(${values[0]})`;
    }
    const literals = values.map((v) => `Type.Literal(${v})`);
    return `Type.Union([${literals.join(', ')}])`;
  }

  // Type-specific processing
  switch (schema.type) {
    case 'string':
      return generateStringCode(schema, collector);

    case 'number':
      return generateNumberCode(schema);

    case 'integer':
      return generateIntegerCode(schema);

    case 'boolean':
      return 'Type.Boolean()';

    case 'null':
      return 'Type.Null()';

    case 'array':
      return generateArrayCode(schema, options, collector, depth);

    case 'object':
      return generateObjectCode(schema, options, collector, depth, indent, innerIndent);

    default:
      if (!schema.type) {
        return 'Type.Any()';
      }
      collector.add('unsupported-type', `Unsupported type: ${schema.type}`);
      return 'Type.Any()';
  }
}

/**
 * string Code generation
 */
function generateStringCode(schema: Schema, _collector: WarningCollector): string {
  const options: string[] = [];

  // format processing
  if (schema.format) {
    options.push(`format: '${schema.format}'`);
  }

  // Length constraints
  if (schema.minLength !== undefined) {
    options.push(`minLength: ${schema.minLength}`);
  }
  if (schema.maxLength !== undefined) {
    options.push(`maxLength: ${schema.maxLength}`);
  }

  // pattern processing
  if (schema.pattern) {
    const escapedPattern = escapeRegexPattern(schema.pattern);
    options.push(`pattern: '${escapedPattern}'`);
  }

  if (options.length > 0) {
    return `Type.String({ ${options.join(', ')} })`;
  }
  return 'Type.String()';
}

/**
 * number Code generation
 */
function generateNumberCode(schema: Schema): string {
  const options: string[] = [];

  // minimum/maximum constraints
  if (schema.minimum !== undefined) {
    options.push(`minimum: ${schema.minimum}`);
  }
  if (schema.maximum !== undefined) {
    options.push(`maximum: ${schema.maximum}`);
  }
  if (schema.exclusiveMinimum !== undefined) {
    options.push(`exclusiveMinimum: ${schema.exclusiveMinimum}`);
  }
  if (schema.exclusiveMaximum !== undefined) {
    options.push(`exclusiveMaximum: ${schema.exclusiveMaximum}`);
  }

  // multipleOf processing
  if (schema.multipleOf !== undefined) {
    options.push(`multipleOf: ${schema.multipleOf}`);
  }

  if (options.length > 0) {
    return `Type.Number({ ${options.join(', ')} })`;
  }
  return 'Type.Number()';
}

/**
 * integer Code generation
 */
function generateIntegerCode(schema: Schema): string {
  const options: string[] = [];

  // minimum/maximum constraints
  if (schema.minimum !== undefined) {
    options.push(`minimum: ${schema.minimum}`);
  }
  if (schema.maximum !== undefined) {
    options.push(`maximum: ${schema.maximum}`);
  }
  if (schema.exclusiveMinimum !== undefined) {
    options.push(`exclusiveMinimum: ${schema.exclusiveMinimum}`);
  }
  if (schema.exclusiveMaximum !== undefined) {
    options.push(`exclusiveMaximum: ${schema.exclusiveMaximum}`);
  }

  // multipleOf processing
  if (schema.multipleOf !== undefined) {
    options.push(`multipleOf: ${schema.multipleOf}`);
  }

  if (options.length > 0) {
    return `Type.Integer({ ${options.join(', ')} })`;
  }
  return 'Type.Integer()';
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
    : 'Type.Any()';

  const arrayOptions: string[] = [];

  if (schema.minItems !== undefined) {
    arrayOptions.push(`minItems: ${schema.minItems}`);
  }
  if (schema.maxItems !== undefined) {
    arrayOptions.push(`maxItems: ${schema.maxItems}`);
  }
  if (schema.uniqueItems) {
    arrayOptions.push('uniqueItems: true');
  }

  if (arrayOptions.length > 0) {
    return `Type.Array(${itemCode}, { ${arrayOptions.join(', ')} })`;
  }
  return `Type.Array(${itemCode})`;
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
    if (!options.additionalProperties) {
      return 'Type.Object({}, { additionalProperties: false })';
    }
    return 'Type.Object({})';
  }

  const requiredFields = new Set(schema.required || []);
  const propLines: string[] = [];

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    let propCode = generateSchemaCode(propSchema, options, collector, depth + 1);

    // optional processing
    const isRequired = options.defaultRequired || requiredFields.has(key);
    if (!isRequired) {
      propCode = `Type.Optional(${propCode})`;
    }

    propLines.push(`${innerIndent}${key}: ${propCode},`);
  }

  const objectOptions: string[] = [];
  if (!options.additionalProperties) {
    objectOptions.push('additionalProperties: false');
  }

  const optionsStr = objectOptions.length > 0 ? `, { ${objectOptions.join(', ')} }` : '';

  return `Type.Object({\n${propLines.join('\n')}\n${indent}}${optionsStr})`;
}
