/**
 * TypeBox 변환기 테스트
 */

import { describe, it, expect } from 'vitest';
import { generateTypeBoxCode } from '../../src/converter/typebox.js';
import type { Schema } from '../../src/types/index.js';

describe('TypeBox Converter', () => {
  describe('generateTypeBoxCode', () => {
    it('should convert string schema', () => {
      const schema: Schema = { type: 'string' };
      const code = generateTypeBoxCode(schema, { schemaName: 'TestSchema', includeImports: false });

      expect(code).toContain('const TestSchema = Type.String()');
    });

    it('should convert string schema with format', () => {
      const schema: Schema = { type: 'string', format: 'email' };
      const code = generateTypeBoxCode(schema, { schemaName: 'EmailSchema', includeImports: false });

      expect(code).toContain("Type.String({ format: 'email' })");
    });

    it('should convert string schema with minLength and maxLength', () => {
      const schema: Schema = { type: 'string', minLength: 1, maxLength: 100 };
      const code = generateTypeBoxCode(schema, { schemaName: 'StringSchema', includeImports: false });

      expect(code).toContain('minLength: 1');
      expect(code).toContain('maxLength: 100');
    });

    it('should convert string schema with pattern', () => {
      const schema: Schema = { type: 'string', pattern: '^[a-z]+$' };
      const code = generateTypeBoxCode(schema, { schemaName: 'PatternSchema', includeImports: false });

      expect(code).toContain("pattern: '^[a-z]+$'");
    });

    it('should convert number schema', () => {
      const schema: Schema = { type: 'number' };
      const code = generateTypeBoxCode(schema, { schemaName: 'NumberSchema', includeImports: false });

      expect(code).toContain('Type.Number()');
    });

    it('should convert number schema with constraints', () => {
      const schema: Schema = { type: 'number', minimum: 0, maximum: 100 };
      const code = generateTypeBoxCode(schema, { schemaName: 'NumberSchema', includeImports: false });

      expect(code).toContain('minimum: 0');
      expect(code).toContain('maximum: 100');
    });

    it('should convert integer schema', () => {
      const schema: Schema = { type: 'integer' };
      const code = generateTypeBoxCode(schema, { schemaName: 'IntSchema', includeImports: false });

      expect(code).toContain('Type.Integer()');
    });

    it('should convert integer schema with exclusiveMinimum and exclusiveMaximum', () => {
      const schema: Schema = { type: 'integer', exclusiveMinimum: 0, exclusiveMaximum: 100 };
      const code = generateTypeBoxCode(schema, { schemaName: 'IntSchema', includeImports: false });

      expect(code).toContain('exclusiveMinimum: 0');
      expect(code).toContain('exclusiveMaximum: 100');
    });

    it('should convert number schema with multipleOf', () => {
      const schema: Schema = { type: 'number', multipleOf: 5 };
      const code = generateTypeBoxCode(schema, { schemaName: 'MultipleSchema', includeImports: false });

      expect(code).toContain('multipleOf: 5');
    });

    it('should convert boolean schema', () => {
      const schema: Schema = { type: 'boolean' };
      const code = generateTypeBoxCode(schema, { schemaName: 'BoolSchema', includeImports: false });

      expect(code).toContain('Type.Boolean()');
    });

    it('should convert null schema', () => {
      const schema: Schema = { type: 'null' };
      const code = generateTypeBoxCode(schema, { schemaName: 'NullSchema', includeImports: false });

      expect(code).toContain('Type.Null()');
    });

    it('should convert array schema', () => {
      const schema: Schema = { type: 'array', items: { type: 'string' } };
      const code = generateTypeBoxCode(schema, { schemaName: 'ArraySchema', includeImports: false });

      expect(code).toContain('Type.Array(Type.String())');
    });

    it('should convert array schema with minItems and maxItems', () => {
      const schema: Schema = {
        type: 'array',
        items: { type: 'number' },
        minItems: 1,
        maxItems: 10,
      };
      const code = generateTypeBoxCode(schema, { schemaName: 'ArraySchema', includeImports: false });

      expect(code).toContain('minItems: 1');
      expect(code).toContain('maxItems: 10');
    });

    it('should convert array schema with uniqueItems', () => {
      const schema: Schema = {
        type: 'array',
        items: { type: 'string' },
        uniqueItems: true,
      };
      const code = generateTypeBoxCode(schema, { schemaName: 'ArraySchema', includeImports: false });

      expect(code).toContain('uniqueItems: true');
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
      const code = generateTypeBoxCode(schema, { schemaName: 'UserSchema', includeImports: false });

      expect(code).toContain('Type.Object({');
      expect(code).toContain('id: Type.Integer()');
      expect(code).toContain('name: Type.String()');
      expect(code).not.toContain('Type.Optional(Type.Integer())');
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
      const code = generateTypeBoxCode(schema, { schemaName: 'UserSchema', includeImports: false });

      expect(code).toContain('id: Type.Integer()');
      expect(code).toContain('nickname: Type.Optional(Type.String())');
    });

    it('should handle enum types', () => {
      const schema: Schema = {
        type: 'string',
        enum: ['admin', 'user', 'guest'],
      };
      const code = generateTypeBoxCode(schema, { schemaName: 'RoleSchema', includeImports: false });

      expect(code).toContain("Type.Union([Type.Literal('admin'), Type.Literal('user'), Type.Literal('guest')])");
    });

    it('should handle single enum value as literal', () => {
      const schema: Schema = {
        type: 'string',
        enum: ['active'],
      };
      const code = generateTypeBoxCode(schema, { schemaName: 'StatusSchema', includeImports: false });

      expect(code).toContain("Type.Literal('active')");
    });

    it('should handle oneOf composition', () => {
      const schema: Schema = {
        oneOf: [
          { type: 'string' },
          { type: 'number' },
        ],
      };
      const code = generateTypeBoxCode(schema, { schemaName: 'UnionSchema', includeImports: false });

      expect(code).toContain('Type.Union([Type.String(), Type.Number()])');
    });

    it('should handle anyOf composition', () => {
      const schema: Schema = {
        anyOf: [
          { type: 'string' },
          { type: 'boolean' },
        ],
      };
      const code = generateTypeBoxCode(schema, { schemaName: 'AnySchema', includeImports: false });

      expect(code).toContain('Type.Union([Type.String(), Type.Boolean()])');
    });

    it('should handle allOf composition', () => {
      const schema: Schema = {
        allOf: [
          { type: 'object', properties: { id: { type: 'integer' } } },
          { type: 'object', properties: { name: { type: 'string' } } },
        ],
      };
      const code = generateTypeBoxCode(schema, { schemaName: 'MergedSchema', includeImports: false });

      expect(code).toContain('Type.Intersect([');
    });

    it('should include imports when requested', () => {
      const schema: Schema = { type: 'string' };
      const code = generateTypeBoxCode(schema, { schemaName: 'TestSchema', includeImports: true });

      expect(code).toContain("import { Type, Static } from '@sinclair/typebox';");
    });

    it('should generate type inference', () => {
      const schema: Schema = { type: 'string' };
      const code = generateTypeBoxCode(schema, {
        schemaName: 'TestSchema',
        includeImports: false,
        generateTypeInference: true,
      });

      expect(code).toContain('type Test = Static<typeof TestSchema>;');
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
      const code = generateTypeBoxCode(schema, { schemaName: 'NestedSchema', includeImports: false });

      expect(code).toContain('user: Type.Optional(Type.Object({');
      expect(code).toContain('profile: Type.Optional(Type.Object({');
      expect(code).toContain('name: Type.Optional(Type.String())');
    });

    it('should use additionalProperties false when configured', () => {
      const schema: Schema = {
        type: 'object',
        properties: { id: { type: 'integer' } },
      };
      const code = generateTypeBoxCode(schema, {
        schemaName: 'Schema',
        includeImports: false,
        additionalProperties: false,
      });

      expect(code).toContain('additionalProperties: false');
    });

    it('should not use additionalProperties false by default', () => {
      const schema: Schema = {
        type: 'object',
        properties: { id: { type: 'integer' } },
      };
      const code = generateTypeBoxCode(schema, {
        schemaName: 'Schema',
        includeImports: false,
        additionalProperties: true,
      });

      expect(code).not.toContain('additionalProperties');
    });

    it('should not export when exportSchema is false', () => {
      const schema: Schema = { type: 'string' };
      const code = generateTypeBoxCode(schema, {
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

      const code = generateTypeBoxCode(schema, {
        schemaName: 'UserSchema',
        includeImports: true,
      });

      expect(code).toContain("import { Type, Static } from '@sinclair/typebox';");
      expect(code).toContain('export const UserSchema = Type.Object({');
      expect(code).toContain('id: Type.Integer()');
      expect(code).toContain("email: Type.String({ format: 'email' })");
      expect(code).toContain('name: Type.String({ minLength: 1, maxLength: 100 })');
      expect(code).toContain("Type.Literal('admin')");
      expect(code).toContain('age: Type.Optional(Type.Integer({ minimum: 0, maximum: 150 }))');
      expect(code).toContain('type User = Static<typeof UserSchema>;');
    });

    it('should handle number enum values', () => {
      const schema: Schema = {
        type: 'number',
        enum: [1, 2, 3],
      };
      const code = generateTypeBoxCode(schema, { schemaName: 'NumberEnumSchema', includeImports: false });

      expect(code).toContain('Type.Literal(1)');
      expect(code).toContain('Type.Literal(2)');
      expect(code).toContain('Type.Literal(3)');
    });
  });
});
