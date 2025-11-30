/**
 * OpenAPI spec comparison and breaking change detection
 * Phase 9 specification-based implementation
 */

import { readFile } from 'fs/promises';
import { parse as parseYaml } from 'yaml';
import type {
  OpenAPISpec,
  CompareSpecsOptions,
  CompareSpecsResult,
  BreakingChange,
  Change,
  PathItem,
  Operation,
  Parameter,
  Schema,
} from '../types/index.js';
import { debugCompare } from '../logger/index.js';

/**
 * Load spec file
 */
async function loadSpec(filePath: string): Promise<OpenAPISpec> {
  const content = await readFile(filePath, 'utf-8');

  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    return parseYaml(content) as OpenAPISpec;
  }

  return JSON.parse(content) as OpenAPISpec;
}

/**
 * HTTP methods list
 */
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const;

/**
 * Compare schema types
 */
function isTypeChanged(baseSchema: Schema | undefined, headSchema: Schema | undefined): boolean {
  if (!baseSchema || !headSchema) return false;
  if (baseSchema.type !== headSchema.type) return true;
  if (baseSchema.format !== headSchema.format) return true;
  return false;
}

/**
 * Compare required properties
 */
function findAddedRequiredProperties(
  baseSchema: Schema | undefined,
  headSchema: Schema | undefined
): string[] {
  const baseRequired = new Set(baseSchema?.required || []);
  const headRequired = headSchema?.required || [];

  return headRequired.filter((prop) => !baseRequired.has(prop));
}

/**
 * Compare enum values
 */
function findRemovedEnumValues(
  baseSchema: Schema | undefined,
  headSchema: Schema | undefined
): unknown[] {
  const baseEnum = baseSchema?.enum || [];
  const headEnumSet = new Set(headSchema?.enum || []);

  return baseEnum.filter((value) => !headEnumSet.has(value));
}

/**
 * Compare parameters
 */
function compareParameters(
  basePath: string,
  method: string,
  baseParams: Parameter[] | undefined,
  headParams: Parameter[] | undefined
): BreakingChange[] {
  const changes: BreakingChange[] = [];
  const baseParamMap = new Map(
    (baseParams || []).map((p) => [`${p.in}:${p.name}`, p])
  );
  const headParamMap = new Map(
    (headParams || []).map((p) => [`${p.in}:${p.name}`, p])
  );

  // Check for removed parameters
  for (const [key, baseParam] of baseParamMap) {
    if (!headParamMap.has(key)) {
      changes.push({
        path: basePath,
        method,
        description: `Parameter "${baseParam.name}" (${baseParam.in}) was removed`,
        type: 'parameter-removed',
      });
    }
  }

  // Check for newly required parameters
  for (const [key, headParam] of headParamMap) {
    const baseParam = baseParamMap.get(key);
    if (baseParam && !baseParam.required && headParam.required) {
      changes.push({
        path: basePath,
        method,
        description: `Parameter "${headParam.name}" (${headParam.in}) became required`,
        type: 'parameter-required-added',
      });
    }
  }

  return changes;
}

/**
 * Compare response codes
 */
function compareResponses(
  basePath: string,
  method: string,
  baseResponses: Record<string, unknown> | undefined,
  headResponses: Record<string, unknown> | undefined
): BreakingChange[] {
  const changes: BreakingChange[] = [];
  const baseResponseCodes = new Set(Object.keys(baseResponses || {}));
  const headResponseCodes = new Set(Object.keys(headResponses || {}));

  // Check for removed success response codes (2xx)
  for (const code of baseResponseCodes) {
    if (code.startsWith('2') && !headResponseCodes.has(code)) {
      changes.push({
        path: basePath,
        method,
        description: `Response code "${code}" was removed`,
        type: 'response-code-removed',
      });
    }
  }

  return changes;
}

/**
 * Compare schemas
 */
function compareSchemas(
  basePath: string,
  method: string,
  baseSchema: Schema | undefined,
  headSchema: Schema | undefined
): BreakingChange[] {
  const changes: BreakingChange[] = [];

  if (!baseSchema || !headSchema) return changes;

  // Check for type changes
  if (isTypeChanged(baseSchema, headSchema)) {
    changes.push({
      path: basePath,
      method,
      description: `Response type changed from "${baseSchema.type}" to "${headSchema.type}"`,
      type: 'type-changed',
    });
  }

  // Check for added required properties
  const addedRequired = findAddedRequiredProperties(baseSchema, headSchema);
  for (const prop of addedRequired) {
    changes.push({
      path: basePath,
      method,
      description: `Property "${prop}" became required in response`,
      type: 'required-added',
    });
  }

  // Check for removed enum values
  const removedEnums = findRemovedEnumValues(baseSchema, headSchema);
  for (const value of removedEnums) {
    changes.push({
      path: basePath,
      method,
      description: `Enum value "${String(value)}" was removed`,
      type: 'enum-value-removed',
    });
  }

  // Compare nested properties
  if (baseSchema.properties && headSchema.properties) {
    for (const [propName, basePropSchema] of Object.entries(baseSchema.properties)) {
      const headPropSchema = headSchema.properties[propName];
      if (headPropSchema) {
        changes.push(
          ...compareSchemas(basePath, method, basePropSchema, headPropSchema)
        );
      }
    }
  }

  // Compare array items
  if (baseSchema.items && headSchema.items) {
    changes.push(
      ...compareSchemas(basePath, method, baseSchema.items, headSchema.items)
    );
  }

  return changes;
}

/**
 * Compare operations
 */
function compareOperations(
  path: string,
  method: string,
  baseOp: Operation,
  headOp: Operation
): { breaking: BreakingChange[]; nonBreaking: Change[] } {
  const breaking: BreakingChange[] = [];
  const nonBreaking: Change[] = [];

  // Compare parameters
  breaking.push(
    ...compareParameters(path, method, baseOp.parameters, headOp.parameters)
  );

  // Compare response codes
  breaking.push(
    ...compareResponses(path, method, baseOp.responses, headOp.responses)
  );

  // Compare response schemas (main success responses)
  const successCodes = ['200', '201', '204'];
  for (const code of successCodes) {
    const baseResponse = baseOp.responses?.[code];
    const headResponse = headOp.responses?.[code];

    if (baseResponse && headResponse) {
      const baseContent = (baseResponse as { content?: Record<string, { schema?: Schema }> }).content;
      const headContent = (headResponse as { content?: Record<string, { schema?: Schema }> }).content;

      if (baseContent && headContent) {
        for (const [mediaType, baseMedia] of Object.entries(baseContent)) {
          const headMedia = headContent[mediaType];
          if (headMedia && baseMedia.schema && headMedia.schema) {
            breaking.push(
              ...compareSchemas(path, method, baseMedia.schema, headMedia.schema)
            );
          }
        }
      }
    }
  }

  // Detect non-breaking changes
  if (baseOp.summary !== headOp.summary && headOp.summary) {
    nonBreaking.push({
      path,
      method,
      description: 'Summary was updated',
      type: 'modified',
    });
  }

  if (baseOp.description !== headOp.description && headOp.description) {
    nonBreaking.push({
      path,
      method,
      description: 'Description was updated',
      type: 'modified',
    });
  }

  return { breaking, nonBreaking };
}

/**
 * Compare two OpenAPI specs
 *
 * @example
 * const result = await compareSpecs({
 *   base: './openapi/v1/openapi.yaml',
 *   head: './openapi/v1/openapi.new.yaml',
 * });
 *
 * if (result.breaking.length > 0) {
 *   console.error('Breaking changes detected:');
 *   result.breaking.forEach((change) => {
 *     console.error(`- ${change.path}: ${change.description}`);
 *   });
 *   process.exit(1);
 * }
 */
export async function compareSpecs(
  options: CompareSpecsOptions
): Promise<CompareSpecsResult> {
  debugCompare.info(`Comparing specs: ${options.base} vs ${options.head}`);

  const [baseSpec, headSpec] = await Promise.all([
    loadSpec(options.base),
    loadSpec(options.head),
  ]);

  const result: CompareSpecsResult = {
    breaking: [],
    nonBreaking: [],
    deprecated: [],
  };

  const basePaths = baseSpec.paths || {};
  const headPaths = headSpec.paths || {};

  const allPaths = new Set([
    ...Object.keys(basePaths),
    ...Object.keys(headPaths),
  ]);

  for (const path of allPaths) {
    const basePathItem = basePaths[path] as PathItem | undefined;
    const headPathItem = headPaths[path] as PathItem | undefined;

    // Check for removed endpoints
    if (basePathItem && !headPathItem) {
      for (const method of HTTP_METHODS) {
        if (basePathItem[method]) {
          result.breaking.push({
            path,
            method,
            description: `Endpoint ${method.toUpperCase()} ${path} was removed`,
            type: 'removed',
          });
        }
      }
      continue;
    }

    // Check for added endpoints
    if (!basePathItem && headPathItem) {
      for (const method of HTTP_METHODS) {
        if (headPathItem[method]) {
          result.nonBreaking.push({
            path,
            method,
            description: `New endpoint ${method.toUpperCase()} ${path} was added`,
            type: 'added',
          });
        }
      }
      continue;
    }

    // Compare by method
    if (basePathItem && headPathItem) {
      for (const method of HTTP_METHODS) {
        const baseOp = basePathItem[method];
        const headOp = headPathItem[method];

        // Method removed
        if (baseOp && !headOp) {
          result.breaking.push({
            path,
            method,
            description: `Endpoint ${method.toUpperCase()} ${path} was removed`,
            type: 'removed',
          });
          continue;
        }

        // Method added
        if (!baseOp && headOp) {
          result.nonBreaking.push({
            path,
            method,
            description: `New endpoint ${method.toUpperCase()} ${path} was added`,
            type: 'added',
          });
          continue;
        }

        // Compare if both exist
        if (baseOp && headOp) {
          const comparison = compareOperations(path, method, baseOp, headOp);
          result.breaking.push(...comparison.breaking);
          result.nonBreaking.push(...comparison.nonBreaking);

          // Check for deprecated
          if (!baseOp.deprecated && headOp.deprecated) {
            result.deprecated.push({
              path,
              method,
              description: headOp.description,
            });
          }
        }
      }
    }
  }

  debugCompare.info(
    `Comparison complete: ${result.breaking.length} breaking, ${result.nonBreaking.length} non-breaking, ${result.deprecated.length} deprecated`
  );

  return result;
}

/**
 * Check for breaking changes helper
 */
export function hasBreakingChanges(result: CompareSpecsResult): boolean {
  return result.breaking.length > 0;
}

/**
 * Format comparison result as string
 */
export function formatCompareResult(result: CompareSpecsResult): string {
  const lines: string[] = [];

  if (result.breaking.length > 0) {
    lines.push('## Breaking Changes');
    lines.push('');
    for (const change of result.breaking) {
      lines.push(`- **${change.type}**: ${change.method?.toUpperCase() || ''} ${change.path}`);
      lines.push(`  ${change.description}`);
    }
    lines.push('');
  }

  if (result.nonBreaking.length > 0) {
    lines.push('## Non-Breaking Changes');
    lines.push('');
    for (const change of result.nonBreaking) {
      lines.push(`- **${change.type}**: ${change.method?.toUpperCase() || ''} ${change.path}`);
      lines.push(`  ${change.description}`);
    }
    lines.push('');
  }

  if (result.deprecated.length > 0) {
    lines.push('## Deprecated Endpoints');
    lines.push('');
    for (const endpoint of result.deprecated) {
      lines.push(`- ${endpoint.method.toUpperCase()} ${endpoint.path}`);
      if (endpoint.description) {
        lines.push(`  ${endpoint.description}`);
      }
    }
    lines.push('');
  }

  if (lines.length === 0) {
    lines.push('No changes detected.');
  }

  return lines.join('\n');
}
