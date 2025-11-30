/**
 * DSL 함수 구현
 * Phase 3: nswag-specs 코어 - 기본 DSL
 *
 * rswag 호환 DSL 함수들을 제공합니다.
 */

import { getDSLContextManager } from './context.js';
import type {
  DescribeOptions,
  HttpMethod,
  ParameterObject,
  RequestBodyObject,
  SchemaObject,
  ResponseOptions,
  ResponseTag,
  RunTestOptions,
  TestResponse,
  TestRequest,
  ExampleContext,
  DSLRequestMetadata,
  ExtendedDSLMetadata,
  SubmitRequestResult,
  BeforeAllHook,
  AfterAllHook,
  BeforeEachHook,
  AfterEachHook,
  ExternalDocsObject,
  SecurityRequirement,
  HeaderOptions,
  RequestBodyExampleOptions,
} from './types.js';

// ============================================================================
// 1. 구조 정의 함수
// ============================================================================

/**
 * describe() 함수 - API 테스트 그룹 정의
 *
 * @example
 * describe('Users API', () => {
 *   path('/users', () => {
 *     get('사용자 목록 조회', () => { ... });
 *   });
 * });
 *
 * @example
 * describe('Users API', { openapiSpec: 'v1/swagger.yaml', document: true }, () => {
 *   ...
 * });
 */
export function describe(name: string, fn: () => void): void;
export function describe(name: string, options: DescribeOptions, fn: () => void): void;
export function describe(
  name: string,
  optionsOrFn: DescribeOptions | (() => void),
  fn?: () => void,
): void {
  const manager = getDSLContextManager();

  let options: DescribeOptions = {};
  let callback: () => void;

  if (typeof optionsOrFn === 'function') {
    callback = optionsOrFn;
  } else {
    options = optionsOrFn;
    callback = fn!;
  }

  manager.beginDescribe(name, options);

  try {
    callback();
  } finally {
    manager.endDescribe();
  }
}

/**
 * path() 함수 - API 경로 정의
 *
 * @example
 * path('/users', () => {
 *   get('사용자 목록 조회', () => { ... });
 * });
 *
 * @example
 * path('/users/{id}', () => {
 *   parameter({ name: 'id', in: 'path', required: true, schema: { type: 'integer' } });
 *   get('사용자 상세 조회', () => { ... });
 * });
 */
export function path(pathTemplate: string, fn: () => void): void {
  const manager = getDSLContextManager();

  manager.beginPath(pathTemplate);

  try {
    fn();
  } finally {
    manager.endPath();
  }
}

// ============================================================================
// 2. HTTP 메서드 함수
// ============================================================================

/**
 * HTTP 메서드 함수 팩토리
 */
function createHttpMethodFunction(method: HttpMethod) {
  return function (summary: string, fn: () => void): void {
    const manager = getDSLContextManager();

    manager.beginMethod(method, summary);

    try {
      fn();
    } finally {
      manager.endMethod();
    }
  };
}

/**
 * GET 요청 정의
 *
 * @example
 * get('사용자 목록 조회', () => {
 *   response(200, '성공', () => {
 *     runTest();
 *   });
 * });
 */
export const get = createHttpMethodFunction('GET');

/**
 * POST 요청 정의
 *
 * @example
 * post('사용자 생성', () => {
 *   requestBody({
 *     required: true,
 *     content: { 'application/json': { schema: { type: 'object' } } }
 *   });
 *   response(201, '생성됨', () => { runTest(); });
 * });
 */
export const post = createHttpMethodFunction('POST');

/**
 * PUT 요청 정의
 */
export const put = createHttpMethodFunction('PUT');

/**
 * PATCH 요청 정의
 */
export const patch = createHttpMethodFunction('PATCH');

/**
 * DELETE 요청 정의 (delete는 예약어이므로 del 사용)
 *
 * @example
 * del('사용자 삭제', () => {
 *   response(204, '삭제됨', () => { runTest(); });
 * });
 */
export const del = createHttpMethodFunction('DELETE');

/**
 * HEAD 요청 정의
 */
export const head = createHttpMethodFunction('HEAD');

/**
 * OPTIONS 요청 정의
 */
export const options = createHttpMethodFunction('OPTIONS');

// ============================================================================
// 3. 메타데이터 함수
// ============================================================================

/**
 * tags() 함수 - API 태그 정의
 *
 * @example
 * tags('Users', 'Admin');
 * // 또는
 * tags(['Users', 'Admin']);
 */
export function tags(...tagList: string[]): void;
export function tags(tagList: string[]): void;
export function tags(firstArg: string | string[], ...rest: string[]): void {
  const manager = getDSLContextManager();

  if (Array.isArray(firstArg)) {
    manager.addTags(...firstArg);
  } else {
    manager.addTags(firstArg, ...rest);
  }
}

/**
 * consumes() 함수 - 요청 미디어 타입 정의
 *
 * @example
 * consumes('application/json', 'application/xml');
 */
export function consumes(...mediaTypes: string[]): void {
  const manager = getDSLContextManager();
  manager.addConsumes(...mediaTypes);
}

/**
 * produces() 함수 - 응답 미디어 타입 정의
 *
 * @example
 * produces('application/json');
 */
export function produces(...mediaTypes: string[]): void {
  const manager = getDSLContextManager();
  manager.addProduces(...mediaTypes);
}

// ============================================================================
// 3.1 Operation 메타데이터 함수 (Phase 4)
// ============================================================================

/**
 * operationId() 함수 - Operation 식별자 정의
 * API 클라이언트 코드 생성 시 함수명으로 사용됨
 *
 * @example
 * post('Creates a blog', () => {
 *   operationId('createBlog');
 *   // 생성된 클라이언트: api.createBlog(...)
 * });
 */
export function operationId(id: string): void {
  const manager = getDSLContextManager();
  manager.setOperationId(id);
}

/**
 * summary() 함수 - 짧은 요약 정의
 * Operation의 1줄 설명 (OpenAPI summary)
 *
 * @example
 * post('Creates a blog', () => {
 *   summary('Create blog');
 * });
 */
export function summary(text: string): void {
  const manager = getDSLContextManager();
  // summary는 HTTP 메서드 함수의 첫 번째 인자로도 설정 가능
  // 여기서는 추가로 명시적으로 설정할 때 사용
  const method = manager.getCurrentMethod();
  if (method) {
    method.summary = text;
  }
}

/**
 * description() 함수 - 상세 설명 정의
 * Operation의 상세 설명 (OpenAPI description)
 *
 * @example
 * post('Creates a blog', () => {
 *   description('Creates a new blog post from provided data. Requires authentication.');
 * });
 */
export function description(text: string): void {
  const manager = getDSLContextManager();
  manager.setDescription(text);
}

/**
 * deprecated() 함수 - 사용 중단 표시
 * 엔드포인트가 더 이상 사용되지 않음을 표시
 *
 * @example
 * get('Old endpoint', () => {
 *   deprecated();  // 기본값 true
 * });
 *
 * @example
 * get('Maybe deprecated', () => {
 *   deprecated(false);  // 명시적으로 false 설정
 * });
 */
export function deprecated(isDeprecated: boolean = true): void {
  const manager = getDSLContextManager();
  manager.setDeprecated(isDeprecated);
}

/**
 * externalDocs() 함수 - 외부 문서 링크 정의
 * 추가 문서에 대한 참조 링크
 *
 * @example
 * post('Creates a blog', () => {
 *   externalDocs({
 *     url: 'https://docs.example.com/blogs',
 *     description: 'Blog API documentation'
 *   });
 * });
 */
export function externalDocs(docs: ExternalDocsObject): void {
  const manager = getDSLContextManager();
  manager.setExternalDocs(docs);
}

// ============================================================================
// 4. 파라미터 함수
// ============================================================================

/**
 * parameter() 함수 - API 파라미터 정의
 *
 * @example
 * parameter({
 *   name: 'id',
 *   in: 'path',
 *   required: true,
 *   schema: { type: 'integer' },
 *   description: '사용자 ID'
 * });
 *
 * @example
 * // nswag 확장: enum 값과 설명 매핑
 * parameter({
 *   name: 'status',
 *   in: 'query',
 *   enum: { active: '활성', inactive: '비활성' }
 * });
 */
export function parameter(param: ParameterObject): void {
  const manager = getDSLContextManager();
  manager.addParameter(param);
}

/**
 * requestBody() 함수 - OpenAPI 3.0 네이티브 요청 본문 정의
 *
 * @example
 * requestBody({
 *   description: '사용자 생성 요청',
 *   required: true,
 *   content: {
 *     'application/json': {
 *       schema: {
 *         type: 'object',
 *         properties: {
 *           name: { type: 'string' },
 *           email: { type: 'string', format: 'email' }
 *         },
 *         required: ['name', 'email']
 *       }
 *     }
 *   }
 * });
 */
export function requestBody(body: RequestBodyObject): void {
  const manager = getDSLContextManager();
  manager.setRequestBody(body);
}

/**
 * requestParams() 함수 - 테스트용 요청 파라미터 설정
 *
 * @example
 * // 정적 값
 * requestParams({ page: 1, limit: 10 });
 *
 * @example
 * // 동기 함수
 * requestParams(() => ({ userId: currentUser.id }));
 *
 * @example
 * // 비동기 함수
 * requestParams(async () => {
 *   const user = await createTestUser();
 *   return { userId: user.id };
 * });
 */
export function requestParams(
  params:
    | Record<string, unknown>
    | (() => Record<string, unknown>)
    | (() => Promise<Record<string, unknown>>),
): void {
  const manager = getDSLContextManager();
  manager.setRequestParams(params);
}

/**
 * requestHeaders() 함수 - 테스트용 요청 헤더 설정
 *
 * @example
 * requestHeaders({
 *   'Authorization': 'Bearer token123',
 *   'X-Custom-Header': 'value'
 * });
 */
export function requestHeaders(headers: Record<string, string>): void {
  const manager = getDSLContextManager();
  manager.setRequestHeaders(headers);
}

// ============================================================================
// 5. 스키마 함수
// ============================================================================

/**
 * schema() 함수 - 스키마 정의
 *
 * Method 컨텍스트에서 호출하면 요청 스키마로,
 * Response 컨텍스트에서 호출하면 응답 스키마로 설정됩니다.
 *
 * @example
 * // 응답 스키마
 * response(200, '성공', () => {
 *   schema({
 *     type: 'object',
 *     properties: {
 *       id: { type: 'integer' },
 *       name: { type: 'string' }
 *     }
 *   });
 *   runTest();
 * });
 */
export function schema(schemaObject: SchemaObject): void {
  const manager = getDSLContextManager();
  manager.setSchema(schemaObject);
}

// ============================================================================
// 6. 응답 정의 함수
// ============================================================================

/**
 * ResponseTag를 ResponseOptions로 변환
 */
function tagToOptions(tag: ResponseTag): ResponseOptions {
  switch (tag) {
    case ':document':
      return { document: true };
    case ':openapiNoAdditionalProperties':
      return { openapiNoAdditionalProperties: true };
    case ':openapiAllPropertiesRequired':
      return { openapiAllPropertiesRequired: true };
    case ':useAsRequestExample':
      return { useAsRequestExample: true };
    default:
      return {};
  }
}

/**
 * response() 함수 - 응답 정의
 *
 * @example
 * // 기본 사용
 * response(200, '성공', () => {
 *   runTest();
 * });
 *
 * @example
 * // 옵션 사용
 * response(200, '성공', { document: true }, () => {
 *   runTest();
 * });
 *
 * @example
 * // 태그 사용 (rswag 호환)
 * response(200, '성공', ':document', () => {
 *   runTest();
 * });
 */
export function response(status: number, description: string, fn: () => void): void;
export function response(
  status: number,
  description: string,
  options: ResponseOptions,
  fn: () => void,
): void;
export function response(
  status: number,
  description: string,
  tag: ResponseTag,
  fn: () => void,
): void;
export function response(
  status: number,
  description: string,
  optionsOrTagOrFn: ResponseOptions | ResponseTag | (() => void),
  fn?: () => void,
): void {
  const manager = getDSLContextManager();

  let options: ResponseOptions = {};
  let callback: () => void;

  if (typeof optionsOrTagOrFn === 'function') {
    callback = optionsOrTagOrFn;
  } else if (typeof optionsOrTagOrFn === 'string') {
    // ResponseTag
    options = tagToOptions(optionsOrTagOrFn);
    callback = fn!;
  } else {
    options = optionsOrTagOrFn;
    callback = fn!;
  }

  manager.beginResponse(status, description, options);

  try {
    callback();
  } finally {
    manager.endResponse();
  }
}

// ============================================================================
// 7. 테스트 실행 함수
// ============================================================================

/**
 * runTest() 함수 - 테스트 실행 정의
 *
 * @example
 * // 기본 사용
 * runTest();
 *
 * @example
 * // 설명 추가
 * runTest('유효한 토큰으로 요청');
 *
 * @example
 * // 옵션 사용
 * runTest({ focus: true, timeout: 5000 });
 *
 * @example
 * // 콜백 사용
 * runTest((response, request) => {
 *   expect(response.body).toContain('success');
 * });
 *
 * @example
 * // 옵션과 콜백 함께 사용
 * runTest({ vcr: { cassette: 'users', mode: 'playback' } }, (response) => {
 *   expect(response.statusCode).toBe(200);
 * });
 */
export function runTest(): void;
export function runTest(description: string): void;
export function runTest(options: RunTestOptions): void;
export function runTest(
  callback: (response: TestResponse, request?: TestRequest) => void | Promise<void>,
): void;
export function runTest(
  options: RunTestOptions,
  callback: (response: TestResponse, request?: TestRequest) => void | Promise<void>,
): void;
export function runTest(
  optionsOrDescOrCallback?:
    | string
    | RunTestOptions
    | ((response: TestResponse, request?: TestRequest) => void | Promise<void>),
  callback?: (response: TestResponse, request?: TestRequest) => void | Promise<void>,
): void {
  const manager = getDSLContextManager();

  let options: RunTestOptions = {};
  let testCallback: ((response: TestResponse, request?: TestRequest) => void | Promise<void>) | undefined;

  if (optionsOrDescOrCallback === undefined) {
    // runTest()
  } else if (typeof optionsOrDescOrCallback === 'string') {
    // runTest(description)
    options.description = optionsOrDescOrCallback;
  } else if (typeof optionsOrDescOrCallback === 'function') {
    // runTest(callback)
    testCallback = optionsOrDescOrCallback;
  } else {
    // runTest(options) 또는 runTest(options, callback)
    options = optionsOrDescOrCallback;
    testCallback = callback;
  }

  manager.addTest({
    description: options.description,
    options,
    callback: testCallback,
  });
}

/**
 * it() 함수 확장 - 테스트 케이스 정의
 *
 * @example
 * it('응답에 사용자 ID가 포함되어야 함', () => {
 *   expect(response.body.id).toBeDefined();
 * });
 *
 * @example
 * it('응답 데이터 검증', (example) => {
 *   expect(example.response.statusCode).toBe(200);
 *   expect(example.request.method).toBe('GET');
 * });
 */
export function it(
  description: string,
  fn: (() => void | Promise<void>) | ((example: ExampleContext) => void | Promise<void>),
): void {
  // it 함수는 테스트 프레임워크에서 처리됨
  // 여기서는 컨텍스트에 테스트를 등록
  const manager = getDSLContextManager();

  // runTest 형태로 변환하여 등록
  manager.addTest({
    description,
    options: {},
    callback: fn as (response: TestResponse, request?: TestRequest) => void | Promise<void>,
  });
}

// ============================================================================
// 8. 훅 함수
// ============================================================================

/**
 * beforeAll() 함수 - 전역 설정 훅
 *
 * Method 컨텍스트에서 사용하면 해당 HTTP 메서드의 모든 테스트 전에 실행됩니다.
 *
 * @example
 * beforeAll(async () => {
 *   await setupDatabase();
 * });
 */
export function beforeAll(fn: BeforeAllHook): void {
  const manager = getDSLContextManager();
  manager.addBeforeAll(fn);
}

/**
 * afterAll() 함수 - 전역 정리 훅
 *
 * @example
 * afterAll(async () => {
 *   await cleanupDatabase();
 * });
 */
export function afterAll(fn: AfterAllHook): void {
  const manager = getDSLContextManager();
  manager.addAfterAll(fn);
}

/**
 * beforeEach() 함수 - 각 테스트 전 훅 (nswag 확장)
 *
 * Response 컨텍스트에서 사용하면 컨텍스트가 주입됩니다.
 *
 * @example
 * response(200, '성공', () => {
 *   beforeEach((ctx) => {
 *     console.log('테스트 시작:', ctx.testName);
 *     console.log('메타데이터:', ctx.metadata);
 *   });
 *   runTest();
 * });
 */
export function beforeEach(fn: BeforeEachHook): void {
  const manager = getDSLContextManager();
  manager.addBeforeEach(fn);
}

/**
 * afterEach() 함수 - 각 테스트 후 훅 (nswag 확장)
 *
 * @example
 * response(200, '성공', () => {
 *   afterEach((ctx) => {
 *     console.log('응답:', ctx.response);
 *     console.log('요청:', ctx.request);
 *   });
 *   runTest();
 * });
 */
export function afterEach(fn: AfterEachHook): void {
  const manager = getDSLContextManager();
  manager.addAfterEach(fn);
}

// ============================================================================
// 9. 명시적 요청/검증 API
// ============================================================================

/**
 * submitRequest() 함수 - 명시적 요청 실행
 *
 * 메타데이터를 기반으로 HTTP 요청을 실행하고 결과를 반환합니다.
 *
 * @example
 * const { request, response } = await submitRequest(metadata);
 * expect(response.statusCode).toBe(200);
 */
export async function submitRequest(metadata: DSLRequestMetadata): Promise<SubmitRequestResult> {
  // HTTP 클라이언트를 통해 요청 실행
  // 실제 구현은 testing 모듈의 HTTP 클라이언트와 연동
  const { createHttpClient } = await import('../testing/http-client.js');
  const client = createHttpClient();

  // 요청 파라미터 빌드
  const requestParams = buildRequestParams(metadata);

  // HTTP 메서드에 따라 요청 실행
  let response: { status: number; headers: Record<string, string>; body: unknown; text: string };

  switch (metadata.method) {
    case 'GET':
      response = await client.get(metadata.path, { query: requestParams.query, headers: requestParams.headers });
      break;
    case 'POST':
      response = await client.post(metadata.path, requestParams.body, { headers: requestParams.headers });
      break;
    case 'PUT':
      response = await client.put(metadata.path, requestParams.body, { headers: requestParams.headers });
      break;
    case 'PATCH':
      response = await client.patch(metadata.path, requestParams.body, { headers: requestParams.headers });
      break;
    case 'DELETE':
      response = await client.delete(metadata.path, { headers: requestParams.headers });
      break;
    default:
      throw new Error(`지원하지 않는 HTTP 메서드: ${metadata.method}`);
  }

  const testRequest: TestRequest = {
    path: metadata.path,
    method: metadata.method,
    headers: requestParams.headers,
    body: requestParams.body ? JSON.stringify(requestParams.body) : undefined,
  };

  const testResponse: TestResponse = {
    statusCode: response.status,
    headers: response.headers,
    body: typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
  };

  return { request: testRequest, response: testResponse };
}

/**
 * 메타데이터에서 요청 파라미터 빌드
 */
function buildRequestParams(metadata: DSLRequestMetadata): {
  query: Record<string, unknown>;
  headers: Record<string, string>;
  body?: unknown;
} {
  const query: Record<string, unknown> = {};
  const headers: Record<string, string> = {};
  let body: unknown;

  // 파라미터 처리
  for (const param of metadata.parameters) {
    if (param.in === 'query' && param.example !== undefined) {
      query[param.name] = param.example;
    } else if (param.in === 'header' && param.example !== undefined) {
      headers[param.name] = String(param.example);
    } else if (param.in === 'body') {
      body = param.example;
    }
  }

  // 요청 본문 처리
  if (metadata.requestBody?.content) {
    const contentType = Object.keys(metadata.requestBody.content)[0];
    if (contentType) {
      headers['Content-Type'] = contentType;
      const mediaType = metadata.requestBody.content[contentType];
      if (mediaType?.example) {
        body = mediaType.example;
      }
    }
  }

  return { query, headers, body };
}

/**
 * assertResponseMatchesMetadata() 함수 - 응답 메타데이터 검증
 *
 * 응답이 메타데이터에 정의된 스키마와 일치하는지 검증합니다.
 *
 * @example
 * await assertResponseMatchesMetadata(extendedMetadata);
 */
export async function assertResponseMatchesMetadata(
  metadata: ExtendedDSLMetadata,
): Promise<void> {
  const { getResponseValidator } = await import('../testing/response-validator.js');
  const validator = getResponseValidator();

  // 응답 상태 코드 검증
  const expectedStatus = metadata.response.statusCode;

  // 응답 스키마 검증
  if (metadata.response.schema) {
    // JSON Schema 검증 로직
    // validator 모듈을 사용하여 스키마 검증 수행
    // TODO: 실제 검증 로직 구현
    void validator;
    void expectedStatus;
  }

  // 응답 헤더 검증
  if (metadata.response.headers) {
    // 헤더 검증 로직
    // TODO: 헤더 검증 구현
  }
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 현재 메타데이터 조합하여 반환
 */
export function getCurrentMetadata(): DSLRequestMetadata | null {
  const manager = getDSLContextManager();

  const methodCtx = manager.getCurrentMethod();
  const responseCtx = manager.getCurrentResponse();

  if (!methodCtx || !responseCtx) {
    return null;
  }

  const fullPath = manager.getFullPath();

  return {
    path: fullPath,
    method: methodCtx.httpMethod,
    parameters: [...methodCtx.parameters],
    requestBody: methodCtx.requestBody,
    response: {
      statusCode: responseCtx.statusCode,
      description: responseCtx.description,
      schema: responseCtx.schema,
      headers: responseCtx.headers,
      content: responseCtx.content,
    },
  };
}

// ============================================================================
// 10. Phase 5: 스키마 및 보안 함수
// ============================================================================

/**
 * header() 함수 - 응답 헤더 검증 정의
 *
 * Response 컨텍스트 내에서 사용되어 응답 헤더를 정의합니다.
 *
 * @example
 * response(200, 'success', () => {
 *   header('X-Rate-Limit-Limit', {
 *     schema: { type: 'integer' },
 *     description: 'The number of allowed requests in the current period'
 *   });
 *
 *   header('X-Rate-Limit-Remaining', {
 *     schema: { type: 'integer' },
 *     description: 'The number of remaining requests in the current period'
 *   });
 *
 *   runTest();
 * });
 *
 * @example
 * // nullable 스키마와 required 옵션
 * header('X-Cursor', {
 *   schema: { type: 'string', nullable: true },
 *   description: 'Cursor for pagination',
 *   required: false
 * });
 */
export function header(name: string, options: HeaderOptions): void {
  const manager = getDSLContextManager();
  manager.addResponseHeader(name, options);
}

/**
 * example() 함수 - 수동 응답 예제 정의
 *
 * Response 컨텍스트 내에서 사용되어 응답 예제를 정의합니다.
 *
 * @example
 * response(200, 'blog found', () => {
 *   example('application/json', 'example_key', {
 *     id: 1,
 *     title: 'Hello world!',
 *     content: '...'
 *   });
 *
 *   example('application/json', 'example_key_2', {
 *     id: 1,
 *     title: 'Hello world!'
 *   }, 'Summary of the example', 'Longer description');
 *
 *   runTest();
 * });
 */
export function example(
  mediaType: string,
  key: string,
  value: unknown,
  summary?: string,
  description?: string
): void {
  const manager = getDSLContextManager();
  manager.addResponseExample(mediaType, key, value, summary, description);
}

/**
 * requestBodyExample() 함수 - 요청 본문 예제 정의
 *
 * Method 컨텍스트 내에서 requestBody 정의 후 사용합니다.
 *
 * @example
 * post('Create blog', () => {
 *   requestBody({
 *     required: true,
 *     content: {
 *       'application/json': {
 *         schema: { type: 'object', properties: { title: { type: 'string' } } }
 *       }
 *     }
 *   });
 *
 *   requestBodyExample({
 *     value: { title: 'Hello World' },
 *     name: 'basic_example',
 *     summary: 'Basic blog creation',
 *     description: 'Creates a simple blog post'
 *   });
 *
 *   response(201, 'created', () => { runTest(); });
 * });
 */
export function requestBodyExample(options: RequestBodyExampleOptions): void {
  const manager = getDSLContextManager();
  manager.addRequestBodyExample(
    options.value,
    options.name,
    options.summary,
    options.description
  );
}

/**
 * security() 함수 - 보안 요구사항 정의
 *
 * Method 컨텍스트 내에서 해당 Operation의 보안 요구사항을 정의합니다.
 * 전역 security를 비활성화하려면 빈 배열을 전달합니다.
 *
 * @example
 * // 단일 스키마
 * security([{ basic_auth: [] }]);
 *
 * @example
 * // 복합 스키마 (AND 조건 - 모두 충족해야 함)
 * security([{ basic_auth: [], api_key: [] }]);
 *
 * @example
 * // 스코프 지정 (OAuth2)
 * security([{ oauth2: ['read', 'write'] }]);
 *
 * @example
 * // 전역 security 비활성화
 * security([]);
 *
 * @example
 * // OR 조건 (둘 중 하나만 충족하면 됨)
 * security([{ bearer_auth: [] }, { api_key: [] }]);
 */
export function security(requirements: SecurityRequirement[]): void {
  const manager = getDSLContextManager();
  manager.setSecurity(requirements);
}
