/**
 * mock subcommand
 * Start mocking server (mock:start)
 */

import { existsSync, readFileSync } from 'fs';
import { createServer, type Server } from 'http';
import { resolve, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import { loadConfig } from '../../config/index.js';
import { generateMock } from '../../mock/index.js';
import { logger, type ParsedArgs, colorize } from '../utils.js';
import type { OpenAPISpec, PathItem, Operation, Schema } from '../../types/index.js';

/**
 * Execute mock:start subcommand
 */
export async function runMockStart(args: ParsedArgs): Promise<void> {
  logger.title('OpenAPI Mocking Server');

  // Parse options
  let specPath = args.flags.spec as string;
  const port = parseInt(args.flags.port as string, 10) || 4000;
  const host = (args.flags.host as string) || 'localhost';
  const delay = parseInt(args.flags.delay as string, 10) || 0;
  const cors = args.flags.cors !== false;

  // Determine spec file path
  if (!specPath) {
    const configPath = args.flags.config as string | undefined || args.flags.c as string | undefined;
    const config = await loadConfig(configPath);
    specPath = resolve(
      process.cwd(),
      config.outputDir,
      `${config.outputFileName}.${config.outputFormat}`
    );
  } else {
    specPath = resolve(process.cwd(), specPath);
  }

  // Check file existence
  if (!existsSync(specPath)) {
    logger.error(`Spec file not found: ${specPath}`);
    process.exit(1);
  }

  // Load spec
  logger.info(`Spec file: ${specPath}`);
  const spec = loadSpecFile(specPath);

  // Create and start server
  const server = createMockServer(spec, { delay, cors });

  server.listen(port, host, () => {
    logger.newline();
    logger.success(`Mocking server started`);
    logger.info(`URL: ${colorize(`http://${host}:${port}`, 'cyan')}`);
    logger.newline();

    // Print registered endpoints
    printEndpoints(spec);

    logger.newline();
    logger.info('Press Ctrl+C to quit.');
  });

  // Handle termination signals
  process.on('SIGINT', () => {
    logger.newline();
    logger.info('Shutting down server...');
    server.close(() => {
      logger.success('Server closed.');
      process.exit(0);
    });
  });
}

/**
 * Load spec file
 */
function loadSpecFile(filePath: string): OpenAPISpec {
  const content = readFileSync(filePath, 'utf-8');
  const ext = extname(filePath).toLowerCase();

  if (ext === '.yaml' || ext === '.yml') {
    return parseYaml(content) as OpenAPISpec;
  }

  return JSON.parse(content);
}

/**
 * Mock server options
 */
interface MockServerOptions {
  delay?: number;
  cors?: boolean;
}

/**
 * Create mock server
 */
function createMockServer(spec: OpenAPISpec, options: MockServerOptions): Server {
  const { delay = 0, cors = true } = options;

  return createServer(async (req, res) => {
    const startTime = Date.now();
    const method = req.method?.toUpperCase() || 'GET';
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // CORS headers
    if (cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    // Handle OPTIONS request (CORS preflight)
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Route matching
    const match = matchRoute(spec.paths, pathname, method);

    if (!match) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', path: pathname, method }));
      logRequest(method, pathname, 404, Date.now() - startTime);
      return;
    }

    const { operation } = match;

    // Apply response delay
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Generate response
    const response = generateResponse(operation, spec.components?.schemas || {});

    res.writeHead(response.statusCode, {
      'Content-Type': 'application/json',
      'X-Mock-Response': 'true',
    });
    res.end(JSON.stringify(response.body, null, 2));

    logRequest(method, pathname, response.statusCode, Date.now() - startTime);
  });
}

/**
 * Route matching
 */
interface RouteMatch {
  operation: Operation;
  pathParams: Record<string, string>;
}

function matchRoute(
  paths: Record<string, PathItem>,
  pathname: string,
  method: string
): RouteMatch | null {
  const lowerMethod = method.toLowerCase() as keyof PathItem;

  for (const [pathPattern, pathItem] of Object.entries(paths)) {
    const operation = pathItem[lowerMethod] as Operation | undefined;
    if (!operation) continue;

    const match = matchPath(pathPattern, pathname);
    if (match) {
      return { operation, pathParams: match };
    }
  }

  return null;
}

/**
 * Path pattern matching
 */
function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  // Convert pattern to regex
  const paramNames: string[] = [];
  const regexPattern = pattern.replace(/\{([^}]+)\}/g, (_, paramName) => {
    paramNames.push(paramName);
    return '([^/]+)';
  });

  const regex = new RegExp(`^${regexPattern}$`);
  const match = pathname.match(regex);

  if (!match) return null;

  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    const value = match[index + 1];
    if (value !== undefined) {
      params[name] = value;
    }
  });

  return params;
}

/**
 * Generate response
 */
interface MockResponse {
  statusCode: number;
  body: unknown;
}

function generateResponse(
  operation: Operation,
  schemas: Record<string, Schema>
): MockResponse {
  const { responses } = operation;

  // Find success response (200, 201, etc.)
  const successCodes = ['200', '201', '204'];
  let statusCode = 200;
  let responseSpec: { description: string; content?: Record<string, { schema?: Schema }> } | undefined;

  for (const code of successCodes) {
    if (responses[code]) {
      statusCode = parseInt(code, 10);
      responseSpec = responses[code];
      break;
    }
  }

  // If no response schema
  if (!responseSpec || !responseSpec.content) {
    return { statusCode, body: null };
  }

  // Find JSON response schema
  const jsonContent = responseSpec.content['application/json'];
  if (!jsonContent?.schema) {
    return { statusCode, body: null };
  }

  // Resolve schema ($ref handling)
  const schema = resolveSchema(jsonContent.schema, schemas);

  // Generate mock data
  const body = generateMock(schema);

  return { statusCode, body };
}

/**
 * Resolve schema ($ref handling)
 */
function resolveSchema(schema: Schema, schemas: Record<string, Schema>): Schema {
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/components/schemas/', '');
    const resolved = schemas[refPath];
    if (resolved) {
      return resolveSchema(resolved, schemas);
    }
    return {};
  }

  // Resolve nested schemas
  const result: Schema = { ...schema };

  if (result.properties) {
    result.properties = {};
    for (const [key, propSchema] of Object.entries(schema.properties || {})) {
      result.properties[key] = resolveSchema(propSchema, schemas);
    }
  }

  if (result.items && schema.items) {
    result.items = resolveSchema(schema.items, schemas);
  }

  return result;
}

/**
 * Print endpoint list
 */
function printEndpoints(spec: OpenAPISpec): void {
  logger.info('Registered endpoints:');

  const methods = ['get', 'post', 'put', 'delete', 'patch'] as const;

  const colors: Record<string, string> = {
    get: '\x1b[32m',
    post: '\x1b[33m',
    put: '\x1b[34m',
    delete: '\x1b[31m',
    patch: '\x1b[35m',
    reset: '\x1b[0m',
  };

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of methods) {
      const operation = pathItem[method];
      if (operation) {
        const colorCode = colors[method] ?? '';
        const methodStr = method.toUpperCase().padEnd(7);
        const summary = operation.summary ? ` - ${operation.summary}` : '';
        console.log(`  ${colorCode}${methodStr}${colors.reset} ${path}${summary}`);
      }
    }
  }
}

/**
 * Log request
 */
function logRequest(method: string, path: string, status: number, duration: number): void {
  const statusColor = status < 400 ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  const dim = '\x1b[2m';

  console.log(
    `${dim}${new Date().toISOString()}${reset} ` +
    `${method.padEnd(7)} ${path} ` +
    `${statusColor}${status}${reset} ` +
    `${dim}${duration}ms${reset}`
  );
}
