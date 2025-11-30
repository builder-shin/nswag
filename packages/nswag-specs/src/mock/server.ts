/**
 * Mock server implementation
 * Phase 9 specification-based implementation
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
 * Default CORS settings
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
 * Logger interface
 */
interface Logger {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

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
 * Path pattern matching (OpenAPI path variable support)
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
 * Generate mock response
 */
function generateMockResponse(
  operation: Operation,
  spec: OpenAPISpec
): MockResponse {
  const responses = operation.responses || {};
  const mockGenerator = new MockGenerator();

  // Prioritize success response codes
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

  // Extract content
  const content = (response as { content?: Record<string, { schema?: Schema; example?: unknown }> }).content;
  if (!content) {
    return { status: parseInt(responseCode, 10), body: null };
  }

  // Prioritize application/json
  const firstKey = Object.keys(content)[0];
  const mediaType = content['application/json'] || (firstKey ? content[firstKey] : undefined);
  if (!mediaType) {
    return { status: parseInt(responseCode, 10), body: null };
  }

  // Use example if available
  if (mediaType.example) {
    return {
      status: parseInt(responseCode, 10),
      body: mediaType.example,
    };
  }

  // Generate from schema
  if (mediaType.schema) {
    // Resolve $ref
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
 * Parse request body
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
 * Parse query string
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
 * Apply delay
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
 * Apply CORS headers
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
 * Create mock server
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

  // Configure logger
  const logger: Logger | null = options.logger === true
    ? { info: (msg) => console.log(`[mock] ${msg}`), error: (msg) => console.error(`[mock] ${msg}`) }
    : options.logger === false
    ? null
    : options.logger || null;

  // Configure CORS
  const corsOptions: CorsOptions | null = options.cors === true
    ? DEFAULT_CORS
    : options.cors === false
    ? null
    : options.cors || null;

  // Register custom handlers
  if (options.handlers) {
    for (const [pattern, handler] of Object.entries(options.handlers)) {
      handlers.set(pattern, handler);
    }
  }

  /**
   * Request handler
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

    // Apply CORS headers
    if (corsOptions) {
      applyCorsHeaders(res, corsOptions, req.headers.origin);
    }

    try {
      // Apply delay
      await applyDelay(options.delay);

      // Parse request body
      const body = await parseRequestBody(req);

      // Parse query parameters
      const query = parseQuery(parsedUrl.search?.slice(1) || null);

      // Check custom handler
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

      // OpenAPI spec-based response
      if (!spec) {
        throw new NswagMockServerError({
          errorType: 'routing',
          message: 'OpenAPI spec not loaded',
          path,
        });
      }

      // Path matching
      const paths = spec.paths || {};
      let matchedPath: string | null = null;
      let matchedPathItem: PathItem | null = null;

      for (const [specPath, pathItem] of Object.entries(paths)) {
        const result = matchPath(specPath, path);
        if (result.match) {
          matchedPath = specPath;
          // TODO: Add path parameter validation using matchedParams
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

      // Check method
      const operation = matchedPathItem[method.toLowerCase() as keyof PathItem] as Operation | undefined;
      if (!operation) {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method Not Allowed', method }));
        logger?.info(`${method} ${path} → 405`);
        return;
      }

      // Generate mock response
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
      // Load spec
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

      // Start server
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
