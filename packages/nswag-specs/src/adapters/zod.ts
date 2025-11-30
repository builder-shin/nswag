/**
 * Zod Adapter
 * Convert Zod schemas to OpenAPI schemas
 *
 * Limitations:
 * - z.lazy(): Recursive schemas not supported
 * - z.function(): Function types not supported
 * - z.promise(): Promise types not supported
 * - z.effect(): Transform effects not supported
 * - z.brand(): Brand types not supported
 */

import type { Schema } from '../types/index.js';

/**
 * Zod schema type (simplified interface)
 */
export interface ZodSchema {
  _def: {
    typeName: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

/**
 * Zod type name constants
 */
const ZodTypeNames = {
  String: 'ZodString',
  Number: 'ZodNumber',
  BigInt: 'ZodBigInt',
  Boolean: 'ZodBoolean',
  Date: 'ZodDate',
  Undefined: 'ZodUndefined',
  Null: 'ZodNull',
  Void: 'ZodVoid',
  Any: 'ZodAny',
  Unknown: 'ZodUnknown',
  Never: 'ZodNever',
  Array: 'ZodArray',
  Object: 'ZodObject',
  Union: 'ZodUnion',
  Discriminated: 'ZodDiscriminatedUnion',
  Intersection: 'ZodIntersection',
  Tuple: 'ZodTuple',
  Record: 'ZodRecord',
  Map: 'ZodMap',
  Set: 'ZodSet',
  Literal: 'ZodLiteral',
  Enum: 'ZodEnum',
  NativeEnum: 'ZodNativeEnum',
  Effects: 'ZodEffects',
  Optional: 'ZodOptional',
  Nullable: 'ZodNullable',
  Default: 'ZodDefault',
  Catch: 'ZodCatch',
  Promise: 'ZodPromise',
  Lazy: 'ZodLazy',
  Function: 'ZodFunction',
  Brand: 'ZodBranded',
  Pipeline: 'ZodPipeline',
} as const;

/**
 * Convert Zod schema to OpenAPI schema
 *
 * @param zodSchema - Zod schema to convert
 * @returns OpenAPI compatible schema
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { zodToOpenApi } from '@builder-shin/nswag-specs/zod';
 *
 * const BlogSchema = z.object({
 *   id: z.number().int(),
 *   title: z.string().min(1).max(200),
 *   content: z.string(),
 *   createdAt: z.string().datetime(),
 * });
 *
 * const openApiSchema = zodToOpenApi(BlogSchema);
 * ```
 */
export function zodToOpenApi(zodSchema: ZodSchema): Schema {
  const { typeName } = zodSchema._def;

  switch (typeName) {
    case ZodTypeNames.String:
      return convertZodString(zodSchema);

    case ZodTypeNames.Number:
      return convertZodNumber(zodSchema);

    case ZodTypeNames.BigInt:
      return { type: 'integer', format: 'int64' };

    case ZodTypeNames.Boolean:
      return { type: 'boolean' };

    case ZodTypeNames.Date:
      return { type: 'string', format: 'date-time' };

    case ZodTypeNames.Null:
      return { type: 'null' };

    case ZodTypeNames.Undefined:
    case ZodTypeNames.Void:
      return {};

    case ZodTypeNames.Any:
    case ZodTypeNames.Unknown:
      return {};

    case ZodTypeNames.Array:
      return {
        type: 'array',
        items: zodToOpenApi(zodSchema._def.type),
        ...(zodSchema._def.minLength !== undefined && { minItems: zodSchema._def.minLength.value }),
        ...(zodSchema._def.maxLength !== undefined && { maxItems: zodSchema._def.maxLength.value }),
      };

    case ZodTypeNames.Object:
      return convertZodObject(zodSchema);

    case ZodTypeNames.Union:
      return convertZodUnion(zodSchema);

    case ZodTypeNames.Discriminated:
      return convertZodDiscriminatedUnion(zodSchema);

    case ZodTypeNames.Intersection:
      return convertZodIntersection(zodSchema);

    case ZodTypeNames.Tuple:
      return convertZodTuple(zodSchema);

    case ZodTypeNames.Record:
      return {
        type: 'object',
        additionalProperties: zodToOpenApi(zodSchema._def.valueType),
      };

    case ZodTypeNames.Literal:
      return convertZodLiteral(zodSchema);

    case ZodTypeNames.Enum:
      return {
        type: 'string',
        enum: zodSchema._def.values,
      };

    case ZodTypeNames.NativeEnum:
      return {
        type: 'string',
        enum: Object.values(zodSchema._def.values),
      };

    case ZodTypeNames.Optional:
      return {
        ...zodToOpenApi(zodSchema._def.innerType),
      };

    case ZodTypeNames.Nullable:
      return {
        ...zodToOpenApi(zodSchema._def.innerType),
        nullable: true,
      };

    case ZodTypeNames.Default:
      return {
        ...zodToOpenApi(zodSchema._def.innerType),
        default: zodSchema._def.defaultValue(),
      };

    case ZodTypeNames.Catch:
      return zodToOpenApi(zodSchema._def.innerType);

    // Unsupported types
    case ZodTypeNames.Lazy:
      console.warn('zodToOpenApi: z.lazy() is not supported');
      return {};

    case ZodTypeNames.Function:
      console.warn('zodToOpenApi: z.function() is not supported');
      return {};

    case ZodTypeNames.Promise:
      console.warn('zodToOpenApi: z.promise() is not supported');
      return {};

    case ZodTypeNames.Effects:
      console.warn('zodToOpenApi: z.effect() is not supported');
      return zodToOpenApi(zodSchema._def.schema);

    case ZodTypeNames.Brand:
      console.warn('zodToOpenApi: z.brand() is not supported');
      return zodToOpenApi(zodSchema._def.type);

    case ZodTypeNames.Pipeline:
      return zodToOpenApi(zodSchema._def.out);

    default:
      console.warn(`zodToOpenApi: Unknown type ${typeName}`);
      return {};
  }
}

/**
 * Convert Zod String
 */
function convertZodString(zodSchema: ZodSchema): Schema {
  const schema: Schema = { type: 'string' };
  const checks = zodSchema._def.checks || [];

  for (const check of checks) {
    switch (check.kind) {
      case 'min':
        schema.minLength = check.value;
        break;
      case 'max':
        schema.maxLength = check.value;
        break;
      case 'length':
        schema.minLength = check.value;
        schema.maxLength = check.value;
        break;
      case 'email':
        schema.format = 'email';
        break;
      case 'url':
        schema.format = 'uri';
        break;
      case 'uuid':
        schema.format = 'uuid';
        break;
      case 'cuid':
      case 'cuid2':
        schema.format = 'cuid';
        break;
      case 'datetime':
        schema.format = 'date-time';
        break;
      case 'date':
        schema.format = 'date';
        break;
      case 'time':
        schema.format = 'time';
        break;
      case 'duration':
        schema.format = 'duration';
        break;
      case 'ip':
        schema.format = check.version === 'v4' ? 'ipv4' : check.version === 'v6' ? 'ipv6' : 'ip';
        break;
      case 'regex':
        schema.pattern = check.regex.source;
        break;
    }
  }

  return schema;
}

/**
 * Convert Zod Number
 */
function convertZodNumber(zodSchema: ZodSchema): Schema {
  const schema: Schema = { type: 'number' };
  const checks = zodSchema._def.checks || [];

  for (const check of checks) {
    switch (check.kind) {
      case 'int':
        schema.type = 'integer';
        break;
      case 'min':
        if (check.inclusive !== false) {
          schema.minimum = check.value;
        } else {
          schema.exclusiveMinimum = check.value;
        }
        break;
      case 'max':
        if (check.inclusive !== false) {
          schema.maximum = check.value;
        } else {
          schema.exclusiveMaximum = check.value;
        }
        break;
      case 'multipleOf':
        schema.multipleOf = check.value;
        break;
      case 'finite':
        // No separate representation in OpenAPI
        break;
    }
  }

  return schema;
}

/**
 * Convert Zod Object
 */
function convertZodObject(zodSchema: ZodSchema): Schema {
  const shape = zodSchema._def.shape?.();
  if (!shape) return { type: 'object' };

  const properties: Record<string, Schema> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const valueSchema = value as ZodSchema;
    properties[key] = zodToOpenApi(valueSchema);

    // Required field if not ZodOptional or ZodDefault
    const isOptional =
      valueSchema._def.typeName === ZodTypeNames.Optional ||
      valueSchema._def.typeName === ZodTypeNames.Default;

    if (!isOptional) {
      required.push(key);
    }
  }

  const schema: Schema = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  // Handle additionalProperties
  if (zodSchema._def.catchall && zodSchema._def.catchall._def.typeName !== ZodTypeNames.Never) {
    schema.additionalProperties = zodToOpenApi(zodSchema._def.catchall);
  } else if (zodSchema._def.unknownKeys === 'strict') {
    schema.additionalProperties = false;
  }

  return schema;
}

/**
 * Convert Zod Union
 */
function convertZodUnion(zodSchema: ZodSchema): Schema {
  const options = zodSchema._def.options as ZodSchema[];
  return {
    oneOf: options.map((option) => zodToOpenApi(option)),
  };
}

/**
 * Convert Zod Discriminated Union
 */
function convertZodDiscriminatedUnion(zodSchema: ZodSchema): Schema {
  const options = Array.from(zodSchema._def.optionsMap?.values() || []) as ZodSchema[];
  const discriminator = zodSchema._def.discriminator;

  return {
    oneOf: options.map((option) => zodToOpenApi(option)),
    discriminator: {
      propertyName: discriminator,
    },
  };
}

/**
 * Convert Zod Intersection
 */
function convertZodIntersection(zodSchema: ZodSchema): Schema {
  return {
    allOf: [
      zodToOpenApi(zodSchema._def.left),
      zodToOpenApi(zodSchema._def.right),
    ],
  };
}

/**
 * Convert Zod Tuple
 */
function convertZodTuple(zodSchema: ZodSchema): Schema {
  const items = zodSchema._def.items as ZodSchema[];
  return {
    type: 'array',
    items: {
      oneOf: items.map((item) => zodToOpenApi(item)),
    },
    minItems: items.length,
    maxItems: items.length,
  };
}

/**
 * Convert Zod Literal
 */
function convertZodLiteral(zodSchema: ZodSchema): Schema {
  const value = zodSchema._def.value;
  const type = typeof value;

  switch (type) {
    case 'string':
      return { type: 'string', enum: [value] };
    case 'number':
      return { type: 'number', enum: [value] };
    case 'boolean':
      return { type: 'boolean', enum: [value] };
    default:
      return { enum: [value] };
  }
}
