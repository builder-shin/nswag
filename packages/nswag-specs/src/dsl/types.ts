/**
 * DSL Type Definitions
 * Phase 3: nswag-specs core - Basic DSL
 * Phase 4: API versioning and documentation options
 */

// ============================================================================
// OpenAPI spec configuration types
// ============================================================================

/**
 * OpenAPI Spec Information
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
 * Multiple OpenAPI Spec Configuration
 */
export type OpenAPISpecsConfig = Record<string, Partial<OpenAPISpecInfo>>;

/**
 * Global Configuration Options
 */
export interface GlobalConfigOptions {
  /** OpenAPI spec file root path */
  openapiRoot?: string;
  /** Multiple OpenAPI spec configuration */
  openapiSpecs?: OpenAPISpecsConfig;
  /** Disallow additional properties in responses (global) */
  openapiNoAdditionalProperties?: boolean;
  /** Treat all properties as required (global) */
  openapiAllPropertiesRequired?: boolean;
  /** Default OpenAPI version */
  defaultOpenAPIVersion?: '3.0.3' | '3.1.0';
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * DSL Block Type
 */
export type DSLBlockType = 'describe' | 'path' | 'method' | 'response';

/**
 * HTTP Method Type
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Response Tag (rswag compatible)
 */
export type ResponseTag =
  | ':document'
  | ':openapiNoAdditionalProperties'
  | ':openapiAllPropertiesRequired'
  | ':useAsRequestExample';

// ============================================================================
// Describe Options
// ============================================================================

/**
 * describe() function options
 */
export interface DescribeOptions {
  /** Target OpenAPI spec file */
  openapiSpec?: string;
  /** Whether to include in documentation */
  document?: boolean;
}

// ============================================================================
// Parameter Related Types
// ============================================================================

/**
 * Parameter Location Type (body for rswag compatibility)
 */
export type ParameterLocation = 'query' | 'header' | 'path' | 'cookie' | 'body';

/**
 * Parameter Object (nswag extension)
 */
export interface ParameterObject {
  name: string;
  in: ParameterLocation;
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  /** nswag extension: enum value to description mapping */
  enum?: Record<string, string>;
  example?: unknown;
}

/**
 * Schema Object
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
// Request Body Related Types
// ============================================================================

/**
 * Media Type Object
 */
export interface MediaTypeObject {
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, ExampleObject>;
  encoding?: Record<string, EncodingObject>;
}

/**
 * Example Object
 */
export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

/**
 * Encoding Object
 */
export interface EncodingObject {
  contentType?: string;
  headers?: Record<string, HeaderObject>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

/**
 * Header Object
 */
export interface HeaderObject {
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: unknown;
}

/**
 * Request Body Object (OpenAPI 3.0 native)
 */
export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeObject>;
}

// ============================================================================
// Response Related Types
// ============================================================================

/**
 * Response Options
 */
export interface ResponseOptions {
  document?: boolean;
  openapiNoAdditionalProperties?: boolean;
  openapiAllPropertiesRequired?: boolean;
  useAsRequestExample?: boolean;
}

// ============================================================================
// Test Execution Related Types
// ============================================================================

/**
 * VCR Options
 */
export interface VCROptions {
  cassette?: string;
  mode?: 'record' | 'playback' | 'none';
}

/**
 * runTest() function options
 */
export interface RunTestOptions {
  focus?: boolean;
  skip?: boolean;
  timeout?: number;
  description?: string;
  vcr?: boolean | VCROptions;
}

/**
 * Test Response Object
 */
export interface TestResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Test Request Object
 */
export interface TestRequest {
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

// ============================================================================
// Metadata Types
// ============================================================================

/**
 * Request Metadata
 */
export interface DSLRequestMetadata {
  path: string;
  method: HttpMethod;
  parameters: ParameterObject[];
  requestBody?: RequestBodyObject;
  response: DSLResponseMetadata;
}

/**
 * Response Metadata
 */
export interface DSLResponseMetadata {
  statusCode: number;
  description: string;
  schema?: SchemaObject;
  headers?: Record<string, HeaderObject>;
  content?: Record<string, MediaTypeObject>;
}

/**
 * Extended Metadata (includes Operation)
 */
export interface ExtendedDSLMetadata extends DSLRequestMetadata {
  readonly operation?: OperationMetadata;
  useAsRequestExample?: boolean;
}

/**
 * Operation Metadata
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
 * External Documentation Object
 */
export interface ExternalDocsObject {
  url: string;
  description?: string;
}

/**
 * Security Requirement
 */
export type SecurityRequirement = Record<string, string[]>;

// ============================================================================
// Phase 5: Schema and Security Feature Types
// ============================================================================

/**
 * Response Header Options (for header() function)
 */
export interface HeaderOptions {
  /** Schema definition */
  schema: SchemaObject;
  /** Header description */
  description?: string;
  /** Whether required (Header Object level) */
  required?: boolean;
  /** Whether deprecated (Header Object level) */
  deprecated?: boolean;
  /** Example value */
  example?: unknown;
}

/**
 * Request Body Example Options (for requestBodyExample() function)
 */
export interface RequestBodyExampleOptions {
  /** Example value */
  value: unknown;
  /** Example name (key) */
  name?: string;
  /** Brief summary */
  summary?: string;
  /** Detailed description */
  description?: string;
}

/**
 * Security Scheme Type
 */
export type SecuritySchemeType = 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';

/**
 * API Key Security Scheme
 */
export interface ApiKeySecurityScheme {
  type: 'apiKey';
  name: string;
  in: 'query' | 'header' | 'cookie';
  description?: string;
}

/**
 * HTTP Security Scheme (Basic, Bearer, etc.)
 */
export interface HttpSecurityScheme {
  type: 'http';
  scheme: string;
  bearerFormat?: string;
  description?: string;
}

/**
 * OAuth2 Flow Object
 */
export interface OAuthFlowObject {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

/**
 * OAuth2 Flows Object
 */
export interface OAuthFlowsObject {
  implicit?: OAuthFlowObject;
  password?: OAuthFlowObject;
  clientCredentials?: OAuthFlowObject;
  authorizationCode?: OAuthFlowObject;
}

/**
 * OAuth2 Security Scheme
 */
export interface OAuth2SecurityScheme {
  type: 'oauth2';
  flows: OAuthFlowsObject;
  description?: string;
}

/**
 * OpenID Connect Security Scheme
 */
export interface OpenIdConnectSecurityScheme {
  type: 'openIdConnect';
  openIdConnectUrl: string;
  description?: string;
}

/**
 * Security Scheme Object (union type)
 */
export type SecuritySchemeObject =
  | ApiKeySecurityScheme
  | HttpSecurityScheme
  | OAuth2SecurityScheme
  | OpenIdConnectSecurityScheme;

/**
 * Extended Enum Parameter (with descriptions)
 */
export interface EnumDescriptions {
  [value: string]: string;
}

// ============================================================================
// Hook Context Types
// ============================================================================

/**
 * BeforeEach Hook Context
 */
export interface DSLBeforeEachContext {
  testName: string;
  specFile: string;
  metadata: DSLRequestMetadata;
  [key: string]: unknown;
}

/**
 * AfterEach Hook Context
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
 * Example Context (used in it function)
 */
export type ExampleContext = DSLAfterEachContext;

// ============================================================================
// submitRequest Related Types
// ============================================================================

/**
 * submitRequest Result
 */
export interface SubmitRequestResult {
  request: TestRequest;
  response: TestResponse;
}

// ============================================================================
// DSL Context Types
// ============================================================================

/**
 * Describe Context
 */
export interface DescribeContext {
  type: 'describe';
  name: string;
  options: DescribeOptions;
  children: DSLContext[];
}

/**
 * Path Context
 */
export interface PathContext {
  type: 'path';
  pathTemplate: string;
  parent: DescribeContext | null;
  methods: MethodContext[];
  parameters: ParameterObject[];
}

/**
 * Method Context
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
  /** Operation ID (for client code generation) */
  operationId?: string;
  /** Detailed description */
  description?: string;
  /** Deprecation indicator */
  deprecated?: boolean;
  /** External documentation link */
  externalDocs?: ExternalDocsObject;
  /** Security requirements (Phase 5) */
  security?: SecurityRequirement[];
}

/**
 * Response Context
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
 * Test Definition
 */
export interface TestDefinition {
  description?: string;
  options: RunTestOptions;
  callback?: (response: TestResponse, request?: TestRequest) => void | Promise<void>;
}

/**
 * It Test Definition
 */
export interface ItTestDefinition {
  description: string;
  fn: () => void | Promise<void>;
}

/**
 * DSL Context Union
 */
export type DSLContext = DescribeContext | PathContext | MethodContext | ResponseContext;

// ============================================================================
// Hook Types
// ============================================================================

export type BeforeAllHook = () => void | Promise<void>;
export type AfterAllHook = () => void | Promise<void>;
export type BeforeEachHook = (ctx: DSLBeforeEachContext) => void | Promise<void>;
export type AfterEachHook = (ctx: DSLAfterEachContext) => void | Promise<void>;
