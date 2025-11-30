/**
 * mock 서브커맨드
 * 모킹 서버 시작 (mock:start)
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
 * mock:start 서브커맨드 실행
 */
export async function runMockStart(args: ParsedArgs): Promise<void> {
  logger.title('OpenAPI 모킹 서버');

  // 옵션 파싱
  let specPath = args.flags.spec as string;
  const port = parseInt(args.flags.port as string, 10) || 4000;
  const host = (args.flags.host as string) || 'localhost';
  const delay = parseInt(args.flags.delay as string, 10) || 0;
  const cors = args.flags.cors !== false;

  // 스펙 파일 경로 결정
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

  // 파일 존재 확인
  if (!existsSync(specPath)) {
    logger.error(`스펙 파일을 찾을 수 없습니다: ${specPath}`);
    process.exit(1);
  }

  // 스펙 로드
  logger.info(`스펙 파일: ${specPath}`);
  const spec = loadSpecFile(specPath);

  // 서버 생성 및 시작
  const server = createMockServer(spec, { delay, cors });

  server.listen(port, host, () => {
    logger.newline();
    logger.success(`모킹 서버 시작됨`);
    logger.info(`URL: ${colorize(`http://${host}:${port}`, 'cyan')}`);
    logger.newline();

    // 등록된 엔드포인트 출력
    printEndpoints(spec);

    logger.newline();
    logger.info('종료하려면 Ctrl+C를 누르세요.');
  });

  // 종료 시그널 처리
  process.on('SIGINT', () => {
    logger.newline();
    logger.info('서버 종료 중...');
    server.close(() => {
      logger.success('서버가 종료되었습니다.');
      process.exit(0);
    });
  });
}

/**
 * 스펙 파일 로드
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
 * Mock 서버 옵션
 */
interface MockServerOptions {
  delay?: number;
  cors?: boolean;
}

/**
 * Mock 서버 생성
 */
function createMockServer(spec: OpenAPISpec, options: MockServerOptions): Server {
  const { delay = 0, cors = true } = options;

  return createServer(async (req, res) => {
    const startTime = Date.now();
    const method = req.method?.toUpperCase() || 'GET';
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    // CORS 헤더
    if (cors) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    // OPTIONS 요청 처리 (CORS preflight)
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 라우트 매칭
    const match = matchRoute(spec.paths, pathname, method);

    if (!match) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', path: pathname, method }));
      logRequest(method, pathname, 404, Date.now() - startTime);
      return;
    }

    const { operation } = match;

    // 응답 지연
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // 응답 생성
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
 * 라우트 매칭
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
 * 경로 패턴 매칭
 */
function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  // 패턴을 정규식으로 변환
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
 * 응답 생성
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

  // 성공 응답 찾기 (200, 201 등)
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

  // 응답 스키마가 없는 경우
  if (!responseSpec || !responseSpec.content) {
    return { statusCode, body: null };
  }

  // JSON 응답 스키마 찾기
  const jsonContent = responseSpec.content['application/json'];
  if (!jsonContent?.schema) {
    return { statusCode, body: null };
  }

  // 스키마 해석 ($ref 처리)
  const schema = resolveSchema(jsonContent.schema, schemas);

  // Mock 데이터 생성
  const body = generateMock(schema);

  return { statusCode, body };
}

/**
 * 스키마 해석 ($ref 처리)
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

  // 중첩된 스키마 해석
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
 * 엔드포인트 목록 출력
 */
function printEndpoints(spec: OpenAPISpec): void {
  logger.info('등록된 엔드포인트:');

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
 * 요청 로그 출력
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
