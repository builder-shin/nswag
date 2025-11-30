/**
 * Schema converter common type definitions
 * Types for bidirectional conversion between OpenAPI JSON Schema and runtime schema validation libraries
 */

import type { Schema, OpenAPISpec } from '../types/index.js';

/**
 * Conversion options
 * Common options that can be used during schema conversion
 */
export interface ConvertOptions {
  /**
   * Nullable handling method
   * - 'optional': Treat schema as optional (Zod: .optional())
   * - 'null': Allow null values (Zod: .nullable())
   * - 'nullish': Allow undefined or null (Zod: .nullish())
   * @default 'null'
   */
  nullable?: 'optional' | 'null' | 'nullish';

  /**
   * Allow additional properties
   * If false, reject undefined properties
   * @default true
   */
  additionalProperties?: boolean;

  /**
   * Required properties default
   * If true, treat all properties as required
   * @default false
   */
  defaultRequired?: boolean;

  /**
   * Include import statements in code generation
   * @default true
   */
  includeImports?: boolean;

  /**
   * Schema name (for code generation)
   * Used as schema variable name in generated code
   */
  schemaName?: string;

  /**
   * Export schema
   * If true, generate as 'export const' form
   * @default true
   */
  exportSchema?: boolean;

  /**
   * Generate type inference (TypeBox only)
   * If true, also generate Static<typeof Schema> type
   * @default true
   */
  generateTypeInference?: boolean;

  /**
   * Root spec for resolving $ref references
   * Required when converting schemas containing $ref
   */
  rootSpec?: OpenAPISpec;

  /**
   * Reference schema definition map
   * Schema definitions to use when resolving $ref
   */
  definitions?: Record<string, Schema>;

  /**
   * Indentation string for code generation
   * @default '  ' (2 spaces)
   */
  indent?: string;

  /**
   * Use strict mode
   * If true, apply stricter validation
   * @default false
   */
  strict?: boolean;
}

/**
 * Conversion result
 * Contains runtime schema object and related metadata
 *
 * @template T - Runtime schema type (ZodSchema, YupSchema, TSchema, etc.)
 */
export interface ConvertResult<T> {
  /**
   * Runtime schema object
   * Schema instance that can be used for actual validation
   */
  schema: T;

  /**
   * TypeScript code string (for code generation)
   * Used when saving generated schema to file
   */
  code?: string;

  /**
   * Warning messages (unsupported features, etc.)
   * Non-fatal issues that occurred during conversion
   */
  warnings?: string[];
}

/**
 * Code generation result
 * Contains schema code and related metadata
 */
export interface CodeGenerationResult {
  /**
   * Generated TypeScript code
   */
  code: string;

  /**
   * Used import statements
   */
  imports: string[];

  /**
   * Warning messages
   */
  warnings: string[];
}

/**
 * Supported target libraries
 */
export type TargetLibrary = 'zod' | 'yup' | 'typebox';

/**
 * OpenAPI schema type
 * Values that can be used in type field
 */
export type OpenAPISchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

/**
 * OpenAPI string format type
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
 * OpenAPI number format type
 */
export type OpenAPINumberFormat = 'int32' | 'int64' | 'float' | 'double';

/**
 * Converter interface
 * Common interface that each library-specific converter must implement
 *
 * @template T - Runtime schema type
 */
export interface SchemaConverter<T> {
  /**
   * Convert OpenAPI schema to runtime schema
   *
   * @param schema - OpenAPI schema
   * @param options - Conversion options
   * @returns Conversion result
   */
  fromOpenAPI(schema: Schema, options?: ConvertOptions): ConvertResult<T>;

  /**
   * Convert runtime schema to OpenAPI schema
   *
   * @param schema - Runtime schema
   * @returns OpenAPI schema
   */
  toOpenAPI(schema: T): Schema;

  /**
   * Generate TypeScript code from OpenAPI schema
   *
   * @param schema - OpenAPI schema
   * @param options - Conversion options
   * @returns Generated TypeScript code
   */
  generateCode(schema: Schema, options?: ConvertOptions): string;
}

/**
 * Conversion warning type
 */
export type WarningType =
  | 'unsupported-format'
  | 'unsupported-constraint'
  | 'unsupported-type'
  | 'unresolved-ref'
  | 'complex-composition'
  | 'fallback-used';

/**
 * Conversion warning
 */
export interface ConvertWarning {
  /**
   * Warning type
   */
  type: WarningType;

  /**
   * Warning message
   */
  message: string;

  /**
   * Schema path where warning occurred
   */
  path?: string;
}
