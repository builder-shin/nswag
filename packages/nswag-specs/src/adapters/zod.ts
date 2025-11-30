/**
 * Zod 어댑터
 * Zod 스키마를 OpenAPI 스키마로 변환
 *
 * 제한사항:
 * - z.lazy(): 재귀 스키마 미지원
 * - z.function(): 함수 타입 미지원
 * - z.promise(): Promise 타입 미지원
 * - z.effect(): 변환 효과 미지원
 * - z.brand(): 브랜드 타입 미지원
 */

import type { Schema } from '../types/index.js';

/**
 * Zod 스키마 타입 (간소화된 인터페이스)
 */
export interface ZodSchema {
  _def: {
    typeName: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

/**
 * Zod 타입 이름 상수
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
 * Zod 스키마를 OpenAPI 스키마로 변환
 *
 * @param zodSchema - 변환할 Zod 스키마
 * @returns OpenAPI 호환 스키마
 *
 * @example
 * ```typescript
 * import { z } from 'zod';
 * import { zodToOpenApi } from '@aspect/nswag-specs/zod';
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

    // 미지원 타입들
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
 * Zod String 변환
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
 * Zod Number 변환
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
        // OpenAPI에서는 별도 표현 없음
        break;
    }
  }

  return schema;
}

/**
 * Zod Object 변환
 */
function convertZodObject(zodSchema: ZodSchema): Schema {
  const shape = zodSchema._def.shape?.();
  if (!shape) return { type: 'object' };

  const properties: Record<string, Schema> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const valueSchema = value as ZodSchema;
    properties[key] = zodToOpenApi(valueSchema);

    // ZodOptional, ZodDefault가 아니면 필수 필드
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

  // additionalProperties 처리
  if (zodSchema._def.catchall && zodSchema._def.catchall._def.typeName !== ZodTypeNames.Never) {
    schema.additionalProperties = zodToOpenApi(zodSchema._def.catchall);
  } else if (zodSchema._def.unknownKeys === 'strict') {
    schema.additionalProperties = false;
  }

  return schema;
}

/**
 * Zod Union 변환
 */
function convertZodUnion(zodSchema: ZodSchema): Schema {
  const options = zodSchema._def.options as ZodSchema[];
  return {
    oneOf: options.map((option) => zodToOpenApi(option)),
  };
}

/**
 * Zod Discriminated Union 변환
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
 * Zod Intersection 변환
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
 * Zod Tuple 변환
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
 * Zod Literal 변환
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
