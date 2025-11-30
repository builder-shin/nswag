/**
 * TypeBox 어댑터
 * TypeBox 스키마를 OpenAPI 스키마로 변환
 *
 * TypeBox는 이미 JSON Schema를 기반으로 하므로 대부분 그대로 사용 가능합니다.
 *
 * 제한사항:
 * - Type.Recursive(): 재귀 타입 미지원
 * - Type.This(): 자기 참조 타입 미지원
 * - Type.Unsafe(): 타입 안전하지 않은 타입 미지원
 * - Type.Transform(): 변환 타입 미지원
 */

import type { Schema } from '../types/index.js';

/**
 * TypeBox 스키마 타입 (간소화된 인터페이스)
 * TypeBox는 이미 JSON Schema 호환이므로 변환이 간단함
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
  // TypeBox 전용 속성
  $id?: string;
  kind?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * OpenAPI에서 제거해야 할 TypeBox 전용 속성들
 */
const TYPEBOX_ONLY_KEYS = ['$id', 'kind', '$static', 'transform', 'params'];

/**
 * TypeBox 스키마를 OpenAPI 스키마로 변환
 * TypeBox는 이미 JSON Schema를 기반으로 하므로 대부분 그대로 사용 가능
 *
 * @param typeboxSchema - 변환할 TypeBox 스키마
 * @returns OpenAPI 호환 스키마
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
  // TypeBox $id, kind 등 OpenAPI에서 불필요한 필드 제거
  const cleanedSchema = cleanTypeBoxSchema(typeboxSchema);

  // 재귀적으로 변환
  return convertSchema(cleanedSchema);
}

/**
 * TypeBox 전용 속성 제거
 */
function cleanTypeBoxSchema(schema: TypeBoxSchema): TypeBoxSchema {
  const cleaned: TypeBoxSchema = {};

  for (const [key, value] of Object.entries(schema)) {
    // TypeBox 전용 속성 건너뛰기
    if (TYPEBOX_ONLY_KEYS.includes(key)) {
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

/**
 * 스키마 변환
 */
function convertSchema(schema: TypeBoxSchema): Schema {
  const result: Schema = {};

  // 기본 타입
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

  // const (OpenAPI 3.1+에서 지원, 3.0에서는 enum으로 변환)
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

  // String 제약조건
  if (schema.minLength !== undefined) {
    result.minLength = schema.minLength;
  }
  if (schema.maxLength !== undefined) {
    result.maxLength = schema.maxLength;
  }
  if (schema.pattern) {
    result.pattern = schema.pattern;
  }

  // Number 제약조건
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

  // Array 제약조건
  if (schema.minItems !== undefined) {
    result.minItems = schema.minItems;
  }
  if (schema.maxItems !== undefined) {
    result.maxItems = schema.maxItems;
  }
  if (schema.uniqueItems !== undefined) {
    result.uniqueItems = schema.uniqueItems;
  }

  // Object 제약조건
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
      // Tuple: items가 배열인 경우
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

  // $ref 처리
  if (schema.$ref) {
    result.$ref = schema.$ref;
  }

  // 기타 메타데이터
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
 * TypeBox 스키마에서 참조($ref)를 해석
 *
 * @param schema - 해석할 스키마
 * @param definitions - 정의된 스키마들
 * @returns 해석된 스키마
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
