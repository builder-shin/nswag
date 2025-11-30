/**
 * 스키마 처리 유틸리티
 * Phase 4: API 버전 및 문서화 옵션
 *
 * Nullable 속성 지원, 스키마 검증 옵션 처리
 */

import type { SchemaObject, ResponseOptions } from './types.js';
import { GlobalConfigManager } from './global-config.js';

/**
 * 확장 스키마 타입 (nullable 처리용 - OpenAPI 3.1 배열 타입 지원)
 */
interface ExtendedSchemaObject extends Omit<SchemaObject, 'type'> {
  type?: string | string[];
}

// ============================================================================
// Nullable 처리
// ============================================================================

/**
 * 스키마가 OpenAPI 3.1인지 확인
 */
export function isOpenAPI31(specPath?: string): boolean {
  const version = GlobalConfigManager.getOpenAPIVersion(specPath);
  return version.startsWith('3.1');
}

/**
 * nullable 속성을 OpenAPI 버전에 맞게 정규화
 *
 * OpenAPI 3.0: { type: 'string', nullable: true }
 * OpenAPI 3.1: { type: ['string', 'null'] }
 *
 * @example
 * // OpenAPI 3.0에서
 * normalizeNullable({ type: 'string', nullable: true })
 * // => { type: 'string', nullable: true }
 *
 * // OpenAPI 3.1에서
 * normalizeNullable({ type: 'string', nullable: true })
 * // => { type: ['string', 'null'] }
 */
export function normalizeNullable(schema: SchemaObject, specPath?: string): SchemaObject {
  // ExtendedSchemaObject로 처리 (배열 타입 지원)
  const result: ExtendedSchemaObject = { ...schema };
  const is31 = isOpenAPI31(specPath);

  // x-nullable 레거시 지원 (Swagger 2.0 호환)
  if ('x-nullable' in schema) {
    const xNullable = (schema as Record<string, unknown>)['x-nullable'];
    if (xNullable === true) {
      if (is31) {
        result.type = makeNullableType31(schema.type);
      } else {
        result.nullable = true;
      }
    }
    // x-nullable 속성 제거
    delete (result as Record<string, unknown>)['x-nullable'];
  }

  // nullable 속성을 OpenAPI 3.1로 변환
  if (result.nullable && is31) {
    result.type = makeNullableType31(result.type as string | undefined);
    delete result.nullable;
  }

  // OpenAPI 3.1 배열 타입을 3.0으로 변환 (필요시)
  if (!is31 && Array.isArray(result.type)) {
    const types = result.type as string[];
    if (types.includes('null')) {
      result.type = types.find(t => t !== 'null');
      result.nullable = true;
    }
  }

  // 중첩 스키마 처리
  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, propSchema]) => [
        key,
        normalizeNullable(propSchema as SchemaObject, specPath),
      ])
    );
  }

  if (result.items) {
    result.items = normalizeNullable(result.items as SchemaObject, specPath);
  }

  if (result.allOf) {
    result.allOf = result.allOf.map(s => normalizeNullable(s as SchemaObject, specPath));
  }

  if (result.oneOf) {
    result.oneOf = result.oneOf.map(s => normalizeNullable(s as SchemaObject, specPath));
  }

  if (result.anyOf) {
    result.anyOf = result.anyOf.map(s => normalizeNullable(s as SchemaObject, specPath));
  }

  // SchemaObject로 반환 (OpenAPI 3.0 호환을 위해 type을 string으로 변환)
  // OpenAPI 3.1 배열 타입은 그대로 유지하면서 타입 캐스팅
  return result as unknown as SchemaObject;
}

/**
 * OpenAPI 3.1용 nullable 타입 생성
 */
function makeNullableType31(type: string | string[] | undefined): string[] {
  if (!type) {
    return ['null'];
  }
  if (Array.isArray(type)) {
    return type.includes('null') ? type : [...type, 'null'];
  }
  return [type, 'null'];
}

// ============================================================================
// 스키마 검증 옵션 처리
// ============================================================================

/**
 * 스키마에 검증 옵션 적용
 *
 * @example
 * applySchemaValidationOptions(schema, {
 *   openapiNoAdditionalProperties: true,
 *   openapiAllPropertiesRequired: true
 * });
 */
export function applySchemaValidationOptions(
  schema: SchemaObject,
  options: ResponseOptions = {}
): SchemaObject {
  const result = { ...schema };

  // 전역 설정과 개별 옵션 병합
  const noAdditionalProperties =
    options.openapiNoAdditionalProperties ??
    GlobalConfigManager.getNoAdditionalProperties();
  const allPropertiesRequired =
    options.openapiAllPropertiesRequired ??
    GlobalConfigManager.getAllPropertiesRequired();

  // additionalProperties 처리
  if (noAdditionalProperties && result.type === 'object') {
    result.additionalProperties = false;
  }

  // required 처리
  if (allPropertiesRequired && result.type === 'object' && result.properties) {
    result.required = Object.keys(result.properties);
  }

  // 중첩 스키마 처리
  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, propSchema]) => [
        key,
        applySchemaValidationOptions(propSchema as SchemaObject, options),
      ])
    );
  }

  if (result.items) {
    result.items = applySchemaValidationOptions(result.items, options);
  }

  if (result.allOf) {
    result.allOf = result.allOf.map(s => applySchemaValidationOptions(s, options));
  }

  if (result.oneOf) {
    result.oneOf = result.oneOf.map(s => applySchemaValidationOptions(s, options));
  }

  if (result.anyOf) {
    result.anyOf = result.anyOf.map(s => applySchemaValidationOptions(s, options));
  }

  return result;
}

/**
 * 스키마 전처리 (nullable + 검증 옵션)
 *
 * @example
 * const processedSchema = processSchema(rawSchema, {
 *   openapiNoAdditionalProperties: true
 * }, 'v1/openapi.json');
 */
export function processSchema(
  schema: SchemaObject,
  options: ResponseOptions = {},
  specPath?: string
): SchemaObject {
  // 1. Nullable 정규화
  let result = normalizeNullable(schema, specPath);

  // 2. 검증 옵션 적용
  result = applySchemaValidationOptions(result, options);

  return result;
}

// ============================================================================
// 스키마 검증
// ============================================================================

/**
 * 스키마 검증 오류
 */
export interface SchemaValidationError {
  path: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

/**
 * 응답 데이터가 스키마와 일치하는지 검증
 *
 * @example
 * const errors = validateAgainstSchema(responseBody, schema, {
 *   openapiNoAdditionalProperties: true
 * });
 */
export function validateAgainstSchema(
  data: unknown,
  schema: SchemaObject,
  options: ResponseOptions = {},
  path: string = '$'
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];
  const processedSchema = applySchemaValidationOptions(schema, options);

  // null 검증
  if (data === null) {
    if (!processedSchema.nullable && !isNullableType(processedSchema.type)) {
      errors.push({
        path,
        message: 'null 값이 허용되지 않습니다',
        expected: processedSchema.type,
        actual: 'null',
      });
    }
    return errors;
  }

  // 타입 검증
  const expectedType = getBaseType(processedSchema.type);
  const actualType = getActualType(data);

  if (expectedType && actualType !== expectedType) {
    errors.push({
      path,
      message: `타입이 일치하지 않습니다`,
      expected: expectedType,
      actual: actualType,
    });
    return errors;
  }

  // 객체 검증
  if (processedSchema.type === 'object' && typeof data === 'object' && data !== null) {
    const dataObj = data as Record<string, unknown>;

    // required 필드 검증
    if (processedSchema.required) {
      for (const requiredField of processedSchema.required) {
        if (!(requiredField in dataObj)) {
          errors.push({
            path: `${path}.${requiredField}`,
            message: '필수 필드가 누락되었습니다',
          });
        }
      }
    }

    // additionalProperties 검증
    if (processedSchema.additionalProperties === false && processedSchema.properties) {
      const allowedKeys = new Set(Object.keys(processedSchema.properties));
      for (const key of Object.keys(dataObj)) {
        if (!allowedKeys.has(key)) {
          errors.push({
            path: `${path}.${key}`,
            message: '허용되지 않는 추가 속성입니다',
          });
        }
      }
    }

    // 프로퍼티 재귀 검증
    if (processedSchema.properties) {
      for (const [key, propSchema] of Object.entries(processedSchema.properties)) {
        if (key in dataObj) {
          errors.push(...validateAgainstSchema(dataObj[key], propSchema, options, `${path}.${key}`));
        }
      }
    }
  }

  // 배열 검증
  if (processedSchema.type === 'array' && Array.isArray(data) && processedSchema.items) {
    data.forEach((item, index) => {
      errors.push(...validateAgainstSchema(item, processedSchema.items!, options, `${path}[${index}]`));
    });
  }

  return errors;
}

/**
 * 타입이 nullable인지 확인 (OpenAPI 3.1 배열 타입)
 */
function isNullableType(type: string | string[] | undefined): boolean {
  if (Array.isArray(type)) {
    return type.includes('null');
  }
  return false;
}

/**
 * 배열 타입에서 기본 타입 추출
 */
function getBaseType(type: string | string[] | undefined): string | undefined {
  if (Array.isArray(type)) {
    return type.find(t => t !== 'null');
  }
  return type;
}

/**
 * 데이터의 실제 타입 가져오기
 */
function getActualType(data: unknown): string {
  if (data === null) return 'null';
  if (Array.isArray(data)) return 'array';
  return typeof data;
}

// ============================================================================
// Phase 5: $ref 스키마 참조 해석
// ============================================================================

/**
 * 스키마 저장소 타입
 */
export interface SchemaRegistry {
  [path: string]: SchemaObject;
}

/**
 * 글로벌 스키마 레지스트리
 */
const globalSchemaRegistry: SchemaRegistry = {};

/**
 * 스키마 레지스트리에 스키마 등록
 *
 * @example
 * registerSchema('#/components/schemas/Blog', {
 *   type: 'object',
 *   properties: { id: { type: 'integer' }, title: { type: 'string' } }
 * });
 */
export function registerSchema(refPath: string, schema: SchemaObject): void {
  globalSchemaRegistry[refPath] = schema;
}

/**
 * 스키마 레지스트리 초기화
 */
export function clearSchemaRegistry(): void {
  Object.keys(globalSchemaRegistry).forEach(key => {
    delete globalSchemaRegistry[key];
  });
}

/**
 * 스키마 레지스트리에서 스키마 가져오기
 */
export function getRegisteredSchema(refPath: string): SchemaObject | undefined {
  return globalSchemaRegistry[refPath];
}

/**
 * $ref 스키마 참조 해석
 *
 * @param schema - 참조가 포함된 스키마
 * @param registry - 스키마 레지스트리 (기본: 글로벌 레지스트리)
 * @returns 해석된 스키마
 *
 * @example
 * const resolvedSchema = resolveSchemaRef({
 *   $ref: '#/components/schemas/Blog'
 * });
 *
 * @example
 * // 중첩된 참조 해석
 * const resolvedSchema = resolveSchemaRef({
 *   type: 'object',
 *   properties: {
 *     blog: { $ref: '#/components/schemas/Blog' }
 *   }
 * });
 */
export function resolveSchemaRef(
  schema: SchemaObject,
  registry: SchemaRegistry = globalSchemaRegistry,
  visited: Set<string> = new Set()
): SchemaObject {
  // $ref가 있으면 해석
  if (schema.$ref) {
    // 순환 참조 방지
    if (visited.has(schema.$ref)) {
      return schema; // 순환 참조는 그대로 반환
    }

    visited.add(schema.$ref);
    const resolvedSchema = registry[schema.$ref];

    if (resolvedSchema) {
      // 재귀적으로 해석
      return resolveSchemaRef(resolvedSchema, registry, visited);
    }

    // 해석되지 않은 참조는 그대로 반환
    return schema;
  }

  // 중첩 스키마 해석
  const result: SchemaObject = { ...schema };

  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, propSchema]) => [
        key,
        resolveSchemaRef(propSchema as SchemaObject, registry, new Set(visited)),
      ])
    );
  }

  if (result.items) {
    result.items = resolveSchemaRef(result.items as SchemaObject, registry, new Set(visited));
  }

  if (result.allOf) {
    result.allOf = result.allOf.map(s =>
      resolveSchemaRef(s as SchemaObject, registry, new Set(visited))
    );
  }

  if (result.oneOf) {
    result.oneOf = result.oneOf.map(s =>
      resolveSchemaRef(s as SchemaObject, registry, new Set(visited))
    );
  }

  if (result.anyOf) {
    result.anyOf = result.anyOf.map(s =>
      resolveSchemaRef(s as SchemaObject, registry, new Set(visited))
    );
  }

  if (typeof result.additionalProperties === 'object' && result.additionalProperties !== null) {
    result.additionalProperties = resolveSchemaRef(
      result.additionalProperties as SchemaObject,
      registry,
      new Set(visited)
    );
  }

  return result;
}

/**
 * OpenAPI 스펙에서 components/schemas를 레지스트리에 등록
 *
 * @example
 * registerSchemasFromSpec({
 *   components: {
 *     schemas: {
 *       Blog: { type: 'object', properties: { id: { type: 'integer' } } }
 *     }
 *   }
 * });
 * // 결과: '#/components/schemas/Blog'로 접근 가능
 */
export function registerSchemasFromSpec(spec: {
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
}): void {
  if (spec.components?.schemas) {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      registerSchema(`#/components/schemas/${name}`, schema);
    }
  }
}

// ============================================================================
// Phase 5: 복합 스키마 검증 (oneOf, anyOf, allOf)
// ============================================================================

/**
 * oneOf 스키마 검증
 * 정확히 하나의 스키마와 일치해야 함
 *
 * @example
 * validateOneOf(data, [
 *   { type: 'string' },
 *   { type: 'number' }
 * ]);
 */
export function validateOneOf(
  data: unknown,
  schemas: SchemaObject[],
  options: ResponseOptions = {},
  path: string = '$'
): SchemaValidationError[] {
  let matchCount = 0;
  const allErrors: SchemaValidationError[] = [];

  for (const schema of schemas) {
    const errors = validateAgainstSchema(data, schema, options, path);
    if (errors.length === 0) {
      matchCount++;
    } else {
      allErrors.push(...errors);
    }
  }

  if (matchCount === 0) {
    return [{
      path,
      message: `oneOf: 어떤 스키마와도 일치하지 않습니다 (${schemas.length}개 스키마 검사)`,
    }];
  }

  if (matchCount > 1) {
    return [{
      path,
      message: `oneOf: 정확히 하나의 스키마와 일치해야 하지만 ${matchCount}개와 일치합니다`,
    }];
  }

  return [];
}

/**
 * anyOf 스키마 검증
 * 하나 이상의 스키마와 일치해야 함
 *
 * @example
 * validateAnyOf(data, [
 *   { type: 'string' },
 *   { type: 'number' }
 * ]);
 */
export function validateAnyOf(
  data: unknown,
  schemas: SchemaObject[],
  options: ResponseOptions = {},
  path: string = '$'
): SchemaValidationError[] {
  for (const schema of schemas) {
    const errors = validateAgainstSchema(data, schema, options, path);
    if (errors.length === 0) {
      return []; // 하나라도 일치하면 성공
    }
  }

  return [{
    path,
    message: `anyOf: 어떤 스키마와도 일치하지 않습니다 (${schemas.length}개 스키마 검사)`,
  }];
}

/**
 * allOf 스키마 검증
 * 모든 스키마와 일치해야 함 (스키마 합성)
 *
 * @example
 * validateAllOf(data, [
 *   { type: 'object', properties: { name: { type: 'string' } } },
 *   { type: 'object', properties: { age: { type: 'number' } } }
 * ]);
 */
export function validateAllOf(
  data: unknown,
  schemas: SchemaObject[],
  options: ResponseOptions = {},
  path: string = '$'
): SchemaValidationError[] {
  const allErrors: SchemaValidationError[] = [];

  for (let i = 0; i < schemas.length; i++) {
    const schema = schemas[i];
    if (!schema) continue;

    const errors = validateAgainstSchema(data, schema, options, path);
    if (errors.length > 0) {
      allErrors.push({
        path,
        message: `allOf[${i}]: 스키마와 일치하지 않습니다`,
      });
      allErrors.push(...errors);
    }
  }

  return allErrors;
}

/**
 * 복합 스키마가 포함된 전체 스키마 검증
 *
 * @example
 * validateCompositeSchema(data, {
 *   oneOf: [
 *     { $ref: '#/components/schemas/BlogA' },
 *     { $ref: '#/components/schemas/BlogB' }
 *   ]
 * });
 */
export function validateCompositeSchema(
  data: unknown,
  schema: SchemaObject,
  options: ResponseOptions = {},
  path: string = '$'
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];

  // $ref 해석
  const resolvedSchema = resolveSchemaRef(schema);

  // oneOf 검증
  if (resolvedSchema.oneOf && resolvedSchema.oneOf.length > 0) {
    errors.push(...validateOneOf(data, resolvedSchema.oneOf, options, path));
  }

  // anyOf 검증
  if (resolvedSchema.anyOf && resolvedSchema.anyOf.length > 0) {
    errors.push(...validateAnyOf(data, resolvedSchema.anyOf, options, path));
  }

  // allOf 검증
  if (resolvedSchema.allOf && resolvedSchema.allOf.length > 0) {
    errors.push(...validateAllOf(data, resolvedSchema.allOf, options, path));
  }

  // 복합 스키마가 없으면 기본 스키마 검증
  if (!resolvedSchema.oneOf && !resolvedSchema.anyOf && !resolvedSchema.allOf) {
    errors.push(...validateAgainstSchema(data, resolvedSchema, options, path));
  }

  return errors;
}

/**
 * allOf 스키마 병합
 * 여러 스키마를 하나의 스키마로 병합합니다.
 *
 * @example
 * const merged = mergeAllOfSchemas([
 *   { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
 *   { type: 'object', properties: { b: { type: 'number' } }, required: ['b'] }
 * ]);
 * // => { type: 'object', properties: { a: {...}, b: {...} }, required: ['a', 'b'] }
 */
export function mergeAllOfSchemas(schemas: SchemaObject[]): SchemaObject {
  const result: SchemaObject = {};

  for (const schema of schemas) {
    const resolved = resolveSchemaRef(schema);

    // 타입 병합 (첫 번째 유효한 타입 사용)
    if (resolved.type && !result.type) {
      result.type = resolved.type;
    }

    // properties 병합
    if (resolved.properties) {
      result.properties = {
        ...result.properties,
        ...resolved.properties,
      };
    }

    // required 병합 (중복 제거)
    if (resolved.required) {
      const existingRequired = result.required ?? [];
      result.required = [...new Set([...existingRequired, ...resolved.required])];
    }

    // 기타 속성 병합
    if (resolved.additionalProperties !== undefined && result.additionalProperties === undefined) {
      result.additionalProperties = resolved.additionalProperties;
    }

    if (resolved.description && !result.description) {
      result.description = resolved.description;
    }
  }

  return result;
}
