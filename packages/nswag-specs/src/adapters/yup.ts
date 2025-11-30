/**
 * Yup Adapter
 * Convert Yup schemas to OpenAPI schemas
 *
 * Limitations:
 * - yup.lazy(): Lazy schemas not supported
 * - yup.ref(): References not supported
 * - when() conditional schemas not supported
 * - Custom test() not supported
 */

import type { Schema } from '../types/index.js';

/**
 * Yup schema type (simplified interface)
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
 * Convert Yup schema to OpenAPI schema
 *
 * @param yupSchema - Yup schema to convert
 * @returns OpenAPI compatible schema
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
 * Convert Yup String
 */
function convertYupString(yupSchema: YupSchema): Schema {
  const schema: Schema = { type: 'string' };
  const tests = yupSchema.tests || [];

  // Handle enum values (oneOf)
  if (yupSchema._whitelist && yupSchema._whitelist.list.size > 0) {
    const values = Array.from(yupSchema._whitelist.list);
    if (!values.includes(undefined)) {
      schema.enum = values;
    }
  }

  // Extract constraints from test checks
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

  // Handle nullable
  if (yupSchema.spec?.nullable) {
    schema.nullable = true;
  }

  // Handle default value
  if (yupSchema.spec?.default !== undefined) {
    schema.default = yupSchema.spec.default;
  }

  return schema;
}

/**
 * Convert Yup Number
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

  // Handle nullable
  if (yupSchema.spec?.nullable) {
    schema.nullable = true;
  }

  // Handle default value
  if (yupSchema.spec?.default !== undefined) {
    schema.default = yupSchema.spec.default;
  }

  return schema;
}

/**
 * Convert Yup Array
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

  // Handle nullable
  if (yupSchema.spec?.nullable) {
    schema.nullable = true;
  }

  // Handle default value
  if (yupSchema.spec?.default !== undefined) {
    schema.default = yupSchema.spec.default;
  }

  return schema;
}

/**
 * Convert Yup Object
 */
function convertYupObject(yupSchema: YupSchema): Schema {
  const { fields } = yupSchema;
  if (!fields) return { type: 'object' };

  const properties: Record<string, Schema> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(fields)) {
    const fieldSchema = value as YupSchema;
    properties[key] = yupToOpenApi(fieldSchema);

    // Required field if spec.optional is false or undefined
    if (!fieldSchema.spec?.optional && !fieldSchema.spec?.nullable) {
      // Check if required test exists explicitly
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

  // Handle nullable
  if (yupSchema.spec?.nullable) {
    schema.nullable = true;
  }

  // Handle default value
  if (yupSchema.spec?.default !== undefined) {
    schema.default = yupSchema.spec.default;
  }

  return schema;
}

/**
 * Convert Yup Mixed
 */
function convertYupMixed(yupSchema: YupSchema): Schema {
  const schema: Schema = {};

  // Handle oneOf values
  if (yupSchema._whitelist && yupSchema._whitelist.list.size > 0) {
    const values = Array.from(yupSchema._whitelist.list);
    if (!values.includes(undefined)) {
      schema.enum = values;
    }
  }

  // Handle nullable
  if (yupSchema.spec?.nullable) {
    schema.nullable = true;
  }

  // Handle default value
  if (yupSchema.spec?.default !== undefined) {
    schema.default = yupSchema.spec.default;
  }

  return schema;
}

/**
 * Convert Yup Tuple
 */
function convertYupTuple(yupSchema: YupSchema): Schema {
  // Yup tuple has types array in spec.types
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
