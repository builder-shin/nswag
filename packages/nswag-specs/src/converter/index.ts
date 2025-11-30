/**
 * Schema converter main entry point
 * Bidirectional conversion between OpenAPI JSON Schema and runtime schema validation libraries
 *
 * Supported libraries:
 * - Zod: Type-safe schema validation library
 * - Yup: Object schema validation library
 * - TypeBox: JSON Schema compatible type builder
 *
 * @example
 * ```typescript
 * import { convertSchema, generateSchemaCode } from '@aspect/nswag-specs/converter';
 *
 * // Use unified conversion function
 * const result = await convertSchema(openApiSchema, 'zod');
 *
 * // Generate code
 * const code = generateSchemaCode(openApiSchema, 'zod', { schemaName: 'UserSchema' });
 * ```
 */

// Export types
export * from './types.js';

// Export utilities
export {
  WarningCollector,
  resolveRef,
  tryResolveRef,
  processCompositeSchema,
  mergeSchemas,
  FORMAT_VALIDATORS,
  normalizeSchemaName,
  escapeString,
  escapeRegexPattern,
  applyIndent,
  getDefaultOptions,
  isNullable,
  isRequired,
  enumToLiterals,
  getSchemaNameFromRef,
  isPrimitiveType,
  isCompositeType,
  isRefType,
} from './utils.js';

// Export Zod converter
export { openApiToZod, zodToOpenApi, generateZodCode } from './zod.js';

// Export Yup converter
export { openApiToYup, yupToOpenApi, generateYupCode } from './yup.js';

// Export TypeBox converter
export { openApiToTypeBox, typeboxToOpenApi, generateTypeBoxCode } from './typebox.js';

import type { Schema } from '../types/index.js';
import type { ConvertOptions, ConvertResult, TargetLibrary } from './types.js';
import { openApiToZod, generateZodCode } from './zod.js';
import { openApiToYup, generateYupCode } from './yup.js';
import { openApiToTypeBox, generateTypeBoxCode } from './typebox.js';

/**
 * Unified schema conversion function
 * Select appropriate converter based on target library
 *
 * @param schema - OpenAPI schema
 * @param target - Target library ('zod' | 'yup' | 'typebox')
 * @param options - Conversion options
 * @returns Conversion result (runtime schema and warnings)
 *
 * @example
 * ```typescript
 * // Convert to Zod
 * const zodResult = await convertSchema(openApiSchema, 'zod');
 *
 * // Convert to Yup
 * const yupResult = await convertSchema(openApiSchema, 'yup');
 *
 * // Convert to TypeBox
 * const typeboxResult = await convertSchema(openApiSchema, 'typebox');
 * ```
 */
export async function convertSchema(
  schema: Schema,
  target: TargetLibrary,
  options: ConvertOptions = {},
): Promise<ConvertResult<unknown>> {
  switch (target) {
    case 'zod':
      return openApiToZod(schema, options);

    case 'yup':
      return openApiToYup(schema, options);

    case 'typebox':
      return openApiToTypeBox(schema, options);

    default:
      throw new Error(`Unsupported target library: ${target}`);
  }
}

/**
 * Unified code generation function
 * Select appropriate code generator based on target library
 *
 * @param schema - OpenAPI schema
 * @param target - Target library ('zod' | 'yup' | 'typebox')
 * @param options - Conversion options
 * @returns Generated TypeScript code
 *
 * @example
 * ```typescript
 * // Generate Zod code
 * const zodCode = generateSchemaCode(openApiSchema, 'zod', { schemaName: 'UserSchema' });
 *
 * // Generate Yup code
 * const yupCode = generateSchemaCode(openApiSchema, 'yup', { schemaName: 'userSchema' });
 *
 * // Generate TypeBox code
 * const typeboxCode = generateSchemaCode(openApiSchema, 'typebox', { schemaName: 'UserSchema' });
 * ```
 */
export function generateSchemaCode(
  schema: Schema,
  target: TargetLibrary,
  options: ConvertOptions = {},
): string {
  switch (target) {
    case 'zod':
      return generateZodCode(schema, options);

    case 'yup':
      return generateYupCode(schema, options);

    case 'typebox':
      return generateTypeBoxCode(schema, options);

    default:
      throw new Error(`Unsupported target library: ${target}`);
  }
}

/**
 * Generate code for all target libraries
 * Useful when generating code for multiple libraries at once
 *
 * @param schema - OpenAPI schema
 * @param options - Conversion options
 * @returns Generated code by library
 *
 * @example
 * ```typescript
 * const allCodes = generateAllSchemaCode(openApiSchema, { schemaName: 'UserSchema' });
 * console.log(allCodes.zod);     // Zod code
 * console.log(allCodes.yup);     // Yup code
 * console.log(allCodes.typebox); // TypeBox code
 * ```
 */
export function generateAllSchemaCode(
  schema: Schema,
  options: ConvertOptions = {},
): Record<TargetLibrary, string> {
  return {
    zod: generateZodCode(schema, options),
    yup: generateYupCode(schema, options),
    typebox: generateTypeBoxCode(schema, options),
  };
}

/**
 * List of supported target libraries
 */
export const SUPPORTED_TARGETS: readonly TargetLibrary[] = ['zod', 'yup', 'typebox'] as const;

/**
 * Check if target library is valid
 *
 * @param target - Target to check
 * @returns Whether it is valid
 */
export function isValidTarget(target: unknown): target is TargetLibrary {
  return typeof target === 'string' && SUPPORTED_TARGETS.includes(target as TargetLibrary);
}
