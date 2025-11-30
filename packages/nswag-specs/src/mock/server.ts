/**
 * Mock 서버 구현
 * Phase 9 명세서 기반 구현
 */

import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { readFile } from 'fs/promises';
import { parse as parseYaml } from 'yaml';
import { parse as parseUrl } from 'url';
import type {
  OpenAPISpec,
  MockServerOptions,
  MockServer,
  MockHandler,
  MockRequest,
  MockResponse,
  CorsOptions,
  Schema,
  PathItem,
  Operation,
} from '../types/index.js';
import { NswagMockServerError } from '../errors/index.js';
import { debugMock } from '../logger/index.js';
import { MockGenerator } from './index.js';

/**
 * 기본 CORS 설정
 */
const DEFAULT_CORS: CorsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: [],
  credentials: false,
  maxAge: 86400,
};

/**
 * 로거 인터페이스
 */
interface Logger {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

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
 * 경로 패턴 매칭 (OpenAPI 경로 변수 지원)
 */
function matchPath(
  pattern: string,
  actualPath: string
): { match: boolean; params: Record<string, string> } {
  const patternParts = pattern.split('/').filter(Boolean);
  const actualParts = actualPath.split('/').filter(Boolean);

  if (patternParts.length !== actualParts.length) {
    return { match: false, params: {} };
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const actualPart = actualParts[i];

    if (!patternPart || !actualPart) {
      return { match: false, params: {} };
    }

    if (patternPart.startsWith('{') && patternPart.endsWith('}')) {
      const paramName = patternPart.slice(1, -1);
      params[paramName] = actualPart;
    } else if (patternPart !== actualPart) {
      return { match: false, params: {} };
    }
  }

  return { match: true, params };
}

/**
 * Mock 응답 생성
 */
function generateMockResponse(
  operation: Operation,
  spec: OpenAPISpec
): MockResponse {
  const responses = operation.responses || {};
  const mockGenerator = new MockGenerator();

  // 성공 응답 코드 우선
  const successCodes = ['200', '201', '204'];
  let responseCode = '200';

  for (const code of successCodes) {
    if (responses[code]) {
      responseCode = code;
      break;
    }
  }

  const response = responses[responseCode];
  if (!response) {
    return { status: 200, body: {} };
  }

  // 컨텐츠 추출
  const content = (response as { content?: Record<string, { schema?: Schema; example?: unknown }> }).content;
  if (!content) {
    return { status: parseInt(responseCode, 10), body: null };
  }

  // application/json 우선
  const firstKey = Object.keys(content)[0];
  const mediaType = content['application/json'] || (firstKey ? content[firstKey] : undefined);
  if (!mediaType) {
    return { status: parseInt(responseCode, 10), body: null };
  }

  // example이 있으면 사용
  if (mediaType.example) {
    return {
      status: parseInt(responseCode, 10),
      body: mediaType.example,
    };
  }

  // 스키마로부터 생성
  if (mediaType.schema) {
    // $ref 해결
    let schema = mediaType.schema;
    if (schema.$ref) {
      const refPath = schema.$ref.replace('#/', '').split('/');
      let resolved: unknown = spec;
      for (const part of refPath) {
        resolved = (resolved as Record<string, unknown>)?.[part];
      }
      if (resolved) {
        schema = resolved as Schema;
      }
    }

    return {
      status: parseInt(responseCode, 10),
      body: mockGenerator.generate(schema),
    };
  }

  return { status: parseInt(responseCode, 10), body: {} };
}

/**
 * 요청 본문 파싱
 */
async function parseRequestBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

/**
 * 쿼리 문자열 파싱
 */
function parseQuery(queryString: string | null): Record<string, string | string[]> {
  if (!queryString) return {};

  const params: Record<string, string | string[]> = {};
  const searchParams = new URLSearchParams(queryString);

  for (const [key, value] of searchParams.entries()) {
    if (key in params) {
      const existing = params[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else if (existing !== undefined) {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  }

  return params;
}

/**
 * 딜레이 적용
 */
function applyDelay(delay: MockServerOptions['delay']): Promise<void> {
  if (!delay) return Promise.resolve();

  let ms: number;
  if (typeof delay === 'number') {
    ms = delay;
  } else {
    const min = delay.min || 0;
    const max = delay.max || 0;
    ms = Math.floor(Math.random() * (max - min + 1)) + min;
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * CORS 헤더 적용
 */
function applyCorsHeaders(
  res: ServerResponse,
  corsOptions: CorsOptions,
  origin: string | undefined
): void {
  const resolvedOrigin = corsOptions.origin === true
    ? origin || '*'
    : corsOptions.origin === false
    ? undefined
    : Array.isArray(corsOptions.origin)
    ? (corsOptions.origin.includes(origin || '') ? origin : corsOptions.origin[0])
    : corsOptions.origin;

  if (resolvedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', resolvedOrigin);
  }
  if (corsOptions.methods) {
    res.setHeader('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
  }
  if (corsOptions.allowedHeaders) {
    res.setHeader('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
  }
  if (corsOptions.exposedHeaders && corsOptions.exposedHeaders.length > 0) {
    res.setHeader('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(', '));
  }
  if (corsOptions.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (corsOptions.maxAge) {
    res.setHeader('Access-Control-Max-Age', String(corsOptions.maxAge));
  }
}

/**
 * Mock 서버 생성
 *
 * @example
 * const mockServer = createMockServer({
 *   spec: './openapi/v1/openapi.yaml',
 *   handlers: {
 *     'GET /blogs': (req) => ({
 *       status: 200,
 *       body: [{ id: 1, title: 'Mock Blog' }],
 *     }),
 *   },
 *   delay: { min: 100, max: 500 },
 *   cors: true,
 * });
 *
 * await mockServer.listen(4000);
 */
export function createMockServer(options: MockServerOptions): MockServer {
  let spec: OpenAPISpec | null = null;
  let server: Server | null = null;
  const handlers: Map<string, MockHandler> = new Map();

  // 로거 설정
  const logger: Logger | null = options.logger === true
    ? { info: (msg) => console.log(`[mock] ${msg}`), error: (msg) => console.error(`[mock] ${msg}`) }
    : options.logger === false
    ? null
    : options.logger || null;

  // CORS 설정
  const corsOptions: CorsOptions | null = options.cors === true
    ? DEFAULT_CORS
    : options.cors === false
    ? null
    : options.cors || null;

  // 커스텀 핸들러 등록
  if (options.handlers) {
    for (const [pattern, handler] of Object.entries(options.handlers)) {
      handlers.set(pattern, handler);
    }
  }

  /**
   * 요청 핸들러
   */
  async function handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const startTime = Date.now();
    const parsedUrl = parseUrl(req.url || '/', true);
    const path = parsedUrl.pathname || '/';
    const method = (req.method || 'GET').toUpperCase();

    // CORS preflight
    if (method === 'OPTIONS' && corsOptions) {
      applyCorsHeaders(res, corsOptions, req.headers.origin);
      res.writeHead(204);
      res.end();
      return;
    }

    // CORS 헤더 적용
    if (corsOptions) {
      applyCorsHeaders(res, corsOptions, req.headers.origin);
    }

    try {
      // 딜레이 적용
      await applyDelay(options.delay);

      // 요청 본문 파싱
      const body = await parseRequestBody(req);

      // 쿼리 파라미터 파싱
      const query = parseQuery(parsedUrl.search?.slice(1) || null);

      // 커스텀 핸들러 확인
      const handlerKey = `${method} ${path}`;
      const customHandler = handlers.get(handlerKey);

      if (customHandler) {
        const mockRequest: MockRequest = {
          method,
          path,
          query,
          headers: req.headers as Record<string, string>,
          body,
          params: {},
        };

        const mockResponse = await customHandler(mockRequest);
        const responseTime = Date.now() - startTime;

        res.writeHead(mockResponse.status, {
          'Content-Type': 'application/json',
          ...mockResponse.headers,
        });
        res.end(JSON.stringify(mockResponse.body));

        logger?.info(`${method} ${path} → ${mockResponse.status} (${responseTime}ms) [custom]`);
        return;
      }

      // OpenAPI 스펙 기반 응답
      if (!spec) {
        throw new NswagMockServerError({
          errorType: 'routing',
          message: 'OpenAPI spec not loaded',
          path,
        });
      }

      // 경로 매칭
      const paths = spec.paths || {};
      let matchedPath: string | null = null;
      let matchedPathItem: PathItem | null = null;

      for (const [specPath, pathItem] of Object.entries(paths)) {
        const result = matchPath(specPath, path);
        if (result.match) {
          matchedPath = specPath;
          // TODO: matchedParams를 사용하여 경로 파라미터 검증 추가 예정
          // const matchedParams = result.params;
          matchedPathItem = pathItem as PathItem;
          break;
        }
      }

      if (!matchedPath || !matchedPathItem) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found', path }));
        logger?.info(`${method} ${path} → 404 (route not found)`);
        return;
      }

      // 메서드 확인
      const operation = matchedPathItem[method.toLowerCase() as keyof PathItem] as Operation | undefined;
      if (!operation) {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed', method }));
        logger?.info(`${method} ${path} → 405`);
        return;
      }

      // Mock 응답 생성
      const mockResponse = generateMockResponse(operation, spec);
      const responseTime = Date.now() - startTime;

      res.writeHead(mockResponse.status, {
        'Content-Type': 'application/json',
        ...mockResponse.headers,
      });

      if (mockResponse.body !== null && mockResponse.body !== undefined) {
        res.end(JSON.stringify(mockResponse.body));
      } else {
        res.end();
      }

      logger?.info(`${method} ${path} → ${mockResponse.status} (${responseTime}ms)`);
      debugMock.debug(`Response: ${JSON.stringify(mockResponse.body)}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger?.error(`${method} ${path} → 500: ${errorMessage}`);

      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', message: errorMessage }));
    }
  }

  const mockServer: MockServer = {
    async listen(port: number): Promise<void> {
      // 스펙 로드
      try {
        spec = await loadSpec(options.spec);
        debugMock.info(`Loaded spec from ${options.spec}`);
      } catch (error) {
        throw new NswagMockServerError({
          errorType: 'startup',
          message: `Failed to load spec: ${error instanceof Error ? error.message : String(error)}`,
          cause: error instanceof Error ? error : undefined,
        });
      }

      // 서버 시작
      return new Promise((resolve, reject) => {
        server = createServer(handleRequest);

        server.on('error', (error) => {
          reject(
            new NswagMockServerError({
              errorType: 'startup',
              message: `Server failed to start: ${error.message}`,
              cause: error,
            })
          );
        });

        server.listen(port, () => {
          logger?.info(`Mock server listening on port ${port}`);
          debugMock.info(`Server started on port ${port}`);
          resolve();
        });
      });
    },

    async close(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (!server) {
          resolve();
          return;
        }

        server.close((error) => {
          if (error) {
            reject(
              new NswagMockServerError({
                errorType: 'shutdown',
                message: `Server failed to close: ${error.message}`,
                cause: error,
              })
            );
          } else {
            logger?.info('Mock server closed');
            debugMock.info('Server stopped');
            server = null;
            resolve();
          }
        });
      });
    },

    reset(): void {
      handlers.clear();
      if (options.handlers) {
        for (const [pattern, handler] of Object.entries(options.handlers)) {
          handlers.set(pattern, handler);
        }
      }
      debugMock.info('Handlers reset');
    },

    addHandler(pattern: string, handler: MockHandler): void {
      handlers.set(pattern, handler);
      debugMock.info(`Handler added: ${pattern}`);
    },
  };

  return mockServer;
}
