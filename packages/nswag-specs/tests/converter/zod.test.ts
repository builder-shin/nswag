/**
 * Zod 변환기 테스트
 */

import { describe, it, expect } from 'vitest';
import { generateZodCode } from '../../src/converter/zod.js';
import type { Schema } from '../../src/types/index.js';

describe('Zod Converter', () => {
  describe('generateZodCode', () => {
    it('should convert string schema', () => {
      const schema: Schema = { type: 'string' };
      const code = generateZodCode(schema, { schemaName: 'TestSchema', includeImports: false });

      expect(code).toContain('const TestSchema = z.string()');
    });

    it('should convert string schema with format email', () => {
      const schema: Schema = { type: 'string', format: 'email' };
      const code = generateZodCode(schema, { schemaName: 'EmailSchema', includeImports: false });

      expect(code).toContain('z.string().email()');
    });

    it('should convert string schema with minLength and maxLength', () => {
      const schema: Schema = { type: 'string', minLength: 1, maxLength: 100 };
      const code = generateZodCode(schema, { schemaName: 'StringSchema', includeImports: false });

      expect(code).toContain('.min(1)');
      expect(code).toContain('.max(100)');
    });

    it('should convert string schema with pattern', () => {
      const schema: Schema = { type: 'string', pattern: '^[a-z]+$' };
      const code = generateZodCode(schema, { schemaName: 'PatternSchema', includeImports: false });

      expect(code).toContain('.regex(/^[a-z]+$/)');
    });

    it('should convert number schema', () => {
      const schema: Schema = { type: 'number' };
      const code = generateZodCode(schema, { schemaName: 'NumberSchema', includeImports: false });

      expect(code).toContain('z.number()');
    });

    it('should convert number schema with constraints', () => {
      const schema: Schema = { type: 'number', minimum: 0, maximum: 100 };
      const code = generateZodCode(schema, { schemaName: 'NumberSchema', includeImports: false });

      expect(code).toContain('.gte(0)');
      expect(code).toContain('.lte(100)');
    });

    it('should convert integer schema', () => {
      const schema: Schema = { type: 'integer' };
      const code = generateZodCode(schema, { schemaName: 'IntSchema', includeImports: false });

      expect(code).toContain('z.number().int()');
    });

    it('should convert integer schema with exclusiveMinimum and exclusiveMaximum', () => {
      const schema: Schema = { type: 'integer', exclusiveMinimum: 0, exclusiveMaximum: 100 };
      const code = generateZodCode(schema, { schemaName: 'IntSchema', includeImports: false });

      expect(code).toContain('.gt(0)');
      expect(code).toContain('.lt(100)');
    });

    it('should convert number schema with multipleOf', () => {
      const schema: Schema = { type: 'number', multipleOf: 5 };
      const code = generateZodCode(schema, { schemaName: 'MultipleSchema', includeImports: false });

      expect(code).toContain('.multipleOf(5)');
    });

    it('should convert boolean schema', () => {
      const schema: Schema = { type: 'boolean' };
      const code = generateZodCode(schema, { schemaName: 'BoolSchema', includeImports: false });

      expect(code).toContain('z.boolean()');
    });

    it('should convert null schema', () => {
      const schema: Schema = { type: 'null' };
      const code = generateZodCode(schema, { schemaName: 'NullSchema', includeImports: false });

      expect(code).toContain('z.null()');
    });

    it('should convert array schema', () => {
      const schema: Schema = { type: 'array', items: { type: 'string' } };
      const code = generateZodCode(schema, { schemaName: 'ArraySchema', includeImports: false });

      expect(code).toContain('z.array(z.string())');
    });

    it('should convert array schema with minItems and maxItems', () => {
      const schema: Schema = {
        type: 'array',
        items: { type: 'number' },
        minItems: 1,
        maxItems: 10,
      };
      const code = generateZodCode(schema, { schemaName: 'ArraySchema', includeImports: false });

      expect(code).toContain('.min(1)');
      expect(code).toContain('.max(10)');
    });

    it('should convert object schema with required properties', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
        required: ['id', 'name'],
      };
      const code = generateZodCode(schema, { schemaName: 'UserSchema', includeImports: false });

      expect(code).toContain('z.object({');
      expect(code).toContain('id: z.number().int()');
      expect(code).toContain('name: z.string()');
      expect(code).not.toContain('.optional()');
    });

    it('should convert object schema with optional properties', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nickname: { type: 'string' },
        },
        required: ['id'],
      };
      const code = generateZodCode(schema, { schemaName: 'UserSchema', includeImports: false });

      expect(code).toContain('id: z.number().int()');
      expect(code).toContain('nickname: z.string().optional()');
    });

    it('should handle nullable types', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          email: { type: 'string', nullable: true },
        },
        required: ['email'],
      };
      const code = generateZodCode(schema, { schemaName: 'Schema', includeImports: false });

      expect(code).toContain('.nullable()');
    });

    it('should handle enum types', () => {
      const schema: Schema = {
        type: 'string',
        enum: ['admin', 'user', 'guest'],
      };
      const code = generateZodCode(schema, { schemaName: 'RoleSchema', includeImports: false });

      expect(code).toContain("z.enum(['admin', 'user', 'guest'])");
    });

    it('should handle single enum value as literal', () => {
      const schema: Schema = {
        type: 'string',
        enum: ['active'],
      };
      const code = generateZodCode(schema, { schemaName: 'StatusSchema', includeImports: false });

      expect(code).toContain("z.literal('active')");
    });

    it('should handle oneOf composition', () => {
      const schema: Schema = {
        oneOf: [
          { type: 'string' },
          { type: 'number' },
        ],
      };
      const code = generateZodCode(schema, { schemaName: 'UnionSchema', includeImports: false });

      expect(code).toContain('z.union([z.string(), z.number()])');
    });

    it('should handle anyOf composition', () => {
      const schema: Schema = {
        anyOf: [
          { type: 'string' },
          { type: 'boolean' },
        ],
      };
      const code = generateZodCode(schema, { schemaName: 'AnySchema', includeImports: false });

      expect(code).toContain('z.union([z.string(), z.boolean()])');
    });

    it('should handle allOf composition', () => {
      const schema: Schema = {
        allOf: [
          { type: 'object', properties: { id: { type: 'integer' } } },
          { type: 'object', properties: { name: { type: 'string' } } },
        ],
      };
      const code = generateZodCode(schema, { schemaName: 'MergedSchema', includeImports: false });

      // allOf는 병합된 객체로 변환됨
      expect(code).toContain('z.object(');
    });

    it('should handle default values', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          count: { type: 'integer', default: 0 },
          name: { type: 'string', default: 'unknown' },
        },
      };
      const code = generateZodCode(schema, { schemaName: 'Schema', includeImports: false });

      expect(code).toContain(".default(0)");
      expect(code).toContain(".default('unknown')");
    });

    it('should include imports when requested', () => {
      const schema: Schema = { type: 'string' };
      const code = generateZodCode(schema, { schemaName: 'TestSchema', includeImports: true });

      expect(code).toContain("import { z } from 'zod';");
    });

    it('should generate type inference', () => {
      const schema: Schema = { type: 'string' };
      const code = generateZodCode(schema, {
        schemaName: 'TestSchema',
        includeImports: false,
        generateTypeInference: true,
      });

      expect(code).toContain('type Test = z.infer<typeof TestSchema>;');
    });

    it('should handle nested objects', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      };
      const code = generateZodCode(schema, { schemaName: 'NestedSchema', includeImports: false });

      expect(code).toContain('user: z.object({');
      expect(code).toContain('profile: z.object({');
      expect(code).toContain('name: z.string()');
    });

    it('should handle string format uri', () => {
      const schema: Schema = { type: 'string', format: 'uri' };
      const code = generateZodCode(schema, { schemaName: 'UriSchema', includeImports: false });

      expect(code).toContain('.url()');
    });

    it('should handle string format uuid', () => {
      const schema: Schema = { type: 'string', format: 'uuid' };
      const code = generateZodCode(schema, { schemaName: 'UuidSchema', includeImports: false });

      expect(code).toContain('.uuid()');
    });

    it('should handle string format date-time', () => {
      const schema: Schema = { type: 'string', format: 'date-time' };
      const code = generateZodCode(schema, { schemaName: 'DateTimeSchema', includeImports: false });

      expect(code).toContain('.datetime()');
    });

    it('should use passthrough for additionalProperties true', () => {
      const schema: Schema = {
        type: 'object',
        properties: { id: { type: 'integer' } },
      };
      const code = generateZodCode(schema, {
        schemaName: 'Schema',
        includeImports: false,
        additionalProperties: true,
      });

      expect(code).toContain('.passthrough()');
    });

    it('should not use passthrough for additionalProperties false', () => {
      const schema: Schema = {
        type: 'object',
        properties: { id: { type: 'integer' } },
      };
      const code = generateZodCode(schema, {
        schemaName: 'Schema',
        includeImports: false,
        additionalProperties: false,
      });

      expect(code).not.toContain('.passthrough()');
    });

    it('should use strict mode when enabled', () => {
      const schema: Schema = {
        type: 'object',
        properties: { id: { type: 'integer' } },
      };
      const code = generateZodCode(schema, {
        schemaName: 'Schema',
        includeImports: false,
        additionalProperties: false,
        strict: true,
      });

      expect(code).toContain('.strict()');
    });

    it('should not export when exportSchema is false', () => {
      const schema: Schema = { type: 'string' };
      const code = generateZodCode(schema, {
        schemaName: 'TestSchema',
        includeImports: false,
        exportSchema: false,
      });

      expect(code).not.toContain('export');
    });

    it('should handle complex real-world schema', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          role: { type: 'string', enum: ['admin', 'user', 'guest'] },
          age: { type: 'integer', minimum: 0, maximum: 150 },
          tags: { type: 'array', items: { type: 'string' }, minItems: 0, maxItems: 10 },
          metadata: { type: 'object', properties: { key: { type: 'string' } } },
        },
        required: ['id', 'email', 'name'],
      };

      const code = generateZodCode(schema, {
        schemaName: 'UserSchema',
        includeImports: true,
      });

      expect(code).toContain("import { z } from 'zod';");
      expect(code).toContain('export const UserSchema = z.object({');
      expect(code).toContain('id: z.number().int()');
      expect(code).toContain('email: z.string().email()');
      expect(code).toContain('name: z.string().min(1).max(100)');
      expect(code).toContain("role: z.enum(['admin', 'user', 'guest']).optional()");
      expect(code).toContain('age: z.number().int().gte(0).lte(150).optional()');
      expect(code).toContain('type User = z.infer<typeof UserSchema>;');
    });
  });
});
