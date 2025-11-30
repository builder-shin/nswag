/**
 * 공통 타입 정의
 */

// OpenAPI 스펙 관련 타입
export interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  paths: Record<string, PathItem>;
  components?: Components;
  servers?: Server[];
  tags?: Tag[];
}

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  termsOfService?: string;
  contact?: Contact;
  license?: License;
}

export interface Contact {
  name?: string;
  url?: string;
  email?: string;
}

export interface License {
  name: string;
  url?: string;
}

export interface Server {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariable>;
}

export interface ServerVariable {
  enum?: string[];
  default: string;
  description?: string;
}

export interface Tag {
  name: string;
  description?: string;
  externalDocs?: ExternalDocs;
}

export interface ExternalDocs {
  url: string;
  description?: string;
}

export interface PathItem {
  summary?: string;
  description?: string;
  get?: Operation;
  put?: Operation;
  post?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
  patch?: Operation;
  trace?: Operation;
  parameters?: Parameter[];
}

export interface Operation {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  deprecated?: boolean;
  security?: SecurityRequirement[];
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: Schema;
  example?: unknown;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface Response {
  description: string;
  headers?: Record<string, Header>;
  content?: Record<string, MediaType>;
}

export interface Header {
  description?: string;
  required?: boolean;
  schema?: Schema;
}

export interface MediaType {
  schema?: Schema;
  example?: unknown;
  examples?: Record<string, Example>;
}

export interface Example {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

export interface Schema {
  type?: string;
  format?: string;
  items?: Schema;
  properties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
  required?: string[];
  description?: string;
  title?: string;
  enum?: unknown[];
  default?: unknown;
  nullable?: boolean;
  $ref?: string;
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  not?: Schema;
  discriminator?: { propertyName: string; mapping?: Record<string, string> };
  // String 제약조건
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  // Number 제약조건
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  // Array 제약조건
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  // Object 제약조건
  minProperties?: number;
  maxProperties?: number;
  // 메타데이터
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  example?: unknown;
}

export interface Components {
  schemas?: Record<string, Schema>;
  responses?: Record<string, Response>;
  parameters?: Record<string, Parameter>;
  requestBodies?: Record<string, RequestBody>;
  headers?: Record<string, Header>;
  securitySchemes?: Record<string, SecurityScheme>;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export type SecurityRequirement = Record<string, string[]>;

// HTTP 요청/응답 관련 타입
export interface RequestData {
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ResponseData {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// 요청 메타데이터 타입
export interface RequestMetadata {
  operationId?: string;
  path: string;
  method: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
}

// 확장된 메타데이터 (응답 검증 후)
export interface ExtendedMetadata extends RequestMetadata {
  actualStatusCode: number;
  responseTime: number;
  validated: boolean;
  validationErrors?: string[];
}

// VCR 모드 타입
export type VCRMode = 'record' | 'playback' | 'none';

// 기본 테스트 컨텍스트
export interface TestContext {
  testName: string;
  specFile: string;
  startTime: number;
  vcrMode?: VCRMode;
  [key: string]: unknown;
}

// 요청 컨텍스트 (supertest 요청 포함)
export interface RequestContext extends TestContext {
  request: unknown; // supertest request 타입
}

// BeforeEach 훅 컨텍스트
export interface BeforeEachContext extends TestContext {
  metadata: RequestMetadata;
}

// AfterEach 훅 컨텍스트
export interface AfterEachContext extends TestContext {
  metadata: ExtendedMetadata;
  request: RequestData;
  response: ResponseData;
}

// Example 컨텍스트 (AfterEach와 동일)
export type ExampleContext = AfterEachContext;

// HTTP 클라이언트 설정 타입
export interface RequestDefaults {
  headers?: Record<string, string>;
  timeout?: number;
  followRedirects?: boolean;
}

// 앱 인스턴스 타입 (Express, Fastify, Koa, NestJS 등)
export type AppInstance = unknown;

// VCR 설정 옵션
export interface VCROptions {
  /** VCR 활성화 여부 */
  enabled: boolean;
  /** 카세트 저장 경로 */
  cassettePath: string;
  /** VCR 모드 */
  mode: VCRMode;
}

// 요청 인터셉터 타입
export type RequestInterceptor = (
  request: unknown,
  context: TestContext
) => unknown;

// OpenAPI 스펙 정보 타입
export interface OpenAPISpecInfo {
  openapi: string;
  info: OpenAPIInfo;
  servers?: Server[];
  components?: Components;
  security?: SecurityRequirement[];
}

// configure() 함수 옵션 (완전한 타입 정의)
export interface ConfigureOptions {
  /** 앱 인스턴스 (Express, Fastify, Koa, NestJS 등) */
  app?: AppInstance;
  /** 실행 중인 서버 URL */
  baseUrl?: string;

  /** OpenAPI 스펙 파일 루트 디렉토리 */
  openapiRoot?: string;
  /** OpenAPI 출력 포맷 */
  openapiFormat?: 'json' | 'yaml';
  /** additionalProperties: false 강제 여부 */
  openapiNoAdditionalProperties?: boolean;
  /** 모든 프로퍼티 required 강제 여부 */
  openapiAllPropertiesRequired?: boolean;

  /** OpenAPI 스펙 정의 (스펙 파일별 설정) */
  openapiSpecs?: Record<string, OpenAPISpecInfo>;

  /** 기본 요청 옵션 */
  requestDefaults?: RequestDefaults;

  /** VCR (HTTP 녹화/재생) 설정 */
  vcr?: Partial<VCROptions>;

  /** 각 테스트 실행 전 훅 */
  beforeEach?: (context: BeforeEachContext) => void | Promise<void>;
  /** 각 테스트 실행 후 훅 */
  afterEach?: (example: ExampleContext) => void | Promise<void>;
  /** 요청 인터셉터 */
  requestInterceptor?: RequestInterceptor;

  /** 플러그인 배열 */
  plugins?: NswagPlugin[];
}

// 레거시 호환성을 위한 간단한 컨텍스트
export interface SimpleTestContext {
  app: unknown;
  baseUrl?: string;
  headers?: Record<string, string>;
}

// DSL 옵션 타입
export interface DSLOptions {
  basePath?: string;
  defaultContentType?: string;
  validateResponses?: boolean;
}

// 스펙 생성 옵션
export interface GeneratorOptions {
  outputPath: string;
  format: 'json' | 'yaml';
  title?: string;
  version?: string;
  description?: string;
}

// 테스트 정보 (플러그인용)
export interface TestInfo {
  path: string;
  method: string;
  operationId?: string;
  tags?: string[];
  summary?: string;
  description?: string;
  security?: SecurityRequirement[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
}

// 테스트 결과 (플러그인용)
export interface TestResult {
  success: boolean;
  statusCode: number;
  responseTime: number;
  errors?: string[];
  validationErrors?: { path: string; message: string }[];
}

// NswagPlugin 인터페이스 (Phase 9 명세서 기준)
export interface NswagPlugin {
  /** 플러그인 이름 */
  name: string;
  /** 테스트 실행 전 훅 */
  beforeTest?: (testInfo: TestInfo) => Promise<void>;
  /** 테스트 실행 후 훅 */
  afterTest?: (testInfo: TestInfo, result: TestResult) => Promise<void>;
  /** 스펙 생성 전 훅 */
  beforeGenerate?: (spec: OpenAPISpec) => Promise<OpenAPISpec>;
  /** 스펙 생성 후 훅 */
  afterGenerate?: (spec: OpenAPISpec) => Promise<OpenAPISpec>;
}

// Breaking Change 관련 타입
export interface BreakingChange {
  path: string;
  method?: string;
  description: string;
  type:
    | 'removed'
    | 'type-changed'
    | 'required-added'
    | 'enum-value-removed'
    | 'response-code-removed'
    | 'parameter-removed'
    | 'parameter-required-added';
}

export interface Change {
  path: string;
  method?: string;
  description: string;
  type: 'added' | 'modified' | 'deprecated';
}

export interface DeprecatedEndpoint {
  path: string;
  method: string;
  description?: string;
}

export interface CompareSpecsResult {
  breaking: BreakingChange[];
  nonBreaking: Change[];
  deprecated: DeprecatedEndpoint[];
}

export interface CompareSpecsOptions {
  base: string;
  head: string;
}

// Mock 서버 관련 타입
export interface MockRequest {
  method: string;
  path: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string>;
  body?: unknown;
  params: Record<string, string>;
}

export interface MockResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type MockHandler = (req: MockRequest) => MockResponse | Promise<MockResponse>;

export interface CorsOptions {
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export interface MockServerOptions {
  spec: string;
  handlers?: Record<string, MockHandler>;
  delay?: { min?: number; max?: number } | number;
  cors?: boolean | CorsOptions;
  validateRequest?: boolean;
  validateResponse?: boolean;
  defaultStatusCode?: number;
  logger?: boolean | { info: (msg: string) => void; error: (msg: string) => void };
}

export interface MockServer {
  listen(port: number): Promise<void>;
  close(): Promise<void>;
  reset(): void;
  addHandler(pattern: string, handler: MockHandler): void;
}
