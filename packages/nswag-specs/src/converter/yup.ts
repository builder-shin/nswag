/**
 * Yup 스키마 변환기
 * OpenAPI JSON Schema와 Yup 스키마 간의 양방향 변환
 *
 * @example
 * ```typescript
 * import { openApiToYup, generateYupCode } from '@aspect/nswag-specs/converter';
 *
 * // 런타임 스키마 생성
 * const result = await openApiToYup({
 *   type: 'object',
 *   properties: {
 *     id: { type: 'integer' },
 *     email: { type: 'string', format: 'email' },
 *   },
 *   required: ['id', 'email'],
 * });
 *
 * // 유효성 검증
 * const isValid = await result.schema.isValid(data);
 *
 * // 코드 생성
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
 * Yup 타입 인터페이스 (내부 사용)
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
 * Yup 네임스페이스 타입
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
 * Yup 인스턴스를 동적으로 로드
 *
 * @returns Yup 모듈
 * @throws Yup이 설치되어 있지 않은 경우 에러
 */
async function loadYup(): Promise<YupNamespace> {
  try {
    const yupModule = await import('yup');
    return yupModule as unknown as YupNamespace;
  } catch {
    throw new Error(
      'yup 패키지가 설치되어 있지 않습니다. npm install yup을 실행하세요.',
    );
  }
}

/**
 * OpenAPI 스키마를 Yup 스키마로 변환 (비동기)
 *
 * @param schema - OpenAPI 스키마
 * @param options - 변환 옵션
 * @returns 변환 결과 (Yup 스키마 및 경고)
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
 * OpenAPI 스키마를 Yup 스키마로 변환 (동기, Yup 인스턴스 필요)
 *
 * @param schema - OpenAPI 스키마
 * @param yup - Yup 네임스페이스
 * @param options - 변환 옵션
 * @param collector - 경고 수집기
 * @returns Yup 스키마
 */
function convertSchemaToYup(
  schema: Schema,
  yup: YupNamespace,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): YupType {
  // $ref 처리
  if (schema.$ref) {
    const resolved = tryResolveRef(schema.$ref, options.rootSpec, collector);
    if (Object.keys(resolved).length === 0) {
      return yup.mixed();
    }
    return convertSchemaToYup(resolved, yup, options, collector);
  }

  // allOf 처리
  if (schema.allOf) {
    const processed = processCompositeSchema(schema, options, collector);
    return convertSchemaToYup(processed, yup, options, collector);
  }

  // oneOf/anyOf 처리 (Yup에서는 mixed().oneOf()로 처리)
  if (schema.oneOf || schema.anyOf) {
    collector.add(
      'complex-composition',
      'oneOf/anyOf는 Yup에서 제한적으로 지원됩니다. mixed() 타입으로 변환됩니다.',
    );
    return yup.mixed();
  }

  // enum 처리
  if (schema.enum && schema.enum.length > 0) {
    const baseSchema = getBaseSchemaForEnum(schema, yup);
    return baseSchema.oneOf(schema.enum);
  }

  // 타입별 처리
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
        collector.add('unsupported-type', '타입이 지정되지 않은 스키마입니다. mixed로 변환됩니다.');
        return yup.mixed();
      }
      collector.add('unsupported-type', `지원하지 않는 타입입니다: ${schema.type}`);
      return yup.mixed();
  }
}

/**
 * enum의 기본 스키마 타입 결정
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
 * string 스키마 변환
 */
function convertStringSchema(
  schema: Schema,
  yup: YupNamespace,
  collector: WarningCollector,
): YupType {
  let result = yup.string();

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
        // Yup의 date()는 문자열이 아닌 Date 객체를 기대
        // 문자열로 유지하려면 matches 사용
        collector.add(
          'unsupported-format',
          'date/date-time format은 Yup에서 Date 객체로 처리됩니다. 문자열 검증이 필요하면 matches()를 사용하세요.',
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
      result = result.matches(new RegExp(schema.pattern));
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
  yup: YupNamespace,
  collector: WarningCollector,
): YupType {
  let result = yup.number();

  // integer 처리
  if (schema.type === 'integer') {
    result = result.integer();
  }

  // minimum/maximum 제약조건
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

  // multipleOf 처리 - Yup에서 직접 지원하지 않음
  if (schema.multipleOf !== undefined) {
    collector.add(
      'unsupported-constraint',
      'multipleOf는 Yup에서 직접 지원하지 않습니다. test()를 사용하여 수동으로 검증하세요.',
    );
  }

  return result;
}

/**
 * array 스키마 변환
 */
function convertArraySchema(
  schema: Schema,
  yup: YupNamespace,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): YupType {
  // items 스키마
  const itemSchema = schema.items
    ? convertSchemaToYup(schema.items, yup, options, collector)
    : yup.mixed();

  let result = yup.array(itemSchema);

  // 배열 길이 제약조건
  if (schema.minItems !== undefined) {
    result = result.min(schema.minItems);
  }
  if (schema.maxItems !== undefined) {
    result = result.max(schema.maxItems);
  }

  // uniqueItems는 Yup에서 직접 지원하지 않음
  if (schema.uniqueItems) {
    collector.add(
      'unsupported-constraint',
      'uniqueItems는 Yup에서 직접 지원하지 않습니다. test()를 사용하여 수동으로 검증하세요.',
    );
  }

  return result;
}

/**
 * object 스키마 변환
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

      // nullable 처리
      if (propSchema.nullable) {
        fieldSchema = fieldSchema.nullable();
      }

      // required 처리
      const isRequired = options.defaultRequired || requiredFields.has(key);
      if (isRequired) {
        fieldSchema = fieldSchema.required();
      } else {
        fieldSchema = fieldSchema.notRequired();
      }

      // default 처리
      if (propSchema.default !== undefined) {
        fieldSchema = fieldSchema.default(propSchema.default);
      }

      shape[key] = fieldSchema;
    }
  }

  let result = yup.object(shape);

  // additionalProperties 처리
  if (!options.additionalProperties) {
    result = result.noUnknown(true);
  }

  if (options.strict) {
    result = result.strict(true);
  }

  return result;
}

/**
 * Yup 스키마를 OpenAPI 스키마로 변환
 * (adapters/yup.ts의 yupToOpenApi와 동일한 기능 - re-export)
 *
 * @param yupSchema - Yup 스키마
 * @returns OpenAPI 스키마
 */
export { yupToOpenApi } from '../adapters/yup.js';

/**
 * OpenAPI 스키마에서 Yup TypeScript 코드 생성
 *
 * @param schema - OpenAPI 스키마
 * @param options - 변환 옵션
 * @returns 생성된 TypeScript 코드
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
 * // 출력:
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

  // import 문 생성
  if (opts.includeImports) {
    lines.push("import * as yup from 'yup';");
    lines.push('');
  }

  // 스키마 이름 (Yup은 camelCase 관례)
  const schemaName = opts.schemaName
    ? opts.schemaName.charAt(0).toLowerCase() + opts.schemaName.slice(1)
    : 'generatedSchema';

  // 스키마 코드 생성
  const schemaCode = generateSchemaCode(schema, opts, collector, 0);

  // export 여부
  const exportPrefix = opts.exportSchema ? 'export ' : '';
  lines.push(`${exportPrefix}const ${schemaName} = ${schemaCode};`);

  // 타입 추론 생성
  if (opts.generateTypeInference) {
    lines.push('');
    const typeName = normalizeSchemaName(schemaName.replace(/Schema$/i, '')) || 'Generated';
    lines.push(`${exportPrefix}type ${typeName} = yup.InferType<typeof ${schemaName}>;`);
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
    return refName.charAt(0).toLowerCase() + refName.slice(1);
  }

  // allOf 처리
  if (schema.allOf && schema.allOf.length > 0) {
    collector.add('complex-composition', 'allOf는 병합된 object로 변환됩니다.');
    const processed = processCompositeSchema(schema, options, collector);
    return generateSchemaCode(processed, options, collector, depth);
  }

  // oneOf/anyOf 처리
  if (schema.oneOf || schema.anyOf) {
    collector.add('complex-composition', 'oneOf/anyOf는 Yup에서 제한적으로 지원됩니다.');
    return 'yup.mixed()';
  }

  // enum 처리
  if (schema.enum && schema.enum.length > 0) {
    const values = enumToLiterals(schema.enum);
    const baseType = typeof schema.enum[0] === 'string' ? 'yup.string()' : 'yup.number()';
    return `${baseType}.oneOf([${values.join(', ')}])`;
  }

  // 타입별 처리
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
      collector.add('unsupported-type', `지원하지 않는 타입입니다: ${schema.type}`);
      return 'yup.mixed()';
  }
}

/**
 * string 코드 생성
 */
function generateStringCode(schema: Schema, collector: WarningCollector): string {
  let code = 'yup.string()';

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
          `Yup에서 '${schema.format}' format을 직접 지원하지 않습니다.`,
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
    code += `.matches(/${escapedPattern}/)`;
  }

  return code;
}

/**
 * number 코드 생성
 */
function generateNumberCode(schema: Schema, collector: WarningCollector): string {
  let code = 'yup.number()';

  // integer 처리
  if (schema.type === 'integer') {
    code += '.integer()';
  }

  // minimum/maximum 제약조건
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

  // multipleOf 처리
  if (schema.multipleOf !== undefined) {
    collector.add(
      'unsupported-constraint',
      `multipleOf(${schema.multipleOf})는 Yup에서 직접 지원하지 않습니다.`,
    );
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

    // nullable 처리
    if (propSchema.nullable) {
      propCode += '.nullable()';
    }

    // required 처리
    const isRequired = options.defaultRequired || requiredFields.has(key);
    if (isRequired) {
      propCode += '.required()';
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

  let code = `yup.object({\n${propLines.join('\n')}\n${indent}})`;

  // additionalProperties 처리
  if (!options.additionalProperties) {
    code += '.noUnknown()';
  }

  if (options.strict) {
    code += '.strict()';
  }

  return code;
}
