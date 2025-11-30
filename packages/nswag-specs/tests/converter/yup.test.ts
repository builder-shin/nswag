/**
 * Yup converter tests
 */

import { describe, it, expect } from 'vitest';
import { generateYupCode } from '../../src/converter/yup.js';
import type { Schema } from '../../src/types/index.js';

describe('Yup Converter', () => {
  describe('generateYupCode', () => {
    it('should convert string schema', () => {
      const schema: Schema = { type: 'string' };
      const code = generateYupCode(schema, { schemaName: 'testSchema', includeImports: false });

      expect(code).toContain('const testSchema = yup.string()');
    });

    it('should convert string schema with format email', () => {
      const schema: Schema = { type: 'string', format: 'email' };
      const code = generateYupCode(schema, { schemaName: 'emailSchema', includeImports: false });

      expect(code).toContain('yup.string().email()');
    });

    it('should convert string schema with minLength and maxLength', () => {
      const schema: Schema = { type: 'string', minLength: 1, maxLength: 100 };
      const code = generateYupCode(schema, { schemaName: 'stringSchema', includeImports: false });

      expect(code).toContain('.min(1)');
      expect(code).toContain('.max(100)');
    });

    it('should convert string schema with pattern', () => {
      const schema: Schema = { type: 'string', pattern: '^[a-z]+$' };
      const code = generateYupCode(schema, { schemaName: 'patternSchema', includeImports: false });

      expect(code).toContain('.matches(/^[a-z]+$/)');
    });

    it('should convert number schema', () => {
      const schema: Schema = { type: 'number' };
      const code = generateYupCode(schema, { schemaName: 'numberSchema', includeImports: false });

      expect(code).toContain('yup.number()');
    });

    it('should convert number schema with constraints', () => {
      const schema: Schema = { type: 'number', minimum: 0, maximum: 100 };
      const code = generateYupCode(schema, { schemaName: 'numberSchema', includeImports: false });

      expect(code).toContain('.min(0)');
      expect(code).toContain('.max(100)');
    });

    it('should convert integer schema', () => {
      const schema: Schema = { type: 'integer' };
      const code = generateYupCode(schema, { schemaName: 'intSchema', includeImports: false });

      expect(code).toContain('yup.number().integer()');
    });

    it('should convert integer schema with exclusiveMinimum and exclusiveMaximum', () => {
      const schema: Schema = { type: 'integer', exclusiveMinimum: 0, exclusiveMaximum: 100 };
      const code = generateYupCode(schema, { schemaName: 'intSchema', includeImports: false });

      expect(code).toContain('.moreThan(0)');
      expect(code).toContain('.lessThan(100)');
    });

    it('should convert boolean schema', () => {
      const schema: Schema = { type: 'boolean' };
      const code = generateYupCode(schema, { schemaName: 'boolSchema', includeImports: false });

      expect(code).toContain('yup.boolean()');
    });

    it('should convert null schema', () => {
      const schema: Schema = { type: 'null' };
      const code = generateYupCode(schema, { schemaName: 'nullSchema', includeImports: false });

      expect(code).toContain('yup.mixed().nullable()');
    });

    it('should convert array schema', () => {
      const schema: Schema = { type: 'array', items: { type: 'string' } };
      const code = generateYupCode(schema, { schemaName: 'arraySchema', includeImports: false });

      expect(code).toContain('yup.array().of(yup.string())');
    });

    it('should convert array schema with minItems and maxItems', () => {
      const schema: Schema = {
        type: 'array',
        items: { type: 'number' },
        minItems: 1,
        maxItems: 10,
      };
      const code = generateYupCode(schema, { schemaName: 'arraySchema', includeImports: false });

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
      const code = generateYupCode(schema, { schemaName: 'userSchema', includeImports: false });

      expect(code).toContain('yup.object({');
      expect(code).toContain('id: yup.number().integer().required()');
      expect(code).toContain('name: yup.string().required()');
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
      const code = generateYupCode(schema, { schemaName: 'userSchema', includeImports: false });

      expect(code).toContain('id: yup.number().integer().required()');
      expect(code).not.toContain('nickname: yup.string().required()');
    });

    it('should handle nullable types', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          email: { type: 'string', nullable: true },
        },
        required: ['email'],
      };
      const code = generateYupCode(schema, { schemaName: 'schema', includeImports: false });

      expect(code).toContain('.nullable()');
    });

    it('should handle enum types', () => {
      const schema: Schema = {
        type: 'string',
        enum: ['admin', 'user', 'guest'],
      };
      const code = generateYupCode(schema, { schemaName: 'roleSchema', includeImports: false });

      expect(code).toContain("yup.string().oneOf(['admin', 'user', 'guest'])");
    });

    it('should handle default values', () => {
      const schema: Schema = {
        type: 'object',
        properties: {
          count: { type: 'integer', default: 0 },
          name: { type: 'string', default: 'unknown' },
        },
      };
      const code = generateYupCode(schema, { schemaName: 'schema', includeImports: false });

      expect(code).toContain(".default(0)");
      expect(code).toContain(".default('unknown')");
    });

    it('should include imports when requested', () => {
      const schema: Schema = { type: 'string' };
      const code = generateYupCode(schema, { schemaName: 'testSchema', includeImports: true });

      expect(code).toContain("import * as yup from 'yup';");
    });

    it('should generate type inference', () => {
      const schema: Schema = { type: 'string' };
      const code = generateYupCode(schema, {
        schemaName: 'testSchema',
        includeImports: false,
        generateTypeInference: true,
      });

      expect(code).toContain('type Test = yup.InferType<typeof testSchema>;');
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
      const code = generateYupCode(schema, { schemaName: 'nestedSchema', includeImports: false });

      expect(code).toContain('user: yup.object({');
      expect(code).toContain('profile: yup.object({');
      expect(code).toContain('name: yup.string()');
    });

    it('should handle string format uri', () => {
      const schema: Schema = { type: 'string', format: 'uri' };
      const code = generateYupCode(schema, { schemaName: 'uriSchema', includeImports: false });

      expect(code).toContain('.url()');
    });

    it('should handle string format uuid', () => {
      const schema: Schema = { type: 'string', format: 'uuid' };
      const code = generateYupCode(schema, { schemaName: 'uuidSchema', includeImports: false });

      expect(code).toContain('.uuid()');
    });

    it('should handle string format ipv4', () => {
      const schema: Schema = { type: 'string', format: 'ipv4' };
      const code = generateYupCode(schema, { schemaName: 'ipSchema', includeImports: false });

      expect(code).toContain('.matches(');
    });

    it('should use noUnknown for additionalProperties false', () => {
      const schema: Schema = {
        type: 'object',
        properties: { id: { type: 'integer' } },
      };
      const code = generateYupCode(schema, {
        schemaName: 'schema',
        includeImports: false,
        additionalProperties: false,
      });

      expect(code).toContain('.noUnknown()');
    });

    it('should not use noUnknown for additionalProperties true', () => {
      const schema: Schema = {
        type: 'object',
        properties: { id: { type: 'integer' } },
      };
      const code = generateYupCode(schema, {
        schemaName: 'schema',
        includeImports: false,
        additionalProperties: true,
      });

      expect(code).not.toContain('.noUnknown()');
    });

    it('should use strict mode when enabled', () => {
      const schema: Schema = {
        type: 'object',
        properties: { id: { type: 'integer' } },
      };
      const code = generateYupCode(schema, {
        schemaName: 'schema',
        includeImports: false,
        strict: true,
      });

      expect(code).toContain('.strict()');
    });

    it('should not export when exportSchema is false', () => {
      const schema: Schema = { type: 'string' };
      const code = generateYupCode(schema, {
        schemaName: 'testSchema',
        includeImports: false,
        exportSchema: false,
      });

      expect(code).not.toContain('export');
    });

    it('should use camelCase for schema names', () => {
      const schema: Schema = { type: 'string' };
      const code = generateYupCode(schema, {
        schemaName: 'UserSchema',
        includeImports: false,
      });

      expect(code).toContain('const userSchema =');
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

      const code = generateYupCode(schema, {
        schemaName: 'userSchema',
        includeImports: true,
      });

      expect(code).toContain("import * as yup from 'yup';");
      expect(code).toContain('export const userSchema = yup.object({');
      expect(code).toContain('id: yup.number().integer().required()');
      expect(code).toContain('email: yup.string().email().required()');
      expect(code).toContain('name: yup.string().min(1).max(100).required()');
      expect(code).toContain("role: yup.string().oneOf(['admin', 'user', 'guest'])");
      expect(code).toContain('age: yup.number().integer().min(0).max(150)');
      expect(code).toContain('type User = yup.InferType<typeof userSchema>;');
    });
  });
});
