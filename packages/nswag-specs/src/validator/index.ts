/**
 * 검증기 모듈
 * JSON Schema 기반 응답 검증
 */

import * as AjvModule from 'ajv';
import type { Schema } from '../types/index.js';

// ESM/CJS 호환성을 위한 Ajv 클래스 추출
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AjvConstructor = (AjvModule as any).default ?? AjvModule;

/**
 * 검증 결과 인터페이스
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[] | null;
}

/**
 * 검증 오류 인터페이스
 */
export interface ValidationError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
}

/**
 * JSON Schema 검증기
 */
export class SchemaValidator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ajv: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private validators: Map<string, any> = new Map();

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    this.ajv = new AjvConstructor({
      allErrors: true,
      strict: false,
    });
  }

  /**
   * 스키마를 컴파일하고 캐싱
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compile(schema: Schema, id?: string): any {
    const schemaId = id ?? JSON.stringify(schema);

    if (this.validators.has(schemaId)) {
      return this.validators.get(schemaId)!;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const validate = this.ajv.compile(schema);
    this.validators.set(schemaId, validate);
    return validate;
  }

  /**
   * 데이터를 스키마에 대해 검증
   */
  validate(data: unknown, schema: Schema): ValidationResult {
    const validate = this.compile(schema);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const valid = validate(data);

    return {
      valid: valid as boolean,
      errors: (validate.errors as ValidationError[] | null) ?? null,
    };
  }

  /**
   * 캐시된 검증기 제거
   */
  clear(): void {
    this.validators.clear();
  }
}

/**
 * 기본 검증기 인스턴스
 */
export const defaultValidator = new SchemaValidator();
