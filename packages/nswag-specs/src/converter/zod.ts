/**
 * Zod 스키마 변환기
 * OpenAPI JSON Schema와 Zod 스키마 간의 양방향 변환
 *
 * @example
 * ```typescript
 * import { openApiToZod, generateZodCode } from '@aspect/nswag-specs/converter';
 *
 * // 런타임 스키마 생성
 * const result = openApiToZod({
 *   type: 'object',
 *   properties: {
 *     id: { type: 'integer' },
 *     email: { type: 'string', format: 'email' },
 *   },
 *   required: ['id', 'email'],
 * });
 *
 * // 유효성 검증
 * const parsed = result.schema.safeParse(data);
 *
 * // 코드 생성
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
 * Zod 네임스페이스 타입 (동적 import용)
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
 * Zod 타입 인터페이스 (내부 사용)
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
 * Zod 인스턴스를 동적으로 로드
 *
 * @returns Zod 모듈
 * @throws Zod가 설치되어 있지 않은 경우 에러
 */
async function loadZod(): Promise<ZodNamespace> {
  try {
    const zodModule = await import('zod');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (zodModule as any).z as ZodNamespace;
  } catch {
    throw new Error(
      'zod 패키지가 설치되어 있지 않습니다. npm install zod를 실행하세요.',
    );
  }
}

/**
 * OpenAPI 스키마를 Zod 스키마로 변환 (비동기)
 *
 * @param schema - OpenAPI 스키마
 * @param options - 변환 옵션
 * @returns 변환 결과 (Zod 스키마 및 경고)
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
 * OpenAPI 스키마를 Zod 스키마로 변환 (동기, Zod 인스턴스 필요)
 *
 * @param schema - OpenAPI 스키마
 * @param z - Zod 네임스페이스
 * @param options - 변환 옵션
 * @param collector - 경고 수집기
 * @returns Zod 스키마
 */
function convertSchemaToZod(
  schema: Schema,
  z: ZodNamespace,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): ZodType {
  // $ref 처리
  if (schema.$ref) {
    const resolved = tryResolveRef(schema.$ref, options.rootSpec, collector);
    if (Object.keys(resolved).length === 0) {
      return z.any();
    }
    return convertSchemaToZod(resolved, z, options, collector);
  }

  // allOf 처리
  if (schema.allOf) {
    const processed = processCompositeSchema(schema, options, collector);
    return convertSchemaToZod(processed, z, options, collector);
  }

  // oneOf 처리
  if (schema.oneOf && schema.oneOf.length > 0) {
    const schemas = schema.oneOf.map((s) => convertSchemaToZod(s, z, options, collector));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return z.union(schemas as [ZodType, ZodType, ...ZodType[]]);
  }

  // anyOf 처리 (oneOf와 동일하게 처리)
  if (schema.anyOf && schema.anyOf.length > 0) {
    const schemas = schema.anyOf.map((s) => convertSchemaToZod(s, z, options, collector));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return z.union(schemas as [ZodType, ZodType, ...ZodType[]]);
  }

  // enum 처리
  if (schema.enum && schema.enum.length > 0) {
    const values = schema.enum as string[];
    if (values.length === 1) {
      return z.literal(values[0]);
    }
    return z.enum(values as [string, ...string[]]);
  }

  // 타입별 처리
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
      // 타입이 없는 경우 any로 처리
      if (!schema.type) {
        collector.add('unsupported-type', '타입이 지정되지 않은 스키마입니다. any로 변환됩니다.');
        return z.any();
      }
      collector.add('unsupported-type', `지원하지 않는 타입입니다: ${schema.type}`);
      return z.any();
  }
}

/**
 * string 스키마 변환
 */
function convertStringSchema(
  schema: Schema,
  z: ZodNamespace,
  collector: WarningCollector,
): ZodType {
  let result = z.string();

  // format 처리
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
        // Zod에서 직접 지원하지 않음, 정규식으로 처리 가능하지만 경고만 표시
        collector.add(
          'unsupported-format',
          `Zod에서 '${schema.format}' format을 직접 지원하지 않습니다. 기본 string으로 처리됩니다.`,
        );
        break;
      default:
        collector.add(
          'unsupported-format',
          `알 수 없는 format입니다: ${schema.format}`,
        );
    }
  }

  // 길이 제약조건
  if (schema.minLength !== undefined) {
    result = result.min(schema.minLength);
  }
  if (schema.maxLength !== undefined) {
    result = result.max(schema.maxLength);
  }

  // pattern 처리
  if (schema.pattern) {
    try {
      result = result.regex(new RegExp(schema.pattern));
    } catch (error) {
      collector.add(
        'unsupported-constraint',
        `잘못된 정규식 패턴입니다: ${schema.pattern}`,
      );
    }
  }

  return result;
}

/**
 * number/integer 스키마 변환
 */
function convertNumberSchema(
  schema: Schema,
  z: ZodNamespace,
  _collector: WarningCollector,
): ZodType {
  let result = z.number();

  // integer 처리
  if (schema.type === 'integer') {
    result = result.int();
  }

  // minimum/maximum 제약조건
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

  // multipleOf 처리
  if (schema.multipleOf !== undefined) {
    result = result.multipleOf(schema.multipleOf);
  }

  return result;
}

/**
 * array 스키마 변환
 */
function convertArraySchema(
  schema: Schema,
  z: ZodNamespace,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): ZodType {
  // items 스키마
  const itemSchema = schema.items
    ? convertSchemaToZod(schema.items, z, options, collector)
    : z.any();

  let result = z.array(itemSchema);

  // 배열 길이 제약조건
  if (schema.minItems !== undefined) {
    result = result.min(schema.minItems);
  }
  if (schema.maxItems !== undefined) {
    result = result.max(schema.maxItems);
  }

  // uniqueItems는 Zod에서 직접 지원하지 않음
  if (schema.uniqueItems) {
    collector.add(
      'unsupported-constraint',
      'uniqueItems는 Zod에서 직접 지원하지 않습니다. refine()을 사용하여 수동으로 검증하세요.',
    );
  }

  return result;
}

/**
 * object 스키마 변환
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

      // nullable 처리
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

      // optional 처리
      const isRequired = options.defaultRequired || requiredFields.has(key);
      if (!isRequired && !propSchema.nullable) {
        fieldSchema = fieldSchema.optional();
      }

      // default 처리
      if (propSchema.default !== undefined) {
        fieldSchema = fieldSchema.default(propSchema.default);
      }

      shape[key] = fieldSchema;
    }
  }

  let result = z.object(shape);

  // additionalProperties 처리
  if (options.additionalProperties) {
    result = result.passthrough();
  } else if (options.strict) {
    result = result.strict();
  }

  return result;
}

/**
 * Zod 스키마를 OpenAPI 스키마로 변환
 * (adapters/zod.ts의 zodToOpenApi와 동일한 기능 - re-export)
 *
 * @param zodSchema - Zod 스키마
 * @returns OpenAPI 스키마
 */
export { zodToOpenApi } from '../adapters/zod.js';

/**
 * OpenAPI 스키마에서 Zod TypeScript 코드 생성
 *
 * @param schema - OpenAPI 스키마
 * @param options - 변환 옵션
 * @returns 생성된 TypeScript 코드
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
 * // 출력:
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

  // import 문 생성
  if (opts.includeImports) {
    lines.push("import { z } from 'zod';");
    lines.push('');
  }

  // 스키마 이름
  const schemaName = opts.schemaName
    ? normalizeSchemaName(opts.schemaName)
    : 'GeneratedSchema';

  // 스키마 코드 생성
  const schemaCode = generateSchemaCode(schema, opts, collector, 0);

  // export 여부
  const exportPrefix = opts.exportSchema ? 'export ' : '';
  lines.push(`${exportPrefix}const ${schemaName} = ${schemaCode};`);

  // 타입 추론 생성
  if (opts.generateTypeInference) {
    lines.push('');
    const typeName = schemaName.replace(/Schema$/, '') || schemaName;
    lines.push(`${exportPrefix}type ${typeName} = z.infer<typeof ${schemaName}>;`);
  }

  return lines.join('\n');
}

/**
 * 스키마 코드 생성 (재귀)
 */
function generateSchemaCode(
  schema: Schema,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
  depth: number,
): string {
  const indent = options.indent.repeat(depth);
  const innerIndent = options.indent.repeat(depth + 1);

  // $ref 처리
  if (schema.$ref) {
    const refName = getSchemaNameFromRef(schema.$ref);
    // 참조 스키마가 정의에 있는 경우 해당 이름 사용
    return normalizeSchemaName(refName);
  }

  // allOf 처리
  if (schema.allOf && schema.allOf.length > 0) {
    const schemas = schema.allOf.map((s) => generateSchemaCode(s, options, collector, depth));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return schemas.reduce((acc, s) => `${acc}.and(${s})`);
  }

  // oneOf 처리
  if (schema.oneOf && schema.oneOf.length > 0) {
    const schemas = schema.oneOf.map((s) => generateSchemaCode(s, options, collector, depth));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return `z.union([${schemas.join(', ')}])`;
  }

  // anyOf 처리
  if (schema.anyOf && schema.anyOf.length > 0) {
    const schemas = schema.anyOf.map((s) => generateSchemaCode(s, options, collector, depth));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return `z.union([${schemas.join(', ')}])`;
  }

  // enum 처리
  if (schema.enum && schema.enum.length > 0) {
    const values = enumToLiterals(schema.enum);
    if (values.length === 1) {
      return `z.literal(${values[0]})`;
    }
    return `z.enum([${values.join(', ')}])`;
  }

  // 타입별 처리
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
      collector.add('unsupported-type', `지원하지 않는 타입입니다: ${schema.type}`);
      return 'z.any()';
  }
}

/**
 * string 코드 생성
 */
function generateStringCode(schema: Schema, collector: WarningCollector): string {
  let code = 'z.string()';

  // format 처리
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
          `Zod에서 '${schema.format}' format을 직접 지원하지 않습니다.`,
        );
    }
  }

  // 길이 제약조건
  if (schema.minLength !== undefined) {
    code += `.min(${schema.minLength})`;
  }
  if (schema.maxLength !== undefined) {
    code += `.max(${schema.maxLength})`;
  }

  // pattern 처리
  if (schema.pattern) {
    const escapedPattern = escapeRegexPattern(schema.pattern);
    code += `.regex(/${escapedPattern}/)`;
  }

  return code;
}

/**
 * number 코드 생성
 */
function generateNumberCode(schema: Schema): string {
  let code = 'z.number()';

  // integer 처리
  if (schema.type === 'integer') {
    code += '.int()';
  }

  // minimum/maximum 제약조건
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

  // multipleOf 처리
  if (schema.multipleOf !== undefined) {
    code += `.multipleOf(${schema.multipleOf})`;
  }

  return code;
}

/**
 * array 코드 생성
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
 * object 코드 생성
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

    // nullable 처리
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

    // optional 처리
    const isRequired = options.defaultRequired || requiredFields.has(key);
    if (!isRequired && !propSchema.nullable) {
      propCode += '.optional()';
    }

    // default 처리
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

  // additionalProperties 처리
  if (options.additionalProperties) {
    code += '.passthrough()';
  } else if (options.strict) {
    code += '.strict()';
  }

  return code;
}
