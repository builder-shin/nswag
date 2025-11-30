/**
 * TypeBox 스키마 변환기
 * OpenAPI JSON Schema와 TypeBox 스키마 간의 양방향 변환
 *
 * @example
 * ```typescript
 * import { openApiToTypeBox, generateTypeBoxCode } from '@aspect/nswag-specs/converter';
 * import { Value } from '@sinclair/typebox/value';
 *
 * // 런타임 스키마 생성
 * const result = await openApiToTypeBox({
 *   type: 'object',
 *   properties: {
 *     id: { type: 'integer' },
 *     email: { type: 'string', format: 'email' },
 *   },
 *   required: ['id', 'email'],
 * });
 *
 * // 유효성 검증
 * const isValid = Value.Check(result.schema, data);
 *
 * // 코드 생성
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
 * TypeBox 타입 인터페이스 (내부 사용)
 */
interface TSchema {
  [kind: symbol]: string;
  type?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * TypeBox Type 빌더 인터페이스
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
 * TypeBox 인스턴스를 동적으로 로드
 *
 * @returns TypeBox Type 빌더
 * @throws TypeBox가 설치되어 있지 않은 경우 에러
 */
async function loadTypeBox(): Promise<TypeBuilder> {
  try {
    const typeboxModule = await import('@sinclair/typebox');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (typeboxModule as any).Type as TypeBuilder;
  } catch {
    throw new Error(
      '@sinclair/typebox 패키지가 설치되어 있지 않습니다. npm install @sinclair/typebox를 실행하세요.',
    );
  }
}

/**
 * OpenAPI 스키마를 TypeBox 스키마로 변환 (비동기)
 *
 * @param schema - OpenAPI 스키마
 * @param options - 변환 옵션
 * @returns 변환 결과 (TypeBox 스키마 및 경고)
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
 * OpenAPI 스키마를 TypeBox 스키마로 변환 (동기, Type 빌더 필요)
 *
 * @param schema - OpenAPI 스키마
 * @param Type - TypeBox Type 빌더
 * @param options - 변환 옵션
 * @param collector - 경고 수집기
 * @returns TypeBox 스키마
 */
function convertSchemaToTypeBox(
  schema: Schema,
  Type: TypeBuilder,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): TSchema {
  // $ref 처리
  if (schema.$ref) {
    const resolved = tryResolveRef(schema.$ref, options.rootSpec, collector);
    if (Object.keys(resolved).length === 0) {
      return Type.Any();
    }
    return convertSchemaToTypeBox(resolved, Type, options, collector);
  }

  // allOf 처리
  if (schema.allOf && schema.allOf.length > 0) {
    const schemas = schema.allOf.map((s) => convertSchemaToTypeBox(s, Type, options, collector));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return Type.Intersect(schemas);
  }

  // oneOf 처리
  if (schema.oneOf && schema.oneOf.length > 0) {
    const schemas = schema.oneOf.map((s) => convertSchemaToTypeBox(s, Type, options, collector));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return Type.Union(schemas);
  }

  // anyOf 처리
  if (schema.anyOf && schema.anyOf.length > 0) {
    const schemas = schema.anyOf.map((s) => convertSchemaToTypeBox(s, Type, options, collector));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return Type.Union(schemas);
  }

  // enum 처리
  if (schema.enum && schema.enum.length > 0) {
    if (schema.enum.length === 1) {
      return Type.Literal(schema.enum[0]);
    }
    const literals = schema.enum.map((v) => Type.Literal(v));
    return Type.Union(literals);
  }

  // 타입별 처리
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
        collector.add('unsupported-type', '타입이 지정되지 않은 스키마입니다. Any로 변환됩니다.');
        return Type.Any();
      }
      collector.add('unsupported-type', `지원하지 않는 타입입니다: ${schema.type}`);
      return Type.Any();
  }
}

/**
 * string 스키마 변환
 */
function convertStringSchema(
  schema: Schema,
  Type: TypeBuilder,
  collector: WarningCollector,
): TSchema {
  const options: Record<string, unknown> = {};

  // format 처리
  if (schema.format) {
    options.format = schema.format;

    // TypeBox에서 지원하지 않는 format 경고
    const unsupportedFormats = ['hostname', 'byte', 'binary', 'password'];
    if (unsupportedFormats.includes(schema.format)) {
      collector.add(
        'unsupported-format',
        `TypeBox에서 '${schema.format}' format은 검증되지 않습니다. 메타데이터로만 저장됩니다.`,
      );
    }
  }

  // 길이 제약조건
  if (schema.minLength !== undefined) {
    options.minLength = schema.minLength;
  }
  if (schema.maxLength !== undefined) {
    options.maxLength = schema.maxLength;
  }

  // pattern 처리
  if (schema.pattern) {
    options.pattern = schema.pattern;
  }

  return Type.String(Object.keys(options).length > 0 ? options : undefined);
}

/**
 * number 스키마 변환
 */
function convertNumberSchema(
  schema: Schema,
  Type: TypeBuilder,
  _collector: WarningCollector,
): TSchema {
  const options: Record<string, unknown> = {};

  // minimum/maximum 제약조건
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

  // multipleOf 처리
  if (schema.multipleOf !== undefined) {
    options.multipleOf = schema.multipleOf;
  }

  return Type.Number(Object.keys(options).length > 0 ? options : undefined);
}

/**
 * integer 스키마 변환
 */
function convertIntegerSchema(
  schema: Schema,
  Type: TypeBuilder,
  _collector: WarningCollector,
): TSchema {
  const options: Record<string, unknown> = {};

  // minimum/maximum 제약조건
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

  // multipleOf 처리
  if (schema.multipleOf !== undefined) {
    options.multipleOf = schema.multipleOf;
  }

  return Type.Integer(Object.keys(options).length > 0 ? options : undefined);
}

/**
 * array 스키마 변환
 */
function convertArraySchema(
  schema: Schema,
  Type: TypeBuilder,
  options: ReturnType<typeof getDefaultOptions>,
  collector: WarningCollector,
): TSchema {
  // items 스키마
  const itemSchema = schema.items
    ? convertSchemaToTypeBox(schema.items, Type, options, collector)
    : Type.Any();

  const arrayOptions: Record<string, unknown> = {};

  // 배열 길이 제약조건
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
 * object 스키마 변환
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

      // optional 처리
      const isRequired = options.defaultRequired || requiredFields.has(key);
      if (!isRequired) {
        fieldSchema = Type.Optional(fieldSchema);
      }

      properties[key] = fieldSchema;
    }
  }

  const objectOptions: Record<string, unknown> = {};

  // additionalProperties 처리
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
 * TypeBox 스키마를 OpenAPI 스키마로 변환
 * (adapters/typebox.ts의 typeBoxToOpenApi와 동일한 기능 - re-export)
 *
 * @param typeboxSchema - TypeBox 스키마
 * @returns OpenAPI 스키마
 */
export { typeboxToOpenApi } from '../adapters/typebox.js';

/**
 * OpenAPI 스키마에서 TypeBox TypeScript 코드 생성
 *
 * @param schema - OpenAPI 스키마
 * @param options - 변환 옵션
 * @returns 생성된 TypeScript 코드
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
 * // 출력:
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

  // import 문 생성
  if (opts.includeImports) {
    lines.push("import { Type, Static } from '@sinclair/typebox';");
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
    lines.push(`${exportPrefix}type ${typeName} = Static<typeof ${schemaName}>;`);
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
    return normalizeSchemaName(refName);
  }

  // allOf 처리
  if (schema.allOf && schema.allOf.length > 0) {
    const schemas = schema.allOf.map((s) => generateSchemaCode(s, options, collector, depth));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return `Type.Intersect([${schemas.join(', ')}])`;
  }

  // oneOf 처리
  if (schema.oneOf && schema.oneOf.length > 0) {
    const schemas = schema.oneOf.map((s) => generateSchemaCode(s, options, collector, depth));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return `Type.Union([${schemas.join(', ')}])`;
  }

  // anyOf 처리
  if (schema.anyOf && schema.anyOf.length > 0) {
    const schemas = schema.anyOf.map((s) => generateSchemaCode(s, options, collector, depth));
    if (schemas.length === 1) {
      return schemas[0]!;
    }
    return `Type.Union([${schemas.join(', ')}])`;
  }

  // enum 처리
  if (schema.enum && schema.enum.length > 0) {
    const values = enumToLiterals(schema.enum);
    if (values.length === 1) {
      return `Type.Literal(${values[0]})`;
    }
    const literals = values.map((v) => `Type.Literal(${v})`);
    return `Type.Union([${literals.join(', ')}])`;
  }

  // 타입별 처리
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
      collector.add('unsupported-type', `지원하지 않는 타입입니다: ${schema.type}`);
      return 'Type.Any()';
  }
}

/**
 * string 코드 생성
 */
function generateStringCode(schema: Schema, _collector: WarningCollector): string {
  const options: string[] = [];

  // format 처리
  if (schema.format) {
    options.push(`format: '${schema.format}'`);
  }

  // 길이 제약조건
  if (schema.minLength !== undefined) {
    options.push(`minLength: ${schema.minLength}`);
  }
  if (schema.maxLength !== undefined) {
    options.push(`maxLength: ${schema.maxLength}`);
  }

  // pattern 처리
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
 * number 코드 생성
 */
function generateNumberCode(schema: Schema): string {
  const options: string[] = [];

  // minimum/maximum 제약조건
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

  // multipleOf 처리
  if (schema.multipleOf !== undefined) {
    options.push(`multipleOf: ${schema.multipleOf}`);
  }

  if (options.length > 0) {
    return `Type.Number({ ${options.join(', ')} })`;
  }
  return 'Type.Number()';
}

/**
 * integer 코드 생성
 */
function generateIntegerCode(schema: Schema): string {
  const options: string[] = [];

  // minimum/maximum 제약조건
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

  // multipleOf 처리
  if (schema.multipleOf !== undefined) {
    options.push(`multipleOf: ${schema.multipleOf}`);
  }

  if (options.length > 0) {
    return `Type.Integer({ ${options.join(', ')} })`;
  }
  return 'Type.Integer()';
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
    if (!options.additionalProperties) {
      return 'Type.Object({}, { additionalProperties: false })';
    }
    return 'Type.Object({})';
  }

  const requiredFields = new Set(schema.required || []);
  const propLines: string[] = [];

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    let propCode = generateSchemaCode(propSchema, options, collector, depth + 1);

    // optional 처리
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
