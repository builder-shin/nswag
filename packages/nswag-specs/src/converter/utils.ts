/**
 * 스키마 변환기 공통 유틸리티 함수
 * $ref 참조 해석, 복합 스키마 처리, format 검증 등
 */

import type { Schema, OpenAPISpec } from '../types/index.js';
import type { ConvertWarning, WarningType, ConvertOptions } from './types.js';

/**
 * 경고 수집기 클래스
 * 변환 중 발생하는 경고를 수집하고 관리
 */
export class WarningCollector {
  private warnings: ConvertWarning[] = [];

  /**
   * 경고 추가
   *
   * @param type - 경고 유형
   * @param message - 경고 메시지
   * @param path - 스키마 경로 (선택적)
   */
  add(type: WarningType, message: string, path?: string): void {
    this.warnings.push({ type, message, path });
  }

  /**
   * 간단한 경고 추가 (문자열만)
   *
   * @param message - 경고 메시지
   */
  addSimple(message: string): void {
    this.warnings.push({ type: 'fallback-used', message });
  }

  /**
   * 수집된 경고 목록 반환
   *
   * @returns 경고 문자열 배열
   */
  getWarnings(): string[] {
    return this.warnings.map((w) => (w.path ? `[${w.path}] ${w.message}` : w.message));
  }

  /**
   * 상세 경고 목록 반환
   *
   * @returns 경고 객체 배열
   */
  getDetailedWarnings(): ConvertWarning[] {
    return [...this.warnings];
  }

  /**
   * 경고 존재 여부 확인
   *
   * @returns 경고가 있으면 true
   */
  hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  /**
   * 경고 초기화
   */
  clear(): void {
    this.warnings = [];
  }
}

/**
 * $ref 참조 해석
 * OpenAPI 스펙 내의 $ref 참조를 실제 스키마로 해석
 *
 * @param ref - $ref 문자열 (예: '#/components/schemas/User')
 * @param rootSpec - 루트 OpenAPI 스펙
 * @returns 해석된 스키마
 * @throws 참조를 찾을 수 없는 경우 에러
 *
 * @example
 * ```typescript
 * const userSchema = resolveRef('#/components/schemas/User', openApiSpec);
 * ```
 */
export function resolveRef(ref: string, rootSpec: OpenAPISpec): Schema {
  // '#/components/schemas/SchemaName' 형태 처리
  if (!ref.startsWith('#/')) {
    throw new Error(`외부 참조는 지원하지 않습니다: ${ref}`);
  }

  const path = ref.slice(2).split('/');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = rootSpec;

  for (const segment of path) {
    if (current === undefined || current === null) {
      throw new Error(`$ref 참조를 해석할 수 없습니다: ${ref}`);
    }
    current = current[segment];
  }

  if (current === undefined) {
    throw new Error(`$ref 참조를 찾을 수 없습니다: ${ref}`);
  }

  return current as Schema;
}

/**
 * 참조 해석 시도 (에러 발생하지 않음)
 *
 * @param ref - $ref 문자열
 * @param rootSpec - 루트 OpenAPI 스펙
 * @param collector - 경고 수집기
 * @returns 해석된 스키마 또는 빈 객체
 */
export function tryResolveRef(
  ref: string,
  rootSpec: OpenAPISpec | undefined,
  collector: WarningCollector,
): Schema {
  if (!rootSpec) {
    collector.add('unresolved-ref', `$ref 해석을 위한 rootSpec이 제공되지 않았습니다: ${ref}`);
    return {};
  }

  try {
    return resolveRef(ref, rootSpec);
  } catch (error) {
    collector.add(
      'unresolved-ref',
      `$ref 참조를 해석할 수 없습니다: ${ref} - ${error instanceof Error ? error.message : String(error)}`,
    );
    return {};
  }
}

/**
 * 복합 스키마 처리 (oneOf, anyOf, allOf)
 * 복합 스키마를 단일 스키마로 병합하거나 처리
 *
 * @param schema - OpenAPI 스키마
 * @param options - 변환 옵션
 * @param collector - 경고 수집기
 * @returns 처리된 스키마
 */
export function processCompositeSchema(
  schema: Schema,
  options: ConvertOptions = {},
  collector: WarningCollector,
): Schema {
  // allOf 처리: 모든 스키마를 병합
  if (schema.allOf && schema.allOf.length > 0) {
    let merged: Schema = {};
    for (const subSchema of schema.allOf) {
      const resolved = subSchema.$ref
        ? tryResolveRef(subSchema.$ref, options.rootSpec, collector)
        : subSchema;
      merged = mergeSchemas(merged, resolved);
    }
    return merged;
  }

  // oneOf, anyOf는 그대로 반환 (변환기에서 처리)
  return schema;
}

/**
 * 두 스키마 병합
 * allOf 처리 시 사용
 *
 * @param base - 기본 스키마
 * @param override - 덮어쓸 스키마
 * @returns 병합된 스키마
 */
export function mergeSchemas(base: Schema, override: Schema): Schema {
  const merged: Schema = { ...base };

  // 타입 병합
  if (override.type) {
    merged.type = override.type;
  }

  // properties 병합
  if (override.properties) {
    merged.properties = {
      ...(merged.properties || {}),
      ...override.properties,
    };
  }

  // required 병합
  if (override.required) {
    merged.required = [...new Set([...(merged.required || []), ...override.required])];
  }

  // 다른 속성들 복사
  const keysToMerge = [
    'format',
    'description',
    'minimum',
    'maximum',
    'minLength',
    'maxLength',
    'pattern',
    'minItems',
    'maxItems',
    'uniqueItems',
    'nullable',
    'enum',
    'default',
  ] as const;

  for (const key of keysToMerge) {
    if (override[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[key] = override[key];
    }
  }

  return merged;
}

/**
 * format 검증 함수 매핑
 * OpenAPI format에 대한 검증 함수들
 */
export const FORMAT_VALIDATORS: Record<string, (value: string) => boolean> = {
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  uri: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  url: (value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  uuid: (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  date: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)),
  'date-time': (value) => {
    const iso8601 =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;
    return iso8601.test(value) && !isNaN(Date.parse(value));
  },
  time: (value) => /^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value),
  duration: (value) => /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/.test(value),
  ipv4: (value) => {
    const parts = value.split('.');
    return (
      parts.length === 4 &&
      parts.every((p) => {
        const num = parseInt(p, 10);
        return num >= 0 && num <= 255 && p === String(num);
      })
    );
  },
  ipv6: (value) => /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(value),
  hostname: (value) => /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/.test(value),
};

/**
 * 스키마 이름 정규화
 * 코드 생성 시 사용할 유효한 변수 이름으로 변환
 *
 * @param name - 원본 이름
 * @returns 정규화된 이름
 */
export function normalizeSchemaName(name: string): string {
  // 첫 글자를 대문자로
  let normalized = name.charAt(0).toUpperCase() + name.slice(1);

  // 유효하지 않은 문자 제거
  normalized = normalized.replace(/[^a-zA-Z0-9_]/g, '');

  // 숫자로 시작하면 앞에 _ 추가
  if (/^\d/.test(normalized)) {
    normalized = '_' + normalized;
  }

  return normalized || 'Schema';
}

/**
 * 문자열 이스케이프
 * 코드 생성 시 문자열 리터럴에 사용
 *
 * @param str - 원본 문자열
 * @returns 이스케이프된 문자열
 */
export function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * 정규식 패턴 이스케이프
 * 코드 생성 시 정규식 리터럴에 사용
 *
 * @param pattern - 원본 패턴
 * @returns 이스케이프된 패턴
 */
export function escapeRegexPattern(pattern: string): string {
  // 백슬래시만 이스케이프 (정규식 내에서 다른 문자는 그대로 유지)
  return pattern.replace(/\\/g, '\\\\');
}

/**
 * 들여쓰기 적용
 * 코드 생성 시 들여쓰기 처리
 *
 * @param code - 코드 문자열
 * @param level - 들여쓰기 레벨
 * @param indent - 들여쓰기 문자열
 * @returns 들여쓰기가 적용된 코드
 */
export function applyIndent(code: string, level: number, indent: string = '  '): string {
  const prefix = indent.repeat(level);
  return code
    .split('\n')
    .map((line) => (line.trim() ? prefix + line : line))
    .join('\n');
}

/**
 * 기본 변환 옵션 생성
 *
 * @param options - 사용자 제공 옵션
 * @returns 기본값이 적용된 옵션
 */
export function getDefaultOptions(options: ConvertOptions = {}): Required<
  Omit<ConvertOptions, 'rootSpec' | 'definitions' | 'schemaName'>
> & Pick<ConvertOptions, 'rootSpec' | 'definitions' | 'schemaName'> {
  return {
    nullable: options.nullable ?? 'null',
    additionalProperties: options.additionalProperties ?? true,
    defaultRequired: options.defaultRequired ?? false,
    includeImports: options.includeImports ?? true,
    schemaName: options.schemaName,
    exportSchema: options.exportSchema ?? true,
    generateTypeInference: options.generateTypeInference ?? true,
    rootSpec: options.rootSpec,
    definitions: options.definitions,
    indent: options.indent ?? '  ',
    strict: options.strict ?? false,
  };
}

/**
 * OpenAPI 스키마가 nullable인지 확인
 *
 * @param schema - OpenAPI 스키마
 * @returns nullable 여부
 */
export function isNullable(schema: Schema): boolean {
  return schema.nullable === true;
}

/**
 * OpenAPI 스키마가 required 속성인지 확인
 *
 * @param propertyName - 속성 이름
 * @param parentSchema - 부모 object 스키마
 * @returns required 여부
 */
export function isRequired(propertyName: string, parentSchema: Schema): boolean {
  return parentSchema.required?.includes(propertyName) ?? false;
}

/**
 * enum 값을 문자열 리터럴로 변환
 *
 * @param values - enum 값 배열
 * @returns 문자열 리터럴 배열
 */
export function enumToLiterals(values: unknown[]): string[] {
  return values.map((v) => {
    if (typeof v === 'string') {
      return `'${escapeString(v)}'`;
    }
    return String(v);
  });
}

/**
 * $ref에서 스키마 이름 추출
 *
 * @param ref - $ref 문자열
 * @returns 스키마 이름
 */
export function getSchemaNameFromRef(ref: string): string {
  const parts = ref.split('/');
  return parts[parts.length - 1] ?? ref;
}

/**
 * OpenAPI 타입이 기본 타입인지 확인
 *
 * @param schema - OpenAPI 스키마
 * @returns 기본 타입 여부
 */
export function isPrimitiveType(schema: Schema): boolean {
  const primitiveTypes = ['string', 'number', 'integer', 'boolean', 'null'];
  return schema.type !== undefined && primitiveTypes.includes(schema.type);
}

/**
 * 스키마가 복합 타입인지 확인 (oneOf, anyOf, allOf)
 *
 * @param schema - OpenAPI 스키마
 * @returns 복합 타입 여부
 */
export function isCompositeType(schema: Schema): boolean {
  return Boolean(schema.oneOf || schema.anyOf || schema.allOf);
}

/**
 * 스키마가 참조 타입인지 확인
 *
 * @param schema - OpenAPI 스키마
 * @returns 참조 타입 여부
 */
export function isRefType(schema: Schema): boolean {
  return Boolean(schema.$ref);
}
