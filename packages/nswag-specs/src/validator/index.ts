/**
 * Validator module
 * JSON Schema based response validation
 */

import * as AjvModule from 'ajv';
import type { Schema } from '../types/index.js';

// Extract Ajv class for ESM/CJS compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AjvConstructor = (AjvModule as any).default ?? AjvModule;

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[] | null;
}

/**
 * Validation error interface
 */
export interface ValidationError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
}

/**
 * JSON Schema validator
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
   * Compile and cache schema
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
   * Validate data against schema
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
   * Clear cached validators
   */
  clear(): void {
    this.validators.clear();
  }
}

/**
 * Default validator instance
 */
export const defaultValidator = new SchemaValidator();
