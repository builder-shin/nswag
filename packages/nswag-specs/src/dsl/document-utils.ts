/**
 * 문서화 옵션 유틸리티
 * Phase 4: API 버전 및 문서화 옵션
 *
 * describe, response 레벨의 document 옵션 처리
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
// document 옵션 처리
// ============================================================================

/**
 * 문서화 포함 여부 결정
 *
 * 우선순위:
 * 1. Response 레벨 document 옵션
 * 2. Method 레벨 (없음, 항상 상위 참조)
 * 3. Describe 레벨 document 옵션
 * 4. 기본값: true
 *
 * @example
 * // Describe 레벨에서 제외하고 특정 Response만 포함
 * describe('API', { document: false }, () => {
 *   path('/users', () => {
 *     get('List', () => {
 *       response(200, 'OK', { document: true }, () => {  // 이것만 문서화됨
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
  // Response 레벨에서 명시적으로 설정된 경우
  if (responseOptions?.document !== undefined) {
    return responseOptions.document;
  }

  // Describe 레벨에서 설정된 경우
  if (describeOptions?.document !== undefined) {
    return describeOptions.document;
  }

  // 기본값: 문서화 포함
  return true;
}

/**
 * 컨텍스트 체인에서 Describe 옵션 수집
 */
export function getDescribeOptionsFromContext(
  context: PathContext | MethodContext | ResponseContext
): DescribeOptions | undefined {
  // Path 컨텍스트에서 부모 Describe 찾기
  if (context.type === 'path') {
    return context.parent?.options;
  }

  // Method 컨텍스트에서 부모 Path → Describe 찾기
  if (context.type === 'method') {
    return context.parent?.parent?.options;
  }

  // Response 컨텍스트에서 부모 Method → Path → Describe 찾기
  if (context.type === 'response') {
    return context.parent?.parent?.parent?.options;
  }

  return undefined;
}

/**
 * Response 컨텍스트의 문서화 여부 결정
 */
export function shouldDocumentResponse(responseContext: ResponseContext): boolean {
  const describeOptions = getDescribeOptionsFromContext(responseContext);
  return shouldDocument(responseContext.options, describeOptions);
}

// ============================================================================
// 문서화 필터링
// ============================================================================

/**
 * 문서화 대상 응답만 필터링
 */
export function filterDocumentableResponses(
  responses: ResponseContext[]
): ResponseContext[] {
  return responses.filter(shouldDocumentResponse);
}

/**
 * 문서화 대상 메서드만 필터링
 * (하나 이상의 문서화 대상 응답이 있는 경우)
 */
export function filterDocumentableMethods(
  methods: MethodContext[]
): MethodContext[] {
  return methods.filter(method =>
    method.responses.some(shouldDocumentResponse)
  );
}

/**
 * 문서화 대상 경로만 필터링
 * (하나 이상의 문서화 대상 메서드가 있는 경우)
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
// openapiSpec 옵션 처리
// ============================================================================

/**
 * 컨텍스트에서 대상 OpenAPI 스펙 파일 경로 가져오기
 */
export function getTargetSpec(context: DSLContext): string | undefined {
  // Describe 컨텍스트에서 직접 가져오기
  if (context.type === 'describe') {
    return context.options.openapiSpec;
  }

  // Path 컨텍스트에서 부모 Describe의 옵션 참조
  if (context.type === 'path') {
    return context.parent?.options.openapiSpec;
  }

  // Method 컨텍스트에서 부모 체인 순회
  if (context.type === 'method') {
    return context.parent?.parent?.options.openapiSpec;
  }

  // Response 컨텍스트에서 부모 체인 순회
  if (context.type === 'response') {
    return context.parent?.parent?.parent?.options.openapiSpec;
  }

  return undefined;
}

/**
 * 응답을 스펙 파일별로 그룹화
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
// 유틸리티
// ============================================================================

/**
 * 중첩된 Describe 컨텍스트를 평면화
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
 * Describe 컨텍스트에서 모든 Path 추출
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
 * 문서화 통계 계산
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
