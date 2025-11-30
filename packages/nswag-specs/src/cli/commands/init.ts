/**
 * init 서브커맨드
 * 초기 설정 파일 및 예제 파일 생성
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { logger, type ParsedArgs } from '../utils.js';

/**
 * nswag.config.ts 템플릿
 */
const CONFIG_TEMPLATE = `import { defineConfig } from '@aspect/nswag-specs';

export default defineConfig({
  // 테스트 프레임워크 설정 ('jest' | 'vitest' | 'mocha')
  testFramework: 'jest',

  // 테스트 파일 검색 패턴
  testPatterns: [
    'spec/requests/**/*_spec.ts',
    'spec/api/**/*_spec.ts',
    'spec/integration/**/*_spec.ts',
  ],

  // 테스트 타임아웃 (밀리초)
  testTimeout: 30000,

  // dry-run 모드 (true면 실제 파일 생성하지 않음)
  dryRun: true,

  // 출력 설정
  outputDir: './openapi',
  outputFormat: 'json', // 'json' | 'yaml'
  outputFileName: 'openapi',

  // OpenAPI 정보
  openapi: {
    title: 'API Documentation',
    version: '1.0.0',
    description: 'OpenAPI 스펙 문서',
  },

  // 플러그인
  plugins: [],
});
`;

/**
 * openapi_helper.ts 템플릿
 */
const OPENAPI_HELPER_TEMPLATE = `import { configure } from '@aspect/nswag-specs';

// 앱 인스턴스 가져오기 (프로젝트에 맞게 수정)
// import { app } from '../src/app';

/**
 * OpenAPI 스펙 테스트를 위한 설정
 */
configure({
  // 앱 인스턴스 (Express, Fastify, Koa 등)
  // app: app,

  // 또는 baseUrl 사용 (외부 서버 테스트)
  // baseUrl: 'http://localhost:3000',

  // 기본 요청 설정
  requestDefaults: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: 5000,
  },
});
`;

/**
 * 예제 스펙 파일 템플릿
 */
const EXAMPLE_SPEC_TEMPLATE = `import {
  path,
  get,
  post,
  parameter,
  requestBody,
  response,
  runTest,
  requestParams,
} from '@aspect/nswag-specs';
import '../openapi_helper';

// /api/v1/blogs 경로 정의
path('/api/v1/blogs', () => {
  // GET /api/v1/blogs - 블로그 목록 조회
  get('블로그 목록 조회', {
    operationId: 'listBlogs',
    tags: ['블로그'],
  }, () => {
    // 쿼리 파라미터 정의
    parameter({ name: 'page', in: 'query', schema: { type: 'integer' } });
    parameter({ name: 'limit', in: 'query', schema: { type: 'integer' } });

    // 200 성공 응답
    response(200, '블로그 목록', () => {
      requestParams({ page: 1, limit: 10 });

      runTest(async (response, request) => {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  // POST /api/v1/blogs - 블로그 생성
  post('블로그 생성', {
    operationId: 'createBlog',
    tags: ['블로그'],
  }, () => {
    // 요청 본문 정의
    requestBody('application/json', {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['title', 'content'],
    });

    // 201 생성 성공 응답
    response(201, '블로그 생성 성공', () => {
      runTest(async (response, request) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
      });
    });

    // 400 잘못된 요청 응답
    response(400, '잘못된 요청', () => {
      runTest(async (response, request) => {
        expect(response.status).toBe(400);
      });
    });
  });
});

// /api/v1/blogs/{id} 경로 정의
path('/api/v1/blogs/{id}', () => {
  // 경로 파라미터 정의
  parameter({ name: 'id', in: 'path', required: true, schema: { type: 'integer' } });

  // GET /api/v1/blogs/{id} - 단일 블로그 조회
  get('블로그 상세 조회', {
    operationId: 'getBlog',
    tags: ['블로그'],
  }, () => {
    response(200, '블로그 상세', () => {
      requestParams({ id: 1 });

      runTest(async (response, request) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title');
      });
    });

    response(404, '블로그 없음', () => {
      requestParams({ id: 99999 });

      runTest(async (response, request) => {
        expect(response.status).toBe(404);
      });
    });
  });
});
`;

/**
 * init 커맨드 실행
 */
export async function runInit(args: ParsedArgs): Promise<void> {
  const cwd = process.cwd();
  const force = args.flags.force === true || args.flags.f === true;

  logger.title('nswag 프로젝트 초기화');

  // 1. nswag.config.ts 생성
  const configPath = resolve(cwd, 'nswag.config.ts');
  await createFile(configPath, CONFIG_TEMPLATE, 'nswag.config.ts', force);

  // 2. spec 디렉토리 생성
  const specDir = resolve(cwd, 'spec');
  if (!existsSync(specDir)) {
    mkdirSync(specDir, { recursive: true });
    logger.success('spec 디렉토리 생성됨');
  }

  // 3. spec/openapi_helper.ts 생성
  const helperPath = resolve(specDir, 'openapi_helper.ts');
  await createFile(helperPath, OPENAPI_HELPER_TEMPLATE, 'spec/openapi_helper.ts', force);

  // 4. spec/requests 디렉토리 생성
  const requestsDir = resolve(specDir, 'requests');
  if (!existsSync(requestsDir)) {
    mkdirSync(requestsDir, { recursive: true });
    logger.success('spec/requests 디렉토리 생성됨');
  }

  // 5. 예제 스펙 파일 생성
  const examplePath = resolve(requestsDir, 'blogs_spec.ts');
  await createFile(examplePath, EXAMPLE_SPEC_TEMPLATE, 'spec/requests/blogs_spec.ts', force);

  // 6. openapi 출력 디렉토리 생성
  const openapiDir = resolve(cwd, 'openapi', 'v1');
  if (!existsSync(openapiDir)) {
    mkdirSync(openapiDir, { recursive: true });
    logger.success('openapi/v1 디렉토리 생성됨');
  }

  logger.newline();
  logger.success('초기화 완료!');
  logger.newline();
  logger.info('다음 단계:');
  logger.info('  1. spec/openapi_helper.ts에서 앱 인스턴스 설정');
  logger.info('  2. spec/requests/ 디렉토리에 스펙 테스트 작성');
  logger.info('  3. npx nswag generate 실행');
  logger.newline();
}

/**
 * 파일 생성 헬퍼
 */
async function createFile(
  filePath: string,
  content: string,
  displayName: string,
  force: boolean
): Promise<void> {
  if (existsSync(filePath) && !force) {
    logger.warn(`${displayName} 이미 존재함 (덮어쓰려면 --force 사용)`);
    return;
  }

  writeFileSync(filePath, content, 'utf-8');
  logger.success(`${displayName} 생성됨`);
}
