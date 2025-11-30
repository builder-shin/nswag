/**
 * Response Validator
 * Validates responses according to OpenAPI specification
 */

import type {
  ResponseData,
  RequestMetadata,
  ExtendedMetadata,
  Schema,
  Response,
} from '../types/index.js';

/**
 * Validation Result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Response Validator Class
 * Compares actual responses with response schemas defined in OpenAPI spec
 */
export class ResponseValidator {
  /**
   * Validate Response
   */
  validate(
    metadata: RequestMetadata,
    response: ResponseData,
    responseTime: number,
  ): ExtendedMetadata {
    const errors: string[] = [];
    let valid = true;

    // Validate status code
    const statusCode = String(response.statusCode);
    const expectedResponses = metadata.responses ?? {};

    if (!expectedResponses[statusCode] && !expectedResponses['default']) {
      // Undefined status codes only warn (when not in strict mode)
      if (Object.keys(expectedResponses).length > 0) {
        errors.push(
          `Unexpected status code: ${statusCode}. Defined status codes: ${Object.keys(expectedResponses).join(', ')}`,
        );
      }
    }

    // Validate response schema
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
   * Validate Schema (basic implementation)
   */
  private validateSchema(data: unknown, schema: Schema): ValidationResult {
    const errors: string[] = [];

    // Validate type
    if (schema.type) {
      const actualType = this.getType(data);
      if (actualType !== schema.type && schema.type !== 'any') {
        // Check nullable
        if (!(data === null && schema.nullable)) {
          errors.push(`Type mismatch: expected ${schema.type}, got ${actualType}`);
        }
      }
    }

    // Validate object properties
    if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;

      // Validate required properties
      if (schema.required) {
        for (const requiredProp of schema.required) {
          if (!(requiredProp in obj)) {
            errors.push(`Missing required property: ${requiredProp}`);
          }
        }
      }

      // Validate each property
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          const propValidation = this.validateSchema(obj[key], propSchema);
          if (!propValidation.valid) {
            errors.push(...propValidation.errors.map((e) => `${key}: ${e}`));
          }
        }
      }
    }

    // Validate array
    if (schema.type === 'array' && schema.items && Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        const itemValidation = this.validateSchema(data[i], schema.items);
        if (!itemValidation.valid) {
          errors.push(...itemValidation.errors.map((e) => `[${i}]: ${e}`));
        }
      }
    }

    // Validate enum
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push(`Enum value mismatch: ${String(data)} is not an allowed value`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert JavaScript Type to OpenAPI Type
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
   * Extract Content-Type Header
   */
  private getContentType(headers: Record<string, string>): string {
    const contentType =
      headers['content-type'] ?? headers['Content-Type'] ?? 'application/json';
    // Remove additional info like charset
    const parts = contentType.split(';');
    return (parts[0] ?? 'application/json').trim();
  }

  /**
   * Parse Body
   */
  private parseBody(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  /**
   * Check if Status Code is Included in Defined Responses
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
   * Validate Response Headers
   */
  validateHeaders(
    expectedResponse: Response | undefined,
    actualHeaders: Record<string, string>,
  ): ValidationResult {
    const errors: string[] = [];

    if (expectedResponse?.headers) {
      for (const [name, headerDef] of Object.entries(expectedResponse.headers)) {
        if (headerDef.required && !(name.toLowerCase() in actualHeaders)) {
          errors.push(`Missing required header: ${name}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
let validatorInstance: ResponseValidator | null = null;

/**
 * Get Response Validator Instance
 */
export function getResponseValidator(): ResponseValidator {
  if (!validatorInstance) {
    validatorInstance = new ResponseValidator();
  }
  return validatorInstance;
}

/**
 * Reset Response Validator
 */
export function resetResponseValidator(): void {
  validatorInstance = null;
}
