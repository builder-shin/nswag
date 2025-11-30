/**
 * 스키마 변환기 통합 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  generateSchemaCode,
  generateAllSchemaCode,
  isValidTarget,
  SUPPORTED_TARGETS,
} from '../../src/converter/index.js';
import type { Schema } from '../../src/types/index.js';

describe('Schema Converter Integration', () => {
  describe('generateSchemaCode', () => {
    const testSchema: Schema = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
      required: ['id', 'name'],
    };

    it('should generate Zod code', () => {
      const code = generateSchemaCode(testSchema, 'zod', {
        schemaName: 'TestSchema',
        includeImports: true,
      });

      expect(code).toContain("import { z } from 'zod';");
      expect(code).toContain('z.object({');
      expect(code).toContain('z.number().int()');
      expect(code).toContain('z.string()');
    });

    it('should generate Yup code', () => {
      const code = generateSchemaCode(testSchema, 'yup', {
        schemaName: 'TestSchema',
        includeImports: true,
      });

      expect(code).toContain("import * as yup from 'yup';");
      expect(code).toContain('yup.object({');
      expect(code).toContain('yup.number().integer()');
      expect(code).toContain('yup.string()');
    });

    it('should generate TypeBox code', () => {
      const code = generateSchemaCode(testSchema, 'typebox', {
        schemaName: 'TestSchema',
        includeImports: true,
      });

      expect(code).toContain("import { Type, Static } from '@sinclair/typebox';");
      expect(code).toContain('Type.Object({');
      expect(code).toContain('Type.Integer()');
      expect(code).toContain('Type.String()');
    });

    it('should throw error for invalid target', () => {
      expect(() => {
        generateSchemaCode(testSchema, 'invalid' as 'zod', {});
      }).toThrow('지원하지 않는 대상 라이브러리입니다');
    });
  });

  describe('generateAllSchemaCode', () => {
    const testSchema: Schema = {
      type: 'string',
      format: 'email',
    };

    it('should generate code for all targets', () => {
      const result = generateAllSchemaCode(testSchema, {
        schemaName: 'EmailSchema',
        includeImports: true,
      });

      expect(result.zod).toContain('z.string().email()');
      expect(result.yup).toContain('yup.string().email()');
      expect(result.typebox).toContain("Type.String({ format: 'email' })");
    });

    it('should include all three library codes', () => {
      const result = generateAllSchemaCode({ type: 'boolean' }, {});

      expect(result).toHaveProperty('zod');
      expect(result).toHaveProperty('yup');
      expect(result).toHaveProperty('typebox');
    });
  });

  describe('isValidTarget', () => {
    it('should return true for valid targets', () => {
      expect(isValidTarget('zod')).toBe(true);
      expect(isValidTarget('yup')).toBe(true);
      expect(isValidTarget('typebox')).toBe(true);
    });

    it('should return false for invalid targets', () => {
      expect(isValidTarget('invalid')).toBe(false);
      expect(isValidTarget('')).toBe(false);
      expect(isValidTarget(null)).toBe(false);
      expect(isValidTarget(undefined)).toBe(false);
      expect(isValidTarget(123)).toBe(false);
    });
  });

  describe('SUPPORTED_TARGETS', () => {
    it('should contain all supported library targets', () => {
      expect(SUPPORTED_TARGETS).toContain('zod');
      expect(SUPPORTED_TARGETS).toContain('yup');
      expect(SUPPORTED_TARGETS).toContain('typebox');
      expect(SUPPORTED_TARGETS).toHaveLength(3);
    });
  });

  describe('Consistent behavior across targets', () => {
    const complexSchema: Schema = {
      type: 'object',
      properties: {
        id: { type: 'integer', minimum: 1 },
        email: { type: 'string', format: 'email' },
        tags: { type: 'array', items: { type: 'string' } },
        isActive: { type: 'boolean' },
      },
      required: ['id', 'email'],
    };

    it('should handle object with required fields consistently', () => {
      const zodCode = generateSchemaCode(complexSchema, 'zod', { schemaName: 'Schema' });
      const yupCode = generateSchemaCode(complexSchema, 'yup', { schemaName: 'Schema' });
      const typeboxCode = generateSchemaCode(complexSchema, 'typebox', { schemaName: 'Schema' });

      // 모든 타겟에서 id는 필수
      expect(zodCode).not.toContain('id: z.number().int().optional()');
      expect(yupCode).toContain('id: yup.number().integer().min(1).required()');
      expect(typeboxCode).toContain('id: Type.Integer(');

      // 모든 타겟에서 tags는 선택적
      expect(zodCode).toContain('optional()');
      expect(yupCode).not.toContain('tags: yup.array().of(yup.string()).required()');
      expect(typeboxCode).toContain('tags: Type.Optional(');
    });

    it('should handle array constraints consistently', () => {
      const arraySchema: Schema = {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 10,
      };

      const zodCode = generateSchemaCode(arraySchema, 'zod', { schemaName: 'ArraySchema' });
      const yupCode = generateSchemaCode(arraySchema, 'yup', { schemaName: 'ArraySchema' });
      const typeboxCode = generateSchemaCode(arraySchema, 'typebox', { schemaName: 'ArraySchema' });

      // 모든 타겟에서 배열 길이 제약조건 포함
      expect(zodCode).toContain('.min(1)');
      expect(zodCode).toContain('.max(10)');
      expect(yupCode).toContain('.min(1)');
      expect(yupCode).toContain('.max(10)');
      expect(typeboxCode).toContain('minItems: 1');
      expect(typeboxCode).toContain('maxItems: 10');
    });

    it('should handle enum consistently', () => {
      const enumSchema: Schema = {
        type: 'string',
        enum: ['a', 'b', 'c'],
      };

      const zodCode = generateSchemaCode(enumSchema, 'zod', { schemaName: 'EnumSchema' });
      const yupCode = generateSchemaCode(enumSchema, 'yup', { schemaName: 'EnumSchema' });
      const typeboxCode = generateSchemaCode(enumSchema, 'typebox', { schemaName: 'EnumSchema' });

      // 모든 타겟에서 enum 값 포함
      expect(zodCode).toContain("'a'");
      expect(zodCode).toContain("'b'");
      expect(zodCode).toContain("'c'");
      expect(yupCode).toContain("'a'");
      expect(yupCode).toContain("'b'");
      expect(yupCode).toContain("'c'");
      expect(typeboxCode).toContain("'a'");
      expect(typeboxCode).toContain("'b'");
      expect(typeboxCode).toContain("'c'");
    });
  });

  describe('Type inference generation', () => {
    const schema: Schema = { type: 'string' };

    it('should generate type inference for Zod', () => {
      const code = generateSchemaCode(schema, 'zod', {
        schemaName: 'TestSchema',
        generateTypeInference: true,
      });

      expect(code).toContain('type Test = z.infer<typeof TestSchema>');
    });

    it('should generate type inference for Yup', () => {
      const code = generateSchemaCode(schema, 'yup', {
        schemaName: 'testSchema',
        generateTypeInference: true,
      });

      expect(code).toContain('type Test = yup.InferType<typeof testSchema>');
    });

    it('should generate type inference for TypeBox', () => {
      const code = generateSchemaCode(schema, 'typebox', {
        schemaName: 'TestSchema',
        generateTypeInference: true,
      });

      expect(code).toContain('type Test = Static<typeof TestSchema>');
    });

    it('should not generate type inference when disabled', () => {
      const zodCode = generateSchemaCode(schema, 'zod', {
        schemaName: 'TestSchema',
        generateTypeInference: false,
      });

      expect(zodCode).not.toContain('type Test');
      expect(zodCode).not.toContain('z.infer');
    });
  });

  describe('Export options', () => {
    const schema: Schema = { type: 'number' };

    it('should export by default', () => {
      const code = generateSchemaCode(schema, 'zod', { schemaName: 'Test' });
      expect(code).toContain('export const');
    });

    it('should not export when disabled', () => {
      const code = generateSchemaCode(schema, 'zod', {
        schemaName: 'Test',
        exportSchema: false,
      });
      expect(code).not.toContain('export');
    });
  });
});
