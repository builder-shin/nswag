/**
 * Mock 모듈
 * 테스트를 위한 Mock 데이터 생성 및 Mock 서버
 */

import type { Schema } from '../types/index.js';

// Mock 서버 re-export
export { createMockServer } from './server.js';

/**
 * 스키마 기반 Mock 데이터 생성기
 */
export class MockGenerator {
  /**
   * 스키마를 기반으로 Mock 데이터 생성
   *
   * @param schema - OpenAPI 스키마
   * @returns Mock 데이터
   */
  generate(schema: Schema): unknown {
    if (schema.$ref) {
      // $ref는 외부에서 해결되어야 함
      return {};
    }

    switch (schema.type) {
      case 'string':
        return this.generateString(schema);
      case 'number':
      case 'integer':
        return this.generateNumber(schema);
      case 'boolean':
        return Math.random() > 0.5;
      case 'array':
        return this.generateArray(schema);
      case 'object':
        return this.generateObject(schema);
      default:
        return null;
    }
  }

  private generateString(schema: Schema): string {
    if (schema.enum && schema.enum.length > 0) {
      const index = Math.floor(Math.random() * schema.enum.length);
      return String(schema.enum[index]);
    }

    switch (schema.format) {
      case 'email':
        return 'user@example.com';
      case 'uri':
      case 'url':
        return 'https://example.com';
      case 'uuid':
        return '550e8400-e29b-41d4-a716-446655440000';
      case 'date':
        return '2024-01-01';
      case 'date-time':
        return '2024-01-01T00:00:00Z';
      default:
        return 'string';
    }
  }

  private generateNumber(schema: Schema): number {
    if (schema.enum && schema.enum.length > 0) {
      const index = Math.floor(Math.random() * schema.enum.length);
      return Number(schema.enum[index]);
    }

    if (schema.type === 'integer') {
      return Math.floor(Math.random() * 100);
    }

    return Math.random() * 100;
  }

  private generateArray(schema: Schema): unknown[] {
    if (!schema.items) return [];

    const length = Math.floor(Math.random() * 3) + 1;
    return Array.from({ length }, () => this.generate(schema.items!));
  }

  private generateObject(schema: Schema): Record<string, unknown> {
    if (!schema.properties) return {};

    const result: Record<string, unknown> = {};

    for (const [key, propSchema] of Object.entries(schema.properties)) {
      result[key] = this.generate(propSchema);
    }

    return result;
  }
}

/**
 * 기본 Mock 생성기 인스턴스
 */
export const mockGenerator = new MockGenerator();

/**
 * 스키마 기반 Mock 데이터 생성 헬퍼
 */
export function generateMock(schema: Schema): unknown {
  return mockGenerator.generate(schema);
}
