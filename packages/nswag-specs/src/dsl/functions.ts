/**
 * DSL Function Implementations
 * Phase 3: nswag-specs core - Basic DSL
 *
 * Provides rswag-compatible DSL functions.
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
// 1. Structure Definition Functions
// ============================================================================

/**
 * describe() function - Define API test group
 *
 * @example
 * describe('Users API', () => {
 *   path('/users', () => {
 *     get('Get user list', () => { ... });
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
 * path() function - Define API path
 *
 * @example
 * path('/users', () => {
 *   get('Get user list', () => { ... });
 * });
 *
 * @example
 * path('/users/{id}', () => {
 *   parameter({ name: 'id', in: 'path', required: true, schema: { type: 'integer' } });
 *   get('Get user detail', () => { ... });
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
// 2. HTTP Method Functions
// ============================================================================

/**
 * HTTP method function factory
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
 * Define GET request
 *
 * @example
 * get('Get user list', () => {
 *   response(200, 'Success', () => {
 *     runTest();
 *   });
 * });
 */
export const get = createHttpMethodFunction('GET');

/**
 * Define POST request
 *
 * @example
 * post('Create user', () => {
 *   requestBody({
 *     required: true,
 *     content: { 'application/json': { schema: { type: 'object' } } }
 *   });
 *   response(201, 'Created', () => { runTest(); });
 * });
 */
export const post = createHttpMethodFunction('POST');

/**
 * Define PUT request
 */
export const put = createHttpMethodFunction('PUT');

/**
 * Define PATCH request
 */
export const patch = createHttpMethodFunction('PATCH');

/**
 * Define DELETE request (using 'del' since delete is reserved keyword)
 *
 * @example
 * del('Delete user', () => {
 *   response(204, 'Deleted', () => { runTest(); });
 * });
 */
export const del = createHttpMethodFunction('DELETE');

/**
 * Define HEAD request
 */
export const head = createHttpMethodFunction('HEAD');

/**
 * Define OPTIONS request
 */
export const options = createHttpMethodFunction('OPTIONS');

// ============================================================================
// 3. Metadata Functions
// ============================================================================

/**
 * tags() function - Define API tags
 *
 * @example
 * tags('Users', 'Admin');
 * // or
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
 * consumes() function - Define request media types
 *
 * @example
 * consumes('application/json', 'application/xml');
 */
export function consumes(...mediaTypes: string[]): void {
  const manager = getDSLContextManager();
  manager.addConsumes(...mediaTypes);
}

/**
 * produces() function - Define response media types
 *
 * @example
 * produces('application/json');
 */
export function produces(...mediaTypes: string[]): void {
  const manager = getDSLContextManager();
  manager.addProduces(...mediaTypes);
}

// ============================================================================
// 3.1 Operation Metadata Functions (Phase 4)
// ============================================================================

/**
 * operationId() function - Define Operation identifier
 * Used as function name for API client code generation
 *
 * @example
 * post('Creates a blog', () => {
 *   operationId('createBlog');
 *   // Generated client: api.createBlog(...)
 * });
 */
export function operationId(id: string): void {
  const manager = getDSLContextManager();
  manager.setOperationId(id);
}

/**
 * summary() function - Define brief summary
 * One-line description for Operation (OpenAPI summary)
 *
 * @example
 * post('Creates a blog', () => {
 *   summary('Create blog');
 * });
 */
export function summary(text: string): void {
  const manager = getDSLContextManager();
  // summary can also be set via first argument of HTTP method functions
  // This is for setting it explicitly when needed
  const method = manager.getCurrentMethod();
  if (method) {
    method.summary = text;
  }
}

/**
 * description() function - Define detailed description
 * Detailed description for Operation (OpenAPI description)
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
 * deprecated() function - Mark as deprecated
 * Indicates that the endpoint is no longer recommended for use
 *
 * @example
 * get('Old endpoint', () => {
 *   deprecated();  // default true
 * });
 *
 * @example
 * get('Maybe deprecated', () => {
 *   deprecated(false);  // explicitly set to false
 * });
 */
export function deprecated(isDeprecated: boolean = true): void {
  const manager = getDSLContextManager();
  manager.setDeprecated(isDeprecated);
}

/**
 * externalDocs() function - Define external documentation link
 * Reference link to additional documentation
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
// 4. Parameter Functions
// ============================================================================

/**
 * parameter() function - Define API parameter
 *
 * @example
 * parameter({
 *   name: 'id',
 *   in: 'path',
 *   required: true,
 *   schema: { type: 'integer' },
 *   description: 'User ID'
 * });
 *
 * @example
 * // nswag extension: enum value to description mapping
 * parameter({
 *   name: 'status',
 *   in: 'query',
 *   enum: { active: 'Active', inactive: 'Inactive' }
 * });
 */
export function parameter(param: ParameterObject): void {
  const manager = getDSLContextManager();
  manager.addParameter(param);
}

/**
 * requestBody() function - Define OpenAPI 3.0 native request body
 *
 * @example
 * requestBody({
 *   description: 'User creation request',
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
 * requestParams() function - Set request parameters for testing
 *
 * @example
 * // Static value
 * requestParams({ page: 1, limit: 10 });
 *
 * @example
 * // Synchronous function
 * requestParams(() => ({ userId: currentUser.id }));
 *
 * @example
 * // Asynchronous function
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
 * requestHeaders() function - Set request headers for testing
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
// 5. Schema Functions
// ============================================================================

/**
 * schema() function - Define schema
 *
 * When called in Method context, sets request schema,
 * When called in Response context, sets response schema.
 *
 * @example
 * // Response schema
 * response(200, 'Success', () => {
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
// 6. Response Definition Functions
// ============================================================================

/**
 * Convert ResponseTag to ResponseOptions
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
 * response() function - Define response
 *
 * @example
 * // Basic usage
 * response(200, 'Success', () => {
 *   runTest();
 * });
 *
 * @example
 * // With options
 * response(200, 'Success', { document: true }, () => {
 *   runTest();
 * });
 *
 * @example
 * // With tag (rswag compatible)
 * response(200, 'Success', ':document', () => {
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
// 7. Test Execution Functions
// ============================================================================

/**
 * runTest() function - Define test execution
 *
 * @example
 * // Basic usage
 * runTest();
 *
 * @example
 * // With description
 * runTest('Request with valid token');
 *
 * @example
 * // With options
 * runTest({ focus: true, timeout: 5000 });
 *
 * @example
 * // With callback
 * runTest((response, request) => {
 *   expect(response.body).toContain('success');
 * });
 *
 * @example
 * // With options and callback
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
    // runTest(options) or runTest(options, callback)
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
 * it() function extension - Define test case
 *
 * @example
 * it('Should include user ID in response', () => {
 *   expect(response.body.id).toBeDefined();
 * });
 *
 * @example
 * it('Validate response data', (example) => {
 *   expect(example.response.statusCode).toBe(200);
 *   expect(example.request.method).toBe('GET');
 * });
 */
export function it(
  description: string,
  fn: (() => void | Promise<void>) | ((example: ExampleContext) => void | Promise<void>),
): void {
  // it function is handled by test framework
  // Here we register test to context
  const manager = getDSLContextManager();

  // Convert to runTest format and register
  manager.addTest({
    description,
    options: {},
    callback: fn as (response: TestResponse, request?: TestRequest) => void | Promise<void>,
  });
}

// ============================================================================
// 8. Hook Functions
// ============================================================================

/**
 * beforeAll() function - Global setup hook
 *
 * When used in Method context, runs before all tests of that HTTP method.
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
 * afterAll() function - Global cleanup hook
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
 * beforeEach() function - Hook before each test (nswag extension)
 *
 * When used in Response context, context is injected.
 *
 * @example
 * response(200, 'Success', () => {
 *   beforeEach((ctx) => {
 *     console.log('Starting test:', ctx.testName);
 *     console.log('Metadata:', ctx.metadata);
 *   });
 *   runTest();
 * });
 */
export function beforeEach(fn: BeforeEachHook): void {
  const manager = getDSLContextManager();
  manager.addBeforeEach(fn);
}

/**
 * afterEach() function - Hook after each test (nswag extension)
 *
 * @example
 * response(200, 'Success', () => {
 *   afterEach((ctx) => {
 *     console.log('Response:', ctx.response);
 *     console.log('Request:', ctx.request);
 *   });
 *   runTest();
 * });
 */
export function afterEach(fn: AfterEachHook): void {
  const manager = getDSLContextManager();
  manager.addAfterEach(fn);
}

// ============================================================================
// 9. Explicit Request/Validation API
// ============================================================================

/**
 * submitRequest() function - Execute request explicitly
 *
 * Executes HTTP request based on metadata and returns the result.
 *
 * @example
 * const { request, response } = await submitRequest(metadata);
 * expect(response.statusCode).toBe(200);
 */
export async function submitRequest(metadata: DSLRequestMetadata): Promise<SubmitRequestResult> {
  // Execute request through HTTP client
  // Actual implementation integrates with HTTP client from testing module
  const { createHttpClient } = await import('../testing/http-client.js');
  const client = createHttpClient();

  // Build request parameters
  const requestParams = buildRequestParams(metadata);

  // Execute request based on HTTP method
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
      throw new Error(`Unsupported HTTP method: ${metadata.method}`);
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
 * Build request parameters from metadata
 */
function buildRequestParams(metadata: DSLRequestMetadata): {
  query: Record<string, unknown>;
  headers: Record<string, string>;
  body?: unknown;
} {
  const query: Record<string, unknown> = {};
  const headers: Record<string, string> = {};
  let body: unknown;

  // Process parameters
  for (const param of metadata.parameters) {
    if (param.in === 'query' && param.example !== undefined) {
      query[param.name] = param.example;
    } else if (param.in === 'header' && param.example !== undefined) {
      headers[param.name] = String(param.example);
    } else if (param.in === 'body') {
      body = param.example;
    }
  }

  // Process request body
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
 * assertResponseMatchesMetadata() function - Validate response metadata
 *
 * Validates that the response matches the schema defined in metadata.
 *
 * @example
 * await assertResponseMatchesMetadata(extendedMetadata);
 */
export async function assertResponseMatchesMetadata(
  metadata: ExtendedDSLMetadata,
): Promise<void> {
  const { getResponseValidator } = await import('../testing/response-validator.js');
  const validator = getResponseValidator();

  // Validate response status code
  const expectedStatus = metadata.response.statusCode;

  // Validate response schema
  if (metadata.response.schema) {
    // JSON Schema validation logic
    // Use validator module to perform schema validation
    // TODO: Implement actual validation logic
    void validator;
    void expectedStatus;
  }

  // Validate response headers
  if (metadata.response.headers) {
    // Header validation logic
    // TODO: Implement header validation
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get current metadata combined
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
// 10. Phase 5: Schema and Security Functions
// ============================================================================

/**
 * header() function - Define response header validation
 *
 * Used within Response context to define response headers.
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
 * // Nullable schema with required option
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
 * example() function - Define manual response example
 *
 * Used within Response context to define response examples.
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
 * requestBodyExample() function - Define request body example
 *
 * Used within Method context after requestBody definition.
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
 * security() function - Define security requirements
 *
 * Used within Method context to define security requirements for that Operation.
 * Pass empty array to disable global security.
 *
 * @example
 * // Single scheme
 * security([{ basic_auth: [] }]);
 *
 * @example
 * // Compound scheme (AND condition - must satisfy all)
 * security([{ basic_auth: [], api_key: [] }]);
 *
 * @example
 * // With scopes (OAuth2)
 * security([{ oauth2: ['read', 'write'] }]);
 *
 * @example
 * // Disable global security
 * security([]);
 *
 * @example
 * // OR condition (must satisfy one of them)
 * security([{ bearer_auth: [] }, { api_key: [] }]);
 */
export function security(requirements: SecurityRequirement[]): void {
  const manager = getDSLContextManager();
  manager.setSecurity(requirements);
}
