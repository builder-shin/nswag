/**
 * Schema converter utility tests
 */

import { describe, it, expect } from 'vitest';
import {
  WarningCollector,
  resolveRef,
  tryResolveRef,
  mergeSchemas,
  normalizeSchemaName,
  escapeString,
  escapeRegexPattern,
  enumToLiterals,
  getSchemaNameFromRef,
  isPrimitiveType,
  isCompositeType,
  isRefType,
  isNullable,
  isRequired,
  FORMAT_VALIDATORS,
} from '../../src/converter/utils.js';
import type { Schema, OpenAPISpec } from '../../src/types/index.js';

describe('Utils', () => {
  describe('WarningCollector', () => {
    it('should collect warnings', () => {
      const collector = new WarningCollector();
      collector.add('unsupported-format', 'Unsupported format');
      collector.addSimple('Simple warning');

      const warnings = collector.getWarnings();
      expect(warnings).toHaveLength(2);
      expect(warnings[0]).toContain('Unsupported format');
      expect(warnings[1]).toContain('Simple warning');
    });

    it('should include path in warning message', () => {
      const collector = new WarningCollector();
      collector.add('unsupported-type', 'Unknown type', 'user.profile.type');

      const warnings = collector.getWarnings();
      expect(warnings[0]).toContain('[user.profile.type]');
    });

    it('should report hasWarnings correctly', () => {
      const collector = new WarningCollector();
      expect(collector.hasWarnings()).toBe(false);

      collector.addSimple('Warning');
      expect(collector.hasWarnings()).toBe(true);
    });

    it('should clear warnings', () => {
      const collector = new WarningCollector();
      collector.addSimple('Warning');
      collector.clear();
      expect(collector.hasWarnings()).toBe(false);
    });

    it('should return detailed warnings', () => {
      const collector = new WarningCollector();
      collector.add('unsupported-format', 'Message', 'path');

      const detailed = collector.getDetailedWarnings();
      expect(detailed[0]).toEqual({
        type: 'unsupported-format',
        message: 'Message',
        path: 'path',
      });
    });
  });

  describe('resolveRef', () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {},
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      },
    };

    it('should resolve valid $ref', () => {
      const resolved = resolveRef('#/components/schemas/User', spec);
      expect(resolved.type).toBe('object');
      expect(resolved.properties).toHaveProperty('id');
    });

    it('should throw for external refs', () => {
      expect(() => resolveRef('http://example.com/schema.json', spec)).toThrow(
        'External references are not supported',
      );
    });

    it('should throw for invalid refs', () => {
      expect(() => resolveRef('#/components/schemas/NonExistent', spec)).toThrow(
        'Cannot find $ref reference',
      );
    });
  });

  describe('tryResolveRef', () => {
    it('should return empty object when rootSpec is undefined', () => {
      const collector = new WarningCollector();
      const result = tryResolveRef('#/components/schemas/User', undefined, collector);

      expect(result).toEqual({});
      expect(collector.hasWarnings()).toBe(true);
    });

    it('should collect warning for invalid ref', () => {
      const collector = new WarningCollector();
      const spec: OpenAPISpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      };

      const result = tryResolveRef('#/components/schemas/Invalid', spec, collector);
      expect(result).toEqual({});
      expect(collector.hasWarnings()).toBe(true);
    });
  });

  describe('mergeSchemas', () => {
    it('should merge properties', () => {
      const base: Schema = {
        type: 'object',
        properties: { id: { type: 'integer' } },
      };
      const override: Schema = {
        properties: { name: { type: 'string' } },
      };

      const merged = mergeSchemas(base, override);
      expect(merged.properties?.id).toBeDefined();
      expect(merged.properties?.name).toBeDefined();
    });

    it('should merge required arrays', () => {
      const base: Schema = { required: ['id'] };
      const override: Schema = { required: ['name', 'id'] };

      const merged = mergeSchemas(base, override);
      expect(merged.required).toContain('id');
      expect(merged.required).toContain('name');
      expect(merged.required).toHaveLength(2);
    });

    it('should override type', () => {
      const base: Schema = { type: 'string' };
      const override: Schema = { type: 'number' };

      const merged = mergeSchemas(base, override);
      expect(merged.type).toBe('number');
    });
  });

  describe('normalizeSchemaName', () => {
    it('should capitalize first letter', () => {
      expect(normalizeSchemaName('user')).toBe('User');
    });

    it('should remove invalid characters', () => {
      expect(normalizeSchemaName('user-schema')).toBe('Userschema');
    });

    it('should add underscore if starts with number', () => {
      expect(normalizeSchemaName('123schema')).toBe('_123schema');
    });

    it('should return Schema for empty string', () => {
      expect(normalizeSchemaName('')).toBe('Schema');
    });
  });

  describe('escapeString', () => {
    it('should escape quotes', () => {
      expect(escapeString("it's")).toBe("it\\'s");
      expect(escapeString('say "hello"')).toBe('say \\"hello\\"');
    });

    it('should escape newlines', () => {
      expect(escapeString('line1\nline2')).toBe('line1\\nline2');
    });

    it('should escape backslashes', () => {
      expect(escapeString('path\\to\\file')).toBe('path\\\\to\\\\file');
    });
  });

  describe('escapeRegexPattern', () => {
    it('should escape backslashes', () => {
      expect(escapeRegexPattern('\\d+')).toBe('\\\\d+');
    });
  });

  describe('enumToLiterals', () => {
    it('should convert string values', () => {
      const result = enumToLiterals(['a', 'b']);
      expect(result).toEqual(["'a'", "'b'"]);
    });

    it('should convert number values', () => {
      const result = enumToLiterals([1, 2, 3]);
      expect(result).toEqual(['1', '2', '3']);
    });

    it('should handle mixed values', () => {
      const result = enumToLiterals(['a', 1, true]);
      expect(result).toEqual(["'a'", '1', 'true']);
    });
  });

  describe('getSchemaNameFromRef', () => {
    it('should extract schema name from ref', () => {
      expect(getSchemaNameFromRef('#/components/schemas/User')).toBe('User');
      expect(getSchemaNameFromRef('#/definitions/Pet')).toBe('Pet');
    });
  });

  describe('isPrimitiveType', () => {
    it('should return true for primitive types', () => {
      expect(isPrimitiveType({ type: 'string' })).toBe(true);
      expect(isPrimitiveType({ type: 'number' })).toBe(true);
      expect(isPrimitiveType({ type: 'integer' })).toBe(true);
      expect(isPrimitiveType({ type: 'boolean' })).toBe(true);
      expect(isPrimitiveType({ type: 'null' })).toBe(true);
    });

    it('should return false for complex types', () => {
      expect(isPrimitiveType({ type: 'object' })).toBe(false);
      expect(isPrimitiveType({ type: 'array' })).toBe(false);
      expect(isPrimitiveType({})).toBe(false);
    });
  });

  describe('isCompositeType', () => {
    it('should return true for composite types', () => {
      expect(isCompositeType({ oneOf: [] })).toBe(true);
      expect(isCompositeType({ anyOf: [] })).toBe(true);
      expect(isCompositeType({ allOf: [] })).toBe(true);
    });

    it('should return false for non-composite types', () => {
      expect(isCompositeType({ type: 'string' })).toBe(false);
      expect(isCompositeType({})).toBe(false);
    });
  });

  describe('isRefType', () => {
    it('should return true for ref types', () => {
      expect(isRefType({ $ref: '#/components/schemas/User' })).toBe(true);
    });

    it('should return false for non-ref types', () => {
      expect(isRefType({ type: 'string' })).toBe(false);
      expect(isRefType({})).toBe(false);
    });
  });

  describe('isNullable', () => {
    it('should return true for nullable schemas', () => {
      expect(isNullable({ type: 'string', nullable: true })).toBe(true);
    });

    it('should return false for non-nullable schemas', () => {
      expect(isNullable({ type: 'string' })).toBe(false);
      expect(isNullable({ type: 'string', nullable: false })).toBe(false);
    });
  });

  describe('isRequired', () => {
    it('should return true for required properties', () => {
      const parent: Schema = { required: ['id', 'name'] };
      expect(isRequired('id', parent)).toBe(true);
      expect(isRequired('name', parent)).toBe(true);
    });

    it('should return false for optional properties', () => {
      const parent: Schema = { required: ['id'] };
      expect(isRequired('email', parent)).toBe(false);
    });

    it('should return false when no required array', () => {
      const parent: Schema = {};
      expect(isRequired('id', parent)).toBe(false);
    });
  });

  describe('FORMAT_VALIDATORS', () => {
    it('should validate email format', () => {
      expect(FORMAT_VALIDATORS.email('test@example.com')).toBe(true);
      expect(FORMAT_VALIDATORS.email('invalid')).toBe(false);
    });

    it('should validate uri format', () => {
      expect(FORMAT_VALIDATORS.uri('https://example.com')).toBe(true);
      expect(FORMAT_VALIDATORS.uri('not-a-url')).toBe(false);
    });

    it('should validate uuid format', () => {
      expect(FORMAT_VALIDATORS.uuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(FORMAT_VALIDATORS.uuid('invalid-uuid')).toBe(false);
    });

    it('should validate date format', () => {
      expect(FORMAT_VALIDATORS.date('2023-12-25')).toBe(true);
      expect(FORMAT_VALIDATORS.date('25-12-2023')).toBe(false);
    });

    it('should validate date-time format', () => {
      expect(FORMAT_VALIDATORS['date-time']('2023-12-25T10:30:00Z')).toBe(true);
      expect(FORMAT_VALIDATORS['date-time']('invalid')).toBe(false);
    });

    it('should validate ipv4 format', () => {
      expect(FORMAT_VALIDATORS.ipv4('192.168.1.1')).toBe(true);
      expect(FORMAT_VALIDATORS.ipv4('256.1.1.1')).toBe(false);
    });
  });
});
