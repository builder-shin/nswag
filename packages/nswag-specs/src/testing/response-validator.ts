/**
 * 응답 검증기
 * OpenAPI 스펙에 따른 응답 검증
 */

import type {
  ResponseData,
  RequestMetadata,
  ExtendedMetadata,
  Schema,
  Response,
} from '../types/index.js';

/**
 * 검증 결과
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 응답 검증기 클래스
 * OpenAPI 스펙에 정의된 응답 스키마와 실제 응답 비교
 */
export class ResponseValidator {
  /**
   * 응답 검증
   */
  validate(
    metadata: RequestMetadata,
    response: ResponseData,
    responseTime: number,
  ): ExtendedMetadata {
    const errors: string[] = [];
    let valid = true;

    // 상태 코드 검증
    const statusCode = String(response.statusCode);
    const expectedResponses = metadata.responses ?? {};

    if (!expectedResponses[statusCode] && !expectedResponses['default']) {
      // 정의되지 않은 상태 코드는 경고만 (엄격 모드가 아닌 경우)
      if (Object.keys(expectedResponses).length > 0) {
        errors.push(
          `예상하지 않은 상태 코드: ${statusCode}. 정의된 상태 코드: ${Object.keys(expectedResponses).join(', ')}`,
        );
      }
    }

    // 응답 스키마 검증
    const expectedResponse = expectedResponses[statusCode] ?? expectedResponses['default'];
    if (expectedResponse?.content) {
      const contentType = this.getContentType(response.headers);
      const mediaType = expectedResponse.content[contentType] ?? expectedResponse.content['*/*'];

      if (mediaType?.schema) {
        const schemaValidation = this.validateSchema(
          this.parseBody(response.body),
          mediaType.schema,
        );
        if (!schemaValidation.valid) {
          valid = false;
          errors.push(...schemaValidation.errors);
        }
      }
    }

    return {
      ...metadata,
      actualStatusCode: response.statusCode,
      responseTime,
      validated: valid,
      validationErrors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 스키마 검증 (기본 구현)
   */
  private validateSchema(data: unknown, schema: Schema): ValidationResult {
    const errors: string[] = [];

    // 타입 검증
    if (schema.type) {
      const actualType = this.getType(data);
      if (actualType !== schema.type && schema.type !== 'any') {
        // nullable 체크
        if (!(data === null && schema.nullable)) {
          errors.push(`타입 불일치: 예상 ${schema.type}, 실제 ${actualType}`);
        }
      }
    }

    // 객체 속성 검증
    if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;

      // 필수 속성 검증
      if (schema.required) {
        for (const requiredProp of schema.required) {
          if (!(requiredProp in obj)) {
            errors.push(`필수 속성 누락: ${requiredProp}`);
          }
        }
      }

      // 각 속성 검증
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          const propValidation = this.validateSchema(obj[key], propSchema);
          if (!propValidation.valid) {
            errors.push(...propValidation.errors.map((e) => `${key}: ${e}`));
          }
        }
      }
    }

    // 배열 검증
    if (schema.type === 'array' && schema.items && Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        const itemValidation = this.validateSchema(data[i], schema.items);
        if (!itemValidation.valid) {
          errors.push(...itemValidation.errors.map((e) => `[${i}]: ${e}`));
        }
      }
    }

    // enum 검증
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push(`enum 값 불일치: ${String(data)}은(는) 허용된 값이 아닙니다`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * JavaScript 타입을 OpenAPI 타입으로 변환
   */
  private getType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'number';
    }
    return typeof value;
  }

  /**
   * Content-Type 헤더 추출
   */
  private getContentType(headers: Record<string, string>): string {
    const contentType =
      headers['content-type'] ?? headers['Content-Type'] ?? 'application/json';
    // charset 등 추가 정보 제거
    const parts = contentType.split(';');
    return (parts[0] ?? 'application/json').trim();
  }

  /**
   * 본문 파싱
   */
  private parseBody(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  /**
   * 상태 코드가 정의된 응답에 포함되는지 확인
   */
  isExpectedStatusCode(
    metadata: RequestMetadata,
    statusCode: number,
  ): boolean {
    const responses = metadata.responses ?? {};
    return (
      String(statusCode) in responses ||
      'default' in responses ||
      Object.keys(responses).length === 0
    );
  }

  /**
   * 응답 헤더 검증
   */
  validateHeaders(
    expectedResponse: Response | undefined,
    actualHeaders: Record<string, string>,
  ): ValidationResult {
    const errors: string[] = [];

    if (expectedResponse?.headers) {
      for (const [name, headerDef] of Object.entries(expectedResponse.headers)) {
        if (headerDef.required && !(name.toLowerCase() in actualHeaders)) {
          errors.push(`필수 헤더 누락: ${name}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// 싱글톤 인스턴스
let validatorInstance: ResponseValidator | null = null;

/**
 * 응답 검증기 인스턴스 가져오기
 */
export function getResponseValidator(): ResponseValidator {
  if (!validatorInstance) {
    validatorInstance = new ResponseValidator();
  }
  return validatorInstance;
}

/**
 * 응답 검증기 리셋
 */
export function resetResponseValidator(): void {
  validatorInstance = null;
}
