/**
 * Mock module
 * Mock data generation and mock server for testing
 */

import type { Schema } from '../types/index.js';

// Mock server re-export
export { createMockServer } from './server.js';

/**
 * Schema-based mock data generator
 */
export class MockGenerator {
  /**
   * Generate mock data based on schema
   *
   * @param schema - OpenAPI schema
   * @returns Mock data
   */
  generate(schema: Schema): unknown {
    if (schema.$ref) {
      // $ref must be resolved externally
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
 * Default mock generator instance
 */
export const mockGenerator = new MockGenerator();

/**
 * Schema-based mock data generation helper
 */
export function generateMock(schema: Schema): unknown {
  return mockGenerator.generate(schema);
}
