/**
 * Documentation options utilities
 * Phase 4: API version and documentation options
 *
 * Handle document options at describe and response levels
 */

import type {
  DescribeContext,
  MethodContext,
  ResponseContext,
  PathContext,
  DSLContext,
  DescribeOptions,
  ResponseOptions,
} from './types.js';

// ============================================================================
// document option processing
// ============================================================================

/**
 * Determine whether to include in documentation
 *
 * Priority:
 * 1. Response level document option
 * 2. Method level (none, always reference parent)
 * 3. Describe level document option
 * 4. Default: true
 *
 * @example
 * // Exclude at Describe level but include specific Response
 * describe('API', { document: false }, () => {
 *   path('/users', () => {
 *     get('List', () => {
 *       response(200, 'OK', { document: true }, () => {  // Only this is documented
 *         runTest();
 *       });
 *     });
 *   });
 * });
 */
export function shouldDocument(
  responseOptions?: ResponseOptions,
  describeOptions?: DescribeOptions
): boolean {
  // If explicitly set at Response level
  if (responseOptions?.document !== undefined) {
    return responseOptions.document;
  }

  // If set at Describe level
  if (describeOptions?.document !== undefined) {
    return describeOptions.document;
  }

  // Default: include in documentation
  return true;
}

/**
 * Collect Describe options from context chain
 */
export function getDescribeOptionsFromContext(
  context: PathContext | MethodContext | ResponseContext
): DescribeOptions | undefined {
  // Find parent Describe from Path context
  if (context.type === 'path') {
    return context.parent?.options;
  }

  // Find parent Path → Describe from Method context
  if (context.type === 'method') {
    return context.parent?.parent?.options;
  }

  // Find parent Method → Path → Describe from Response context
  if (context.type === 'response') {
    return context.parent?.parent?.parent?.options;
  }

  return undefined;
}

/**
 * Determine whether to document Response context
 */
export function shouldDocumentResponse(responseContext: ResponseContext): boolean {
  const describeOptions = getDescribeOptionsFromContext(responseContext);
  return shouldDocument(responseContext.options, describeOptions);
}

// ============================================================================
// Documentation filtering
// ============================================================================

/**
 * Filter only documentable responses
 */
export function filterDocumentableResponses(
  responses: ResponseContext[]
): ResponseContext[] {
  return responses.filter(shouldDocumentResponse);
}

/**
 * Filter only documentable methods
 * (if at least one documentable response exists)
 */
export function filterDocumentableMethods(
  methods: MethodContext[]
): MethodContext[] {
  return methods.filter(method =>
    method.responses.some(shouldDocumentResponse)
  );
}

/**
 * Filter only documentable paths
 * (if at least one documentable method exists)
 */
export function filterDocumentablePaths(
  paths: PathContext[]
): PathContext[] {
  return paths.filter(path =>
    path.methods.some(method =>
      method.responses.some(shouldDocumentResponse)
    )
  );
}

// ============================================================================
// openapiSpec option processing
// ============================================================================

/**
 * Get target OpenAPI spec file path from context
 */
export function getTargetSpec(context: DSLContext): string | undefined {
  // Get directly from Describe context
  if (context.type === 'describe') {
    return context.options.openapiSpec;
  }

  // Reference parent Describe's option from Path context
  if (context.type === 'path') {
    return context.parent?.options.openapiSpec;
  }

  // Traverse parent chain from Method context
  if (context.type === 'method') {
    return context.parent?.parent?.options.openapiSpec;
  }

  // Traverse parent chain from Response context
  if (context.type === 'response') {
    return context.parent?.parent?.parent?.options.openapiSpec;
  }

  return undefined;
}

/**
 * Group responses by spec file
 */
export function groupBySpec(
  describes: DescribeContext[]
): Map<string | undefined, DescribeContext[]> {
  const groups = new Map<string | undefined, DescribeContext[]>();

  for (const describe of describes) {
    const specPath = describe.options.openapiSpec;
    const existing = groups.get(specPath) ?? [];
    existing.push(describe);
    groups.set(specPath, existing);
  }

  return groups;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Flatten nested Describe contexts
 */
export function flattenDescribes(
  describes: DescribeContext[]
): DescribeContext[] {
  const result: DescribeContext[] = [];

  function traverse(ctx: DescribeContext): void {
    result.push(ctx);

    for (const child of ctx.children) {
      if (child.type === 'describe') {
        traverse(child);
      }
    }
  }

  for (const describe of describes) {
    traverse(describe);
  }

  return result;
}

/**
 * Extract all Paths from Describe context
 */
export function extractPaths(describe: DescribeContext): PathContext[] {
  const paths: PathContext[] = [];

  for (const child of describe.children) {
    if (child.type === 'path') {
      paths.push(child);
    } else if (child.type === 'describe') {
      paths.push(...extractPaths(child));
    }
  }

  return paths;
}

/**
 * Calculate documentation statistics
 */
export interface DocumentationStats {
  totalDescribes: number;
  totalPaths: number;
  totalMethods: number;
  totalResponses: number;
  documentedDescribes: number;
  documentedPaths: number;
  documentedMethods: number;
  documentedResponses: number;
  excludedResponses: number;
}

export function calculateDocumentationStats(
  describes: DescribeContext[]
): DocumentationStats {
  let totalDescribes = 0;
  let totalPaths = 0;
  let totalMethods = 0;
  let totalResponses = 0;
  let documentedResponses = 0;

  function processDescribe(describe: DescribeContext): void {
    totalDescribes++;

    for (const child of describe.children) {
      if (child.type === 'describe') {
        processDescribe(child);
      } else if (child.type === 'path') {
        totalPaths++;
        for (const method of child.methods) {
          totalMethods++;
          for (const response of method.responses) {
            totalResponses++;
            if (shouldDocumentResponse(response)) {
              documentedResponses++;
            }
          }
        }
      }
    }
  }

  for (const describe of describes) {
    processDescribe(describe);
  }

  const filteredPaths = filterDocumentablePaths(
    describes.flatMap(extractPaths)
  );
  const filteredMethods = filterDocumentableMethods(
    filteredPaths.flatMap(p => p.methods)
  );

  return {
    totalDescribes,
    totalPaths,
    totalMethods,
    totalResponses,
    documentedDescribes: describes.filter(d =>
      d.options.document !== false
    ).length,
    documentedPaths: filteredPaths.length,
    documentedMethods: filteredMethods.length,
    documentedResponses,
    excludedResponses: totalResponses - documentedResponses,
  };
}
