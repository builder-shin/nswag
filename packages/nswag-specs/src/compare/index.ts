/**
 * OpenAPI 스펙 비교 및 Breaking Change 감지
 * Phase 9 명세서 기반 구현
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
 * 스펙 파일 로드
 */
async function loadSpec(filePath: string): Promise<OpenAPISpec> {
  const content = await readFile(filePath, 'utf-8');

  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    return parseYaml(content) as OpenAPISpec;
  }

  return JSON.parse(content) as OpenAPISpec;
}

/**
 * HTTP 메서드 목록
 */
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const;

/**
 * 스키마 타입 비교
 */
function isTypeChanged(baseSchema: Schema | undefined, headSchema: Schema | undefined): boolean {
  if (!baseSchema || !headSchema) return false;
  if (baseSchema.type !== headSchema.type) return true;
  if (baseSchema.format !== headSchema.format) return true;
  return false;
}

/**
 * 필수 속성 비교
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
 * enum 값 비교
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
 * 파라미터 비교
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

  // 제거된 파라미터 확인
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

  // 새로 필수가 된 파라미터 확인
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
 * 응답 코드 비교
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

  // 성공 응답 코드 (2xx) 제거 확인
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
 * 스키마 비교
 */
function compareSchemas(
  basePath: string,
  method: string,
  baseSchema: Schema | undefined,
  headSchema: Schema | undefined
): BreakingChange[] {
  const changes: BreakingChange[] = [];

  if (!baseSchema || !headSchema) return changes;

  // 타입 변경 확인
  if (isTypeChanged(baseSchema, headSchema)) {
    changes.push({
      path: basePath,
      method,
      description: `Response type changed from "${baseSchema.type}" to "${headSchema.type}"`,
      type: 'type-changed',
    });
  }

  // 필수 속성 추가 확인
  const addedRequired = findAddedRequiredProperties(baseSchema, headSchema);
  for (const prop of addedRequired) {
    changes.push({
      path: basePath,
      method,
      description: `Property "${prop}" became required in response`,
      type: 'required-added',
    });
  }

  // enum 값 제거 확인
  const removedEnums = findRemovedEnumValues(baseSchema, headSchema);
  for (const value of removedEnums) {
    changes.push({
      path: basePath,
      method,
      description: `Enum value "${String(value)}" was removed`,
      type: 'enum-value-removed',
    });
  }

  // 중첩 속성 비교
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

  // 배열 아이템 비교
  if (baseSchema.items && headSchema.items) {
    changes.push(
      ...compareSchemas(basePath, method, baseSchema.items, headSchema.items)
    );
  }

  return changes;
}

/**
 * 오퍼레이션 비교
 */
function compareOperations(
  path: string,
  method: string,
  baseOp: Operation,
  headOp: Operation
): { breaking: BreakingChange[]; nonBreaking: Change[] } {
  const breaking: BreakingChange[] = [];
  const nonBreaking: Change[] = [];

  // 파라미터 비교
  breaking.push(
    ...compareParameters(path, method, baseOp.parameters, headOp.parameters)
  );

  // 응답 코드 비교
  breaking.push(
    ...compareResponses(path, method, baseOp.responses, headOp.responses)
  );

  // 응답 스키마 비교 (주요 성공 응답)
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

  // 비파괴적 변경 감지
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
 * 두 OpenAPI 스펙 비교
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

    // 엔드포인트 제거 확인
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

    // 새 엔드포인트 추가
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

    // 메서드별 비교
    if (basePathItem && headPathItem) {
      for (const method of HTTP_METHODS) {
        const baseOp = basePathItem[method];
        const headOp = headPathItem[method];

        // 메서드 제거
        if (baseOp && !headOp) {
          result.breaking.push({
            path,
            method,
            description: `Endpoint ${method.toUpperCase()} ${path} was removed`,
            type: 'removed',
          });
          continue;
        }

        // 새 메서드 추가
        if (!baseOp && headOp) {
          result.nonBreaking.push({
            path,
            method,
            description: `New endpoint ${method.toUpperCase()} ${path} was added`,
            type: 'added',
          });
          continue;
        }

        // 양쪽 모두 존재하면 비교
        if (baseOp && headOp) {
          const comparison = compareOperations(path, method, baseOp, headOp);
          result.breaking.push(...comparison.breaking);
          result.nonBreaking.push(...comparison.nonBreaking);

          // deprecated 확인
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
 * Breaking Change 여부 확인 헬퍼
 */
export function hasBreakingChanges(result: CompareSpecsResult): boolean {
  return result.breaking.length > 0;
}

/**
 * 비교 결과를 문자열로 포맷팅
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
