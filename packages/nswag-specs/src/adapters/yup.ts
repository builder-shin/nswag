/**
 * Yup 어댑터
 * Yup 스키마를 OpenAPI 스키마로 변환
 *
 * 제한사항:
 * - yup.lazy(): 지연 스키마 미지원
 * - yup.ref(): 참조 미지원
 * - when() 조건부 스키마 미지원
 * - 커스텀 test() 미지원
 */

import type { Schema } from '../types/index.js';

/**
 * Yup 스키마 타입 (간소화된 인터페이스)
 */
export interface YupSchema {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields?: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  innerType?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tests?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _whitelist?: { list: Set<any> };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _blacklist?: { list: Set<any> };
}

/**
 * Yup 스키마를 OpenAPI 스키마로 변환
 *
 * @param yupSchema - 변환할 Yup 스키마
 * @returns OpenAPI 호환 스키마
 *
 * @example
 * ```typescript
 * import * as yup from 'yup';
 * import { yupToOpenApi } from '@aspect/nswag-specs/yup';
 *
 * const BlogSchema = yup.object({
 *   id: yup.number().integer().required(),
 *   title: yup.string().min(1).max(200).required(),
 *   content: yup.string().required(),
 * });
 *
 * const openApiSchema = yupToOpenApi(BlogSchema);
 * ```
 */
export function yupToOpenApi(yupSchema: YupSchema): Schema {
  const { type } = yupSchema;

  switch (type) {
    case 'string':
      return convertYupString(yupSchema);

    case 'number':
      return convertYupNumber(yupSchema);

    case 'boolean':
      return { type: 'boolean' };

    case 'date':
      return { type: 'string', format: 'date-time' };

    case 'array':
      return convertYupArray(yupSchema);

    case 'object':
      return convertYupObject(yupSchema);

    case 'mixed':
      return convertYupMixed(yupSchema);

    case 'tuple':
      return convertYupTuple(yupSchema);

    default:
      console.warn(`yupToOpenApi: Unknown type ${type}`);
      return {};
  }
}

/**
 * Yup String 변환
 */
function convertYupString(yupSchema: YupSchema): Schema {
  const schema: Schema = { type: 'string' };
  const tests = yupSchema.tests || [];

  // enum 값 처리 (oneOf)
  if (yupSchema._whitelist && yupSchema._whitelist.list.size > 0) {
    const values = Array.from(yupSchema._whitelist.list);
    if (!values.includes(undefined)) {
      schema.enum = values;
    }
  }

  // 테스트 검사에서 제약조건 추출
  for (const test of tests) {
    const { name, params } = test.OPTIONS || test;

    switch (name) {
      case 'min':
        if (params?.min !== undefined) {
          schema.minLength = params.min;
        }
        break;
      case 'max':
        if (params?.max !== undefined) {
          schema.maxLength = params.max;
        }
        break;
      case 'length':
        if (params?.length !== undefined) {
          schema.minLength = params.length;
          schema.maxLength = params.length;
        }
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
      case 'matches':
        if (params?.regex) {
          schema.pattern = params.regex.source;
        }
        break;
    }
  }

  // nullable 처리
  if (yupSchema.spec?.nullable) {
    schema.nullable = true;
  }

  // default 값 처리
  if (yupSchema.spec?.default !== undefined) {
    schema.default = yupSchema.spec.default;
  }

  return schema;
}

/**
 * Yup Number 변환
 */
function convertYupNumber(yupSchema: YupSchema): Schema {
  const schema: Schema = { type: 'number' };
  const tests = yupSchema.tests || [];

  for (const test of tests) {
    const { name, params } = test.OPTIONS || test;

    switch (name) {
      case 'integer':
        schema.type = 'integer';
        break;
      case 'min':
        if (params?.min !== undefined) {
          schema.minimum = params.min;
        }
        break;
      case 'max':
        if (params?.max !== undefined) {
          schema.maximum = params.max;
        }
        break;
      case 'positive':
        schema.exclusiveMinimum = 0;
        break;
      case 'negative':
        schema.exclusiveMaximum = 0;
        break;
      case 'moreThan':
        if (params?.more !== undefined) {
          schema.exclusiveMinimum = params.more;
        }
        break;
      case 'lessThan':
        if (params?.less !== undefined) {
          schema.exclusiveMaximum = params.less;
        }
        break;
    }
  }

  // nullable 처리
  if (yupSchema.spec?.nullable) {
    schema.nullable = true;
  }

  // default 값 처리
  if (yupSchema.spec?.default !== undefined) {
    schema.default = yupSchema.spec.default;
  }

  return schema;
}

/**
 * Yup Array 변환
 */
function convertYupArray(yupSchema: YupSchema): Schema {
  const schema: Schema = {
    type: 'array',
    items: yupSchema.innerType ? yupToOpenApi(yupSchema.innerType) : {},
  };

  const tests = yupSchema.tests || [];

  for (const test of tests) {
    const { name, params } = test.OPTIONS || test;

    switch (name) {
      case 'min':
        if (params?.min !== undefined) {
          schema.minItems = params.min;
        }
        break;
      case 'max':
        if (params?.max !== undefined) {
          schema.maxItems = params.max;
        }
        break;
      case 'length':
        if (params?.length !== undefined) {
          schema.minItems = params.length;
          schema.maxItems = params.length;
        }
        break;
    }
  }

  // nullable 처리
  if (yupSchema.spec?.nullable) {
    schema.nullable = true;
  }

  // default 값 처리
  if (yupSchema.spec?.default !== undefined) {
    schema.default = yupSchema.spec.default;
  }

  return schema;
}

/**
 * Yup Object 변환
 */
function convertYupObject(yupSchema: YupSchema): Schema {
  const { fields } = yupSchema;
  if (!fields) return { type: 'object' };

  const properties: Record<string, Schema> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(fields)) {
    const fieldSchema = value as YupSchema;
    properties[key] = yupToOpenApi(fieldSchema);

    // spec.optional이 false이거나 없으면 필수 필드
    if (!fieldSchema.spec?.optional && !fieldSchema.spec?.nullable) {
      // 명시적으로 required 테스트가 있는지 확인
      const hasRequired = (fieldSchema.tests || []).some(
        (t: { OPTIONS?: { name?: string }; name?: string }) =>
          (t.OPTIONS?.name || t.name) === 'required'
      );
      if (hasRequired || !fieldSchema.spec?.optional) {
        required.push(key);
      }
    }
  }

  const schema: Schema = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  // nullable 처리
  if (yupSchema.spec?.nullable) {
    schema.nullable = true;
  }

  // default 값 처리
  if (yupSchema.spec?.default !== undefined) {
    schema.default = yupSchema.spec.default;
  }

  return schema;
}

/**
 * Yup Mixed 변환
 */
function convertYupMixed(yupSchema: YupSchema): Schema {
  const schema: Schema = {};

  // oneOf 값 처리
  if (yupSchema._whitelist && yupSchema._whitelist.list.size > 0) {
    const values = Array.from(yupSchema._whitelist.list);
    if (!values.includes(undefined)) {
      schema.enum = values;
    }
  }

  // nullable 처리
  if (yupSchema.spec?.nullable) {
    schema.nullable = true;
  }

  // default 값 처리
  if (yupSchema.spec?.default !== undefined) {
    schema.default = yupSchema.spec.default;
  }

  return schema;
}

/**
 * Yup Tuple 변환
 */
function convertYupTuple(yupSchema: YupSchema): Schema {
  // Yup의 tuple은 spec.types에 타입 배열이 있음
  const types = (yupSchema.spec as { types?: YupSchema[] })?.types || [];

  return {
    type: 'array',
    items: {
      oneOf: types.map((t) => yupToOpenApi(t)),
    },
    minItems: types.length,
    maxItems: types.length,
  };
}
