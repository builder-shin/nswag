/**
 * Spec Collector
 * Collects API spec data during test execution
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
 * Collected API Endpoint Information
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
 * Spec Collector Class
 * Collects API requests/responses during test execution to generate OpenAPI spec
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
   * Generate Endpoint Key
   */
  private getEndpointKey(method: string, path: string): string {
    return `${method.toUpperCase()}:${path}`;
  }

  /**
   * Collect Request/Response Data
   */
  collect(
    metadata: RequestMetadata,
    request: RequestData,
    response: ResponseData,
  ): void {
    const key = this.getEndpointKey(request.method, request.path);
    const existing = this.endpoints.get(key);

    if (existing) {
      // Add example to existing endpoint
      existing.examples = existing.examples ?? [];
      existing.examples.push({ request, response });
    } else {
      // Add new endpoint
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
   * Convert Collected Data to OpenAPI Spec
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
   * Build Operation Object
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

    // Add response information
    if (endpoint.response) {
      const statusCode = String(endpoint.response.statusCode);
      operation.responses[statusCode] = {
        description: this.getStatusDescription(endpoint.response.statusCode),
        content: this.buildResponseContent(endpoint.response),
      };
    }

    // Collect additional response status codes from examples
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

    // Add request body information
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
   * Build Response Content
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
   * HTTP Status Code Description
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
   * Count of Collected Endpoints
   */
  get count(): number {
    return this.endpoints.size;
  }

  /**
   * Clear Collected Data
   */
  clear(): void {
    this.endpoints.clear();
  }

  /**
   * Get Specific Endpoint
   */
  getEndpoint(method: string, path: string): CollectedEndpoint | undefined {
    return this.endpoints.get(this.getEndpointKey(method, path));
  }

  /**
   * Get All Endpoints
   */
  getAllEndpoints(): CollectedEndpoint[] {
    return Array.from(this.endpoints.values());
  }
}

// Singleton instance
let collectorInstance: SpecCollector | null = null;

/**
 * Get Spec Collector Instance
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
 * Reset Spec Collector
 */
export function resetSpecCollector(): void {
  if (collectorInstance) {
    collectorInstance.clear();
  }
  collectorInstance = null;
}
