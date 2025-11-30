/**
 * DSL 타입 정의
 * Phase 3: nswag-specs 코어 - 기본 DSL
 * Phase 4: API 버전 및 문서화 옵션
 */

// ============================================================================
// OpenAPI 스펙 설정 타입
// ============================================================================

/**
 * OpenAPI 스펙 정보
 */
export interface OpenAPISpecInfo {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
    variables?: Record<string, {
      enum?: string[];
      default: string;
      description?: string;
    }>;
  }>;
  tags?: Array<{
    name: string;
    description?: string;
    externalDocs?: {
      url: string;
      description?: string;
    };
  }>;
  externalDocs?: {
    url: string;
    description?: string;
  };
}

/**
 * 다중 OpenAPI 스펙 설정
 */
export type OpenAPISpecsConfig = Record<string, Partial<OpenAPISpecInfo>>;

/**
 * 전역 설정 옵션
 */
export interface GlobalConfigOptions {
  /** OpenAPI 스펙 파일 루트 경로 */
  openapiRoot?: string;
  /** 다중 OpenAPI 스펙 설정 */
  openapiSpecs?: OpenAPISpecsConfig;
  /** 응답에 추가 속성 허용 안함 (전역) */
  openapiNoAdditionalProperties?: boolean;
  /** 모든 속성을 필수로 처리 (전역) */
  openapiAllPropertiesRequired?: boolean;
  /** 기본 OpenAPI 버전 */
  defaultOpenAPIVersion?: '3.0.3' | '3.1.0';
}

// ============================================================================
// 컨텍스트 타입
// ============================================================================

/**
 * DSL 블록 타입
 */
export type DSLBlockType = 'describe' | 'path' | 'method' | 'response';

/**
 * HTTP 메서드 타입
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * 응답 태그 (rswag 호환)
 */
export type ResponseTag =
  | ':document'
  | ':openapiNoAdditionalProperties'
  | ':openapiAllPropertiesRequired'
  | ':useAsRequestExample';

// ============================================================================
// Describe 옵션
// ============================================================================

/**
 * describe() 함수 옵션
 */
export interface DescribeOptions {
  /** 대상 OpenAPI 스펙 파일 */
  openapiSpec?: string;
  /** 문서화 포함 여부 */
  document?: boolean;
}

// ============================================================================
// 파라미터 관련 타입
// ============================================================================

/**
 * 파라미터 위치 타입 (body는 rswag 호환)
 */
export type ParameterLocation = 'query' | 'header' | 'path' | 'cookie' | 'body';

/**
 * 파라미터 객체 (nswag 확장)
 */
export interface ParameterObject {
  name: string;
  in: ParameterLocation;
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  /** nswag 확장: enum 값과 설명 매핑 */
  enum?: Record<string, string>;
  example?: unknown;
}

/**
 * 스키마 객체
 */
export interface SchemaObject {
  type?: string;
  format?: string;
  items?: SchemaObject;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  nullable?: boolean;
  $ref?: string;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | SchemaObject;
  example?: unknown;
}

// ============================================================================
// 요청 본문 관련 타입
// ============================================================================

/**
 * 미디어 타입 객체
 */
export interface MediaTypeObject {
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, ExampleObject>;
  encoding?: Record<string, EncodingObject>;
}

/**
 * 예제 객체
 */
export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

/**
 * 인코딩 객체
 */
export interface EncodingObject {
  contentType?: string;
  headers?: Record<string, HeaderObject>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

/**
 * 헤더 객체
 */
export interface HeaderObject {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: unknown;
}

/**
 * 요청 본문 객체 (OpenAPI 3.0 네이티브)
 */
export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeObject>;
}

// ============================================================================
// 응답 관련 타입
// ============================================================================

/**
 * 응답 옵션
 */
export interface ResponseOptions {
  document?: boolean;
  openapiNoAdditionalProperties?: boolean;
  openapiAllPropertiesRequired?: boolean;
  useAsRequestExample?: boolean;
}

// ============================================================================
// 테스트 실행 관련 타입
// ============================================================================

/**
 * VCR 옵션
 */
export interface VCROptions {
  cassette?: string;
  mode?: 'record' | 'playback' | 'none';
}

/**
 * runTest() 함수 옵션
 */
export interface RunTestOptions {
  focus?: boolean;
  skip?: boolean;
  timeout?: number;
  description?: string;
  vcr?: boolean | VCROptions;
}

/**
 * 테스트 응답 객체
 */
export interface TestResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * 테스트 요청 객체
 */
export interface TestRequest {
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

// ============================================================================
// 메타데이터 타입
// ============================================================================

/**
 * 요청 메타데이터
 */
export interface DSLRequestMetadata {
  path: string;
  method: HttpMethod;
  parameters: ParameterObject[];
  requestBody?: RequestBodyObject;
  response: DSLResponseMetadata;
}

/**
 * 응답 메타데이터
 */
export interface DSLResponseMetadata {
  statusCode: number;
  description: string;
  schema?: SchemaObject;
  headers?: Record<string, HeaderObject>;
  content?: Record<string, MediaTypeObject>;
}

/**
 * 확장된 메타데이터 (Operation 포함)
 */
export interface ExtendedDSLMetadata extends DSLRequestMetadata {
  readonly operation?: OperationMetadata;
  useAsRequestExample?: boolean;
}

/**
 * 오퍼레이션 메타데이터
 */
export interface OperationMetadata {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  security?: SecurityRequirement[];
  consumes?: string[];
  produces?: string[];
  externalDocs?: ExternalDocsObject;
}

/**
 * 외부 문서 객체
 */
export interface ExternalDocsObject {
  url: string;
  description?: string;
}

/**
 * 보안 요구사항
 */
export type SecurityRequirement = Record<string, string[]>;

// ============================================================================
// Phase 5: 스키마 및 보안 기능 타입
// ============================================================================

/**
 * 응답 헤더 옵션 (header() 함수용)
 */
export interface HeaderOptions {
  /** 스키마 정의 */
  schema: SchemaObject;
  /** 헤더 설명 */
  description?: string;
  /** 필수 여부 (Header Object 레벨) */
  required?: boolean;
  /** 사용 중단 여부 (Header Object 레벨) */
  deprecated?: boolean;
  /** 예제 값 */
  example?: unknown;
}

/**
 * 요청 본문 예제 옵션 (requestBodyExample() 함수용)
 */
export interface RequestBodyExampleOptions {
  /** 예제 값 */
  value: unknown;
  /** 예제 이름 (키) */
  name?: string;
  /** 간단한 요약 */
  summary?: string;
  /** 상세 설명 */
  description?: string;
}

/**
 * 보안 스키마 타입
 */
export type SecuritySchemeType = 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';

/**
 * API Key 보안 스키마
 */
export interface ApiKeySecurityScheme {
  type: 'apiKey';
  name: string;
  in: 'query' | 'header' | 'cookie';
  description?: string;
}

/**
 * HTTP 보안 스키마 (Basic, Bearer 등)
 */
export interface HttpSecurityScheme {
  type: 'http';
  scheme: string;
  bearerFormat?: string;
  description?: string;
}

/**
 * OAuth2 플로우 객체
 */
export interface OAuthFlowObject {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

/**
 * OAuth2 플로우들
 */
export interface OAuthFlowsObject {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
}

/**
 * OAuth2 보안 스키마
 */
export interface OAuth2SecurityScheme {
  type: 'oauth2';
  flows: OAuthFlowsObject;
  description?: string;
}

/**
 * OpenID Connect 보안 스키마
 */
export interface OpenIdConnectSecurityScheme {
  type: 'openIdConnect';
  openIdConnectUrl: string;
  description?: string;
}

/**
 * 보안 스키마 객체 (유니온 타입)
 */
export type SecuritySchemeObject =
  | ApiKeySecurityScheme
  | HttpSecurityScheme
  | OAuth2SecurityScheme
  | OpenIdConnectSecurityScheme;

/**
 * 확장된 Enum 파라미터 (설명 포함)
 */
export interface EnumDescriptions {
  [value: string]: string;
}

// ============================================================================
// 훅 컨텍스트 타입
// ============================================================================

/**
 * BeforeEach 훅 컨텍스트
 */
export interface DSLBeforeEachContext {
  testName: string;
  specFile: string;
  metadata: DSLRequestMetadata;
  [key: string]: unknown;
}

/**
 * AfterEach 훅 컨텍스트
 */
export interface DSLAfterEachContext {
  testName: string;
  specFile: string;
  metadata: ExtendedDSLMetadata;
  request: TestRequest;
  response: TestResponse;
  [key: string]: unknown;
}

/**
 * Example 컨텍스트 (it 함수에서 사용)
 */
export type ExampleContext = DSLAfterEachContext;

// ============================================================================
// submitRequest 관련 타입
// ============================================================================

/**
 * submitRequest 결과
 */
export interface SubmitRequestResult {
  request: TestRequest;
  response: TestResponse;
}

// ============================================================================
// DSL 컨텍스트 타입
// ============================================================================

/**
 * Describe 컨텍스트
 */
export interface DescribeContext {
  type: 'describe';
  name: string;
  options: DescribeOptions;
  children: DSLContext[];
}

/**
 * Path 컨텍스트
 */
export interface PathContext {
  type: 'path';
  pathTemplate: string;
  parent: DescribeContext | null;
  methods: MethodContext[];
  parameters: ParameterObject[];
}

/**
 * Method 컨텍스트
 */
export interface MethodContext {
  type: 'method';
  httpMethod: HttpMethod;
  summary: string;
  parent: PathContext | null;
  tags: string[];
  consumes: string[];
  produces: string[];
  parameters: ParameterObject[];
  requestBody?: RequestBodyObject;
  schema?: SchemaObject;
  requestParams: Record<string, unknown> | (() => Record<string, unknown>) | (() => Promise<Record<string, unknown>>);
  requestHeaders: Record<string, string>;
  responses: ResponseContext[];
  beforeAllHooks: Array<() => void | Promise<void>>;
  afterAllHooks: Array<() => void | Promise<void>>;
  /** Operation ID (클라이언트 코드 생성용) */
  operationId?: string;
  /** 상세 설명 */
  description?: string;
  /** 사용 중단 표시 */
  deprecated?: boolean;
  /** 외부 문서 링크 */
  externalDocs?: ExternalDocsObject;
  /** 보안 요구사항 (Phase 5) */
  security?: SecurityRequirement[];
}

/**
 * Response 컨텍스트
 */
export interface ResponseContext {
  type: 'response';
  statusCode: number;
  description: string;
  options: ResponseOptions;
  parent: MethodContext | null;
  schema?: SchemaObject;
  headers?: Record<string, HeaderObject>;
  content?: Record<string, MediaTypeObject>;
  beforeEachHooks: Array<(ctx: DSLBeforeEachContext) => void | Promise<void>>;
  afterEachHooks: Array<(ctx: DSLAfterEachContext) => void | Promise<void>>;
  tests: TestDefinition[];
}

/**
 * 테스트 정의
 */
export interface TestDefinition {
  description?: string;
  options: RunTestOptions;
  callback?: (response: TestResponse, request?: TestRequest) => void | Promise<void>;
}

/**
 * It 테스트 정의
 */
export interface ItTestDefinition {
  description: string;
  fn: () => void | Promise<void>;
}

/**
 * DSL 컨텍스트 유니온
 */
export type DSLContext = DescribeContext | PathContext | MethodContext | ResponseContext;

// ============================================================================
// 훅 타입
// ============================================================================

export type BeforeAllHook = () => void | Promise<void>;
export type AfterAllHook = () => void | Promise<void>;
export type BeforeEachHook = (ctx: DSLBeforeEachContext) => void | Promise<void>;
export type AfterEachHook = (ctx: DSLAfterEachContext) => void | Promise<void>;
