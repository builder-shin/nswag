/**
 * DSL 기반 OpenAPI 스펙 생성기
 * Phase 4: API 버전 및 문서화 옵션
 *
 * DSL 컨텍스트에서 OpenAPI 스펙을 생성
 */

import { stringify as yamlStringify } from 'yaml';
import type {
  PathContext,
  MethodContext,
  ResponseContext,
  SchemaObject,
  ParameterObject,
  RequestBodyObject,
  ExternalDocsObject,
} from './types.js';
import { getDSLContextManager } from './context.js';
import { GlobalConfigManager } from './global-config.js';
import {
  filterDocumentableResponses,
  extractPaths,
} from './document-utils.js';
import { processSchema } from './schema-utils.js';

// ============================================================================
// OpenAPI 스펙 타입 (생성용)
// ============================================================================

/**
 * 생성된 OpenAPI 스펙
 */
export interface GeneratedOpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, GeneratedPathItem>;
  tags?: Array<{
    name: string;
    description?: string;
    externalDocs?: ExternalDocsObject;
  }>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, unknown>;
  };
  externalDocs?: ExternalDocsObject;
}

/**
 * 생성된 Path Item
 */
export interface GeneratedPathItem {
  summary?: string;
  description?: string;
  get?: GeneratedOperation;
  post?: GeneratedOperation;
  put?: GeneratedOperation;
  patch?: GeneratedOperation;
  delete?: GeneratedOperation;
  head?: GeneratedOperation;
  options?: GeneratedOperation;
  parameters?: GeneratedParameter[];
}

/**
 * 생성된 Operation
 */
export interface GeneratedOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  externalDocs?: ExternalDocsObject;
  parameters?: GeneratedParameter[];
  requestBody?: GeneratedRequestBody;
  responses: Record<string, GeneratedResponse>;
  security?: Array<Record<string, string[]>>;
}

/**
 * 생성된 Parameter
 */
export interface GeneratedParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: unknown;
  /** x-enum-descriptions 확장 필드 (Enum 설명) */
  'x-enum-descriptions'?: Record<string, string>;
}

/**
 * 생성된 RequestBody
 */
export interface GeneratedRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, { schema?: SchemaObject; example?: unknown }>;
}

/**
 * 생성된 Response
 */
export interface GeneratedResponse {
  description: string;
  headers?: Record<string, { description?: string; schema?: SchemaObject }>;
  content?: Record<string, { schema?: SchemaObject; example?: unknown }>;
}

// ============================================================================
// 스펙 생성기
// ============================================================================

/**
 * DSL 스펙 생성기 클래스
 */
export class DSLSpecGenerator {
  private specPath?: string;

  constructor(specPath?: string) {
    this.specPath = specPath;
  }

  /**
   * DSL 컨텍스트에서 OpenAPI 스펙 생성
   */
  generate(): GeneratedOpenAPISpec {
    const manager = getDSLContextManager();
    const rootDescribes = manager.getRootDescribes();

    // 스펙 설정 가져오기
    const specConfig = this.specPath
      ? GlobalConfigManager.getSpecConfig(this.specPath)
      : undefined;

    // 기본 스펙 구조
    const spec: GeneratedOpenAPISpec = {
      openapi: specConfig?.openapi ?? GlobalConfigManager.getDefaultOpenAPIVersion(),
      info: {
        title: specConfig?.info?.title ?? 'API Documentation',
        version: specConfig?.info?.version ?? '1.0.0',
        description: specConfig?.info?.description,
        termsOfService: specConfig?.info?.termsOfService,
        contact: specConfig?.info?.contact,
        license: specConfig?.info?.license,
      },
      servers: specConfig?.servers,
      paths: {},
      tags: specConfig?.tags,
      externalDocs: specConfig?.externalDocs,
    };

    // 스펙 파일별 필터링
    const targetDescribes = this.specPath
      ? rootDescribes.filter(d => d.options.openapiSpec === this.specPath)
      : rootDescribes;

    // 수집된 태그
    const collectedTags = new Set<string>();

    // 각 Describe 처리
    for (const describe of targetDescribes) {
      const paths = extractPaths(describe);
      for (const pathCtx of paths) {
        const pathItem = this.buildPathItem(pathCtx, collectedTags);
        if (pathItem && Object.keys(pathItem).length > 0) {
          const existingPath = spec.paths[pathCtx.pathTemplate];
          if (existingPath) {
            // 기존 경로에 병합
            spec.paths[pathCtx.pathTemplate] = {
              ...existingPath,
              ...pathItem,
            };
          } else {
            spec.paths[pathCtx.pathTemplate] = pathItem;
          }
        }
      }
    }

    // 수집된 태그 추가
    if (collectedTags.size > 0 && !spec.tags) {
      spec.tags = Array.from(collectedTags).map(name => ({ name }));
    }

    return spec;
  }

  /**
   * Path Item 생성
   */
  private buildPathItem(
    pathCtx: PathContext,
    collectedTags: Set<string>
  ): GeneratedPathItem | null {
    const pathItem: GeneratedPathItem = {};

    // Path 레벨 파라미터
    if (pathCtx.parameters.length > 0) {
      pathItem.parameters = pathCtx.parameters.map(p => this.convertParameter(p));
    }

    // 문서화 대상 메서드만 처리
    for (const methodCtx of pathCtx.methods) {
      const documentableResponses = filterDocumentableResponses(methodCtx.responses);
      if (documentableResponses.length === 0) {
        continue;
      }

      const operation = this.buildOperation(methodCtx, documentableResponses, collectedTags);
      const method = methodCtx.httpMethod.toLowerCase() as keyof GeneratedPathItem;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pathItem as any)[method] = operation;
    }

    return pathItem;
  }

  /**
   * Operation 생성
   */
  private buildOperation(
    methodCtx: MethodContext,
    responses: ResponseContext[],
    collectedTags: Set<string>
  ): GeneratedOperation {
    // 태그 수집
    methodCtx.tags.forEach(tag => collectedTags.add(tag));

    const operation: GeneratedOperation = {
      summary: methodCtx.summary,
      responses: {},
    };

    // Operation ID
    if (methodCtx.operationId) {
      operation.operationId = methodCtx.operationId;
    }

    // 상세 설명
    if (methodCtx.description) {
      operation.description = methodCtx.description;
    }

    // 태그
    if (methodCtx.tags.length > 0) {
      operation.tags = [...methodCtx.tags];
    }

    // Deprecated
    if (methodCtx.deprecated) {
      operation.deprecated = true;
    }

    // External Docs
    if (methodCtx.externalDocs) {
      operation.externalDocs = methodCtx.externalDocs;
    }

    // 파라미터
    if (methodCtx.parameters.length > 0) {
      operation.parameters = methodCtx.parameters.map(p => this.convertParameter(p));
    }

    // 요청 본문
    if (methodCtx.requestBody) {
      operation.requestBody = this.convertRequestBody(methodCtx.requestBody);
    }

    // 응답
    for (const responseCtx of responses) {
      const responseObj = this.buildResponse(responseCtx);
      operation.responses[String(responseCtx.statusCode)] = responseObj;
    }

    // 보안 요구사항 (Phase 5)
    if (methodCtx.security && methodCtx.security.length > 0) {
      operation.security = methodCtx.security;
    }

    return operation;
  }

  /**
   * Response 생성
   */
  private buildResponse(responseCtx: ResponseContext): GeneratedResponse {
    const response: GeneratedResponse = {
      description: responseCtx.description,
    };

    // 헤더
    if (responseCtx.headers) {
      response.headers = {};
      for (const [name, headerObj] of Object.entries(responseCtx.headers)) {
        response.headers[name] = {
          description: headerObj.description,
          schema: headerObj.schema
            ? processSchema(headerObj.schema, responseCtx.options, this.specPath)
            : undefined,
        };
      }
    }

    // 콘텐츠
    if (responseCtx.content) {
      response.content = {};
      for (const [mediaType, mediaTypeObj] of Object.entries(responseCtx.content)) {
        response.content[mediaType] = {
          schema: mediaTypeObj.schema
            ? processSchema(mediaTypeObj.schema, responseCtx.options, this.specPath)
            : undefined,
          example: mediaTypeObj.example,
        };
      }
    } else if (responseCtx.schema) {
      // 스키마만 있는 경우 기본 content-type으로 래핑
      response.content = {
        'application/json': {
          schema: processSchema(responseCtx.schema, responseCtx.options, this.specPath),
        },
      };
    }

    return response;
  }

  /**
   * Parameter 변환
   */
  private convertParameter(param: ParameterObject): GeneratedParameter {
    // body 파라미터는 OpenAPI 3.0에서 지원하지 않음
    if (param.in === 'body') {
      // body는 requestBody로 변환해야 함
      return {
        name: param.name,
        in: 'query', // 기본값으로 변환
        description: param.description,
        required: param.required,
        deprecated: param.deprecated,
        schema: param.schema
          ? processSchema(param.schema, {}, this.specPath)
          : undefined,
        example: param.example,
      };
    }

    const result: GeneratedParameter = {
      name: param.name,
      in: param.in,
      description: param.description,
      required: param.required,
      deprecated: param.deprecated,
      schema: param.schema
        ? processSchema(param.schema, {}, this.specPath)
        : undefined,
      example: param.example,
    };

    // nswag 확장 Enum 처리: { value: description } 형태를 enum 배열 + x-enum-descriptions로 변환
    if (param.enum && typeof param.enum === 'object') {
      const enumValues = Object.keys(param.enum);
      const enumDescriptions: Record<string, string> = {};

      for (const [value, description] of Object.entries(param.enum)) {
        if (typeof description === 'string') {
          enumDescriptions[value] = description;
        }
      }

      // 스키마에 enum 배열 추가
      if (result.schema) {
        result.schema = {
          ...result.schema,
          enum: enumValues,
        };
      } else {
        result.schema = {
          type: 'string',
          enum: enumValues,
        };
      }

      // x-enum-descriptions 확장 필드 추가
      if (Object.keys(enumDescriptions).length > 0) {
        result['x-enum-descriptions'] = enumDescriptions;
      }
    }

    return result;
  }

  /**
   * RequestBody 변환
   */
  private convertRequestBody(body: RequestBodyObject): GeneratedRequestBody {
    const result: GeneratedRequestBody = {
      description: body.description,
      required: body.required,
      content: {},
    };

    for (const [mediaType, mediaTypeObj] of Object.entries(body.content)) {
      result.content[mediaType] = {
        schema: mediaTypeObj.schema
          ? processSchema(mediaTypeObj.schema, {}, this.specPath)
          : undefined,
        example: mediaTypeObj.example,
      };
    }

    return result;
  }

  /**
   * JSON으로 출력
   */
  toJSON(pretty = true): string {
    const spec = this.generate();
    return pretty ? JSON.stringify(spec, null, 2) : JSON.stringify(spec);
  }

  /**
   * YAML로 출력
   */
  toYAML(): string {
    const spec = this.generate();
    return yamlStringify(spec, { indent: 2 });
  }
}

// ============================================================================
// 다중 스펙 생성
// ============================================================================

/**
 * 다중 스펙 생성 결과
 */
export interface MultiSpecResult {
  specPath: string;
  spec: GeneratedOpenAPISpec;
  json: string;
  yaml: string;
}

/**
 * 설정된 모든 스펙 파일 생성
 */
export function generateAllSpecs(): MultiSpecResult[] {
  const specPaths = GlobalConfigManager.getSpecPaths();
  const results: MultiSpecResult[] = [];

  // 스펙 파일별 생성
  for (const specPath of specPaths) {
    const generator = new DSLSpecGenerator(specPath);
    const spec = generator.generate();

    results.push({
      specPath,
      spec,
      json: JSON.stringify(spec, null, 2),
      yaml: yamlStringify(spec, { indent: 2 }),
    });
  }

  // 기본 스펙 (openapiSpec 미지정 describe 포함)
  if (specPaths.length === 0) {
    const generator = new DSLSpecGenerator();
    const spec = generator.generate();

    results.push({
      specPath: 'openapi.json',
      spec,
      json: JSON.stringify(spec, null, 2),
      yaml: yamlStringify(spec, { indent: 2 }),
    });
  }

  return results;
}

/**
 * DSL 컨텍스트에서 단일 스펙 생성
 */
export function generateSpec(specPath?: string): GeneratedOpenAPISpec {
  const generator = new DSLSpecGenerator(specPath);
  return generator.generate();
}

/**
 * DSL 컨텍스트에서 JSON 스펙 생성
 */
export function generateSpecJSON(specPath?: string, pretty = true): string {
  const generator = new DSLSpecGenerator(specPath);
  return generator.toJSON(pretty);
}

/**
 * DSL 컨텍스트에서 YAML 스펙 생성
 */
export function generateSpecYAML(specPath?: string): string {
  const generator = new DSLSpecGenerator(specPath);
  return generator.toYAML();
}
