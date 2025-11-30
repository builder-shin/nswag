/**
 * 스펙 수집기
 * 테스트 실행 중 API 스펙 데이터 수집
 */

import type {
  OpenAPISpec,
  PathItem,
  Operation,
  RequestData,
  ResponseData,
  RequestMetadata,
} from '../types/index.js';

/**
 * 수집된 API 엔드포인트 정보
 */
interface CollectedEndpoint {
  path: string;
  method: string;
  metadata?: RequestMetadata;
  request?: RequestData;
  response?: ResponseData;
  examples?: Array<{
    request: RequestData;
    response: ResponseData;
  }>;
}

/**
 * 스펙 수집기 클래스
 * 테스트 실행 중 API 요청/응답을 수집하여 OpenAPI 스펙 생성
 */
export class SpecCollector {
  private endpoints: Map<string, CollectedEndpoint> = new Map();
  private title: string;
  private version: string;
  private description?: string;

  constructor(options?: { title?: string; version?: string; description?: string }) {
    this.title = options?.title ?? 'API Documentation';
    this.version = options?.version ?? '1.0.0';
    this.description = options?.description;
  }

  /**
   * 엔드포인트 키 생성
   */
  private getEndpointKey(method: string, path: string): string {
    return `${method.toUpperCase()}:${path}`;
  }

  /**
   * 요청/응답 데이터 수집
   */
  collect(
    metadata: RequestMetadata,
    request: RequestData,
    response: ResponseData,
  ): void {
    const key = this.getEndpointKey(request.method, request.path);
    const existing = this.endpoints.get(key);

    if (existing) {
      // 기존 엔드포인트에 예제 추가
      existing.examples = existing.examples ?? [];
      existing.examples.push({ request, response });
    } else {
      // 새 엔드포인트 추가
      this.endpoints.set(key, {
        path: request.path,
        method: request.method,
        metadata,
        request,
        response,
        examples: [],
      });
    }
  }

  /**
   * 수집된 데이터를 OpenAPI 스펙으로 변환
   */
  toOpenAPISpec(): OpenAPISpec {
    const paths: Record<string, PathItem> = {};

    for (const endpoint of this.endpoints.values()) {
      const pathItem = paths[endpoint.path] ?? {};
      const operation = this.buildOperation(endpoint);
      const method = endpoint.method.toLowerCase() as keyof PathItem;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pathItem as any)[method] = operation;
      paths[endpoint.path] = pathItem;
    }

    return {
      openapi: '3.0.3',
      info: {
        title: this.title,
        version: this.version,
        description: this.description,
      },
      paths,
    };
  }

  /**
   * Operation 객체 생성
   */
  private buildOperation(endpoint: CollectedEndpoint): Operation {
    const operation: Operation = {
      operationId: endpoint.metadata?.operationId,
      summary: endpoint.metadata?.summary,
      description: endpoint.metadata?.description,
      tags: endpoint.metadata?.tags,
      parameters: endpoint.metadata?.parameters,
      responses: {},
    };

    // 응답 정보 추가
    if (endpoint.response) {
      const statusCode = String(endpoint.response.statusCode);
      operation.responses[statusCode] = {
        description: this.getStatusDescription(endpoint.response.statusCode),
        content: this.buildResponseContent(endpoint.response),
      };
    }

    // 예제에서 추가 응답 상태 코드 수집
    if (endpoint.examples) {
      for (const example of endpoint.examples) {
        const statusCode = String(example.response.statusCode);
        if (!operation.responses[statusCode]) {
          operation.responses[statusCode] = {
            description: this.getStatusDescription(example.response.statusCode),
            content: this.buildResponseContent(example.response),
          };
        }
      }
    }

    // 요청 본문 정보 추가
    if (endpoint.request?.body) {
      operation.requestBody = endpoint.metadata?.requestBody ?? {
        content: {
          'application/json': {
            schema: { type: 'object' },
            example: this.parseBody(endpoint.request.body),
          },
        },
      };
    }

    return operation;
  }

  /**
   * 응답 콘텐츠 생성
   */
  private buildResponseContent(response: ResponseData): Record<string, { schema?: { type: string }; example?: unknown }> {
    const contentType = 'application/json';
    return {
      [contentType]: {
        schema: { type: 'object' },
        example: this.parseBody(response.body),
      },
    };
  }

  /**
   * 본문 파싱
   */
  private parseBody(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  /**
   * HTTP 상태 코드 설명
   */
  private getStatusDescription(statusCode: number): string {
    const descriptions: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
    };
    return descriptions[statusCode] ?? 'Response';
  }

  /**
   * 수집된 엔드포인트 수
   */
  get count(): number {
    return this.endpoints.size;
  }

  /**
   * 수집된 데이터 초기화
   */
  clear(): void {
    this.endpoints.clear();
  }

  /**
   * 특정 엔드포인트 조회
   */
  getEndpoint(method: string, path: string): CollectedEndpoint | undefined {
    return this.endpoints.get(this.getEndpointKey(method, path));
  }

  /**
   * 모든 엔드포인트 조회
   */
  getAllEndpoints(): CollectedEndpoint[] {
    return Array.from(this.endpoints.values());
  }
}

// 싱글톤 인스턴스
let collectorInstance: SpecCollector | null = null;

/**
 * 스펙 수집기 인스턴스 가져오기
 */
export function getSpecCollector(options?: {
  title?: string;
  version?: string;
  description?: string;
}): SpecCollector {
  if (!collectorInstance) {
    collectorInstance = new SpecCollector(options);
  }
  return collectorInstance;
}

/**
 * 스펙 수집기 리셋
 */
export function resetSpecCollector(): void {
  if (collectorInstance) {
    collectorInstance.clear();
  }
  collectorInstance = null;
}
