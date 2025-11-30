/**
 * 스키마 변환기 공통 타입 정의
 * OpenAPI JSON Schema와 런타임 스키마 검증 라이브러리 간의 양방향 변환을 위한 타입
 */

import type { Schema, OpenAPISpec } from '../types/index.js';

/**
 * 변환 옵션
 * 스키마 변환 시 사용할 수 있는 공통 옵션
 */
export interface ConvertOptions {
  /**
   * nullable 처리 방식
   * - 'optional': 스키마를 선택적으로 처리 (Zod: .optional())
   * - 'null': null 값 허용 (Zod: .nullable())
   * - 'nullish': undefined 또는 null 허용 (Zod: .nullish())
   * @default 'null'
   */
  nullable?: 'optional' | 'null' | 'nullish';

  /**
   * 추가 속성 허용 여부
   * false인 경우 정의되지 않은 속성을 거부함
   * @default true
   */
  additionalProperties?: boolean;

  /**
   * 필수 속성 기본값
   * true인 경우 모든 속성을 필수로 처리
   * @default false
   */
  defaultRequired?: boolean;

  /**
   * 코드 생성 시 import 문 포함 여부
   * @default true
   */
  includeImports?: boolean;

  /**
   * 스키마 이름 (코드 생성용)
   * 생성된 코드에서 스키마 변수 이름으로 사용
   */
  schemaName?: string;

  /**
   * 스키마 export 여부
   * true인 경우 'export const' 형태로 생성
   * @default true
   */
  exportSchema?: boolean;

  /**
   * 타입 추론 생성 여부 (TypeBox 전용)
   * true인 경우 Static<typeof Schema> 타입도 생성
   * @default true
   */
  generateTypeInference?: boolean;

  /**
   * $ref 참조 해석을 위한 루트 스펙
   * $ref를 포함하는 스키마 변환 시 필요
   */
  rootSpec?: OpenAPISpec;

  /**
   * 참조 스키마 정의 맵
   * $ref 해석 시 사용할 스키마 정의
   */
  definitions?: Record<string, Schema>;

  /**
   * 코드 생성 시 들여쓰기 문자열
   * @default '  ' (공백 2칸)
   */
  indent?: string;

  /**
   * strict 모드 사용 여부
   * true인 경우 더 엄격한 검증 적용
   * @default false
   */
  strict?: boolean;
}

/**
 * 변환 결과
 * 런타임 스키마 객체와 관련 메타데이터를 포함
 *
 * @template T - 런타임 스키마 타입 (ZodSchema, YupSchema, TSchema 등)
 */
export interface ConvertResult<T> {
  /**
   * 런타임 스키마 객체
   * 실제 유효성 검증에 사용할 수 있는 스키마 인스턴스
   */
  schema: T;

  /**
   * TypeScript 코드 문자열 (코드 생성용)
   * 생성된 스키마를 파일로 저장할 때 사용
   */
  code?: string;

  /**
   * 경고 메시지 (지원하지 않는 기능 등)
   * 변환 중 발생한 비치명적 문제들
   */
  warnings?: string[];
}

/**
 * 코드 생성 결과
 * 스키마 코드와 관련 메타데이터를 포함
 */
export interface CodeGenerationResult {
  /**
   * 생성된 TypeScript 코드
   */
  code: string;

  /**
   * 사용된 import 문
   */
  imports: string[];

  /**
   * 경고 메시지
   */
  warnings: string[];
}

/**
 * 지원되는 대상 라이브러리
 */
export type TargetLibrary = 'zod' | 'yup' | 'typebox';

/**
 * OpenAPI 스키마 타입
 * type 필드에 사용할 수 있는 값들
 */
export type OpenAPISchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

/**
 * OpenAPI string format 타입
 */
export type OpenAPIStringFormat =
  | 'email'
  | 'uri'
  | 'url'
  | 'uuid'
  | 'date'
  | 'date-time'
  | 'time'
  | 'duration'
  | 'ipv4'
  | 'ipv6'
  | 'hostname'
  | 'regex'
  | 'byte'
  | 'binary'
  | 'password';

/**
 * OpenAPI number format 타입
 */
export type OpenAPINumberFormat = 'int32' | 'int64' | 'float' | 'double';

/**
 * 변환기 인터페이스
 * 각 라이브러리별 변환기가 구현해야 하는 공통 인터페이스
 *
 * @template T - 런타임 스키마 타입
 */
export interface SchemaConverter<T> {
  /**
   * OpenAPI 스키마를 런타임 스키마로 변환
   *
   * @param schema - OpenAPI 스키마
   * @param options - 변환 옵션
   * @returns 변환 결과
   */
  fromOpenAPI(schema: Schema, options?: ConvertOptions): ConvertResult<T>;

  /**
   * 런타임 스키마를 OpenAPI 스키마로 변환
   *
   * @param schema - 런타임 스키마
   * @returns OpenAPI 스키마
   */
  toOpenAPI(schema: T): Schema;

  /**
   * OpenAPI 스키마에서 TypeScript 코드 생성
   *
   * @param schema - OpenAPI 스키마
   * @param options - 변환 옵션
   * @returns 생성된 TypeScript 코드
   */
  generateCode(schema: Schema, options?: ConvertOptions): string;
}

/**
 * 변환 경고 유형
 */
export type WarningType =
  | 'unsupported-format'
  | 'unsupported-constraint'
  | 'unsupported-type'
  | 'unresolved-ref'
  | 'complex-composition'
  | 'fallback-used';

/**
 * 변환 경고
 */
export interface ConvertWarning {
  /**
   * 경고 유형
   */
  type: WarningType;

  /**
   * 경고 메시지
   */
  message: string;

  /**
   * 경고가 발생한 스키마 경로
   */
  path?: string;
}
