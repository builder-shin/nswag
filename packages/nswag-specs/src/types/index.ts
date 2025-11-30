/**
 * Common type definitions
 */

// OpenAPI spec related types
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
  // String constraints
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  // Number constraints
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  // Array constraints
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  // Object constraints
  minProperties?: number;
  maxProperties?: number;
  // Metadata
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

// HTTP request/response related types
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

// Request metadata type
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

// Extended metadata (after response validation)
export interface ExtendedMetadata extends RequestMetadata {
  actualStatusCode: number;
  responseTime: number;
  validated: boolean;
  validationErrors?: string[];
}

// VCR mode type
export type VCRMode = 'record' | 'playback' | 'none';

// Base test context
export interface TestContext {
  testName: string;
  specFile: string;
  startTime: number;
  vcrMode?: VCRMode;
  [key: string]: unknown;
}

// Request context (includes supertest request)
export interface RequestContext extends TestContext {
  request: unknown; // supertest request type
}

// BeforeEach hook context
export interface BeforeEachContext extends TestContext {
  metadata: RequestMetadata;
}

// AfterEach hook context
export interface AfterEachContext extends TestContext {
  metadata: ExtendedMetadata;
  request: RequestData;
  response: ResponseData;
}

// Example context (same as AfterEach)
export type ExampleContext = AfterEachContext;

// HTTP client settings type
export interface RequestDefaults {
  headers?: Record<string, string>;
  timeout?: number;
  followRedirects?: boolean;
}

// App instance type (Express, Fastify, Koa, NestJS, etc.)
export type AppInstance = unknown;

// VCR configuration options
export interface VCROptions {
  /** Whether VCR is enabled */
  enabled: boolean;
  /** Cassette save path */
  cassettePath: string;
  /** VCR mode */
  mode: VCRMode;
}

// Request interceptor type
export type RequestInterceptor = (
  request: unknown,
  context: TestContext
) => unknown;

// OpenAPI spec info type
export interface OpenAPISpecInfo {
  openapi: string;
  info: OpenAPIInfo;
  servers?: Server[];
  components?: Components;
  security?: SecurityRequirement[];
}

// configure() function options (complete type definition)
export interface ConfigureOptions {
  /** App instance (Express, Fastify, Koa, NestJS, etc.) */
  app?: AppInstance;
  /** Running server URL */
  baseUrl?: string;

  /** OpenAPI spec file root directory */
  openapiRoot?: string;
  /** OpenAPI output format */
  openapiFormat?: 'json' | 'yaml';
  /** Whether to enforce additionalProperties: false */
  openapiNoAdditionalProperties?: boolean;
  /** Whether to enforce all properties as required */
  openapiAllPropertiesRequired?: boolean;

  /** OpenAPI spec definitions (per-spec file settings) */
  openapiSpecs?: Record<string, OpenAPISpecInfo>;

  /** Default request options */
  requestDefaults?: RequestDefaults;

  /** VCR (HTTP recording/playback) settings */
  vcr?: Partial<VCROptions>;

  /** Hook to run before each test */
  beforeEach?: (context: BeforeEachContext) => void | Promise<void>;
  /** Hook to run after each test */
  afterEach?: (example: ExampleContext) => void | Promise<void>;
  /** Request interceptor */
  requestInterceptor?: RequestInterceptor;

  /** Plugin array */
  plugins?: NswagPlugin[];
}

// Simple context for legacy compatibility
export interface SimpleTestContext {
  app: unknown;
  baseUrl?: string;
  headers?: Record<string, string>;
}

// DSL options type
export interface DSLOptions {
  basePath?: string;
  defaultContentType?: string;
  validateResponses?: boolean;
}

// Spec generation options
export interface GeneratorOptions {
  outputPath: string;
  format: 'json' | 'yaml';
  title?: string;
  version?: string;
  description?: string;
}

// Test info (for plugins)
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

// Test result (for plugins)
export interface TestResult {
  success: boolean;
  statusCode: number;
  responseTime: number;
  errors?: string[];
  validationErrors?: { path: string; message: string }[];
}

// NswagPlugin interface (based on Phase 9 specification)
export interface NswagPlugin {
  /** Plugin name */
  name: string;
  /** Hook to run before test execution */
  beforeTest?: (testInfo: TestInfo) => Promise<void>;
  /** Hook to run after test execution */
  afterTest?: (testInfo: TestInfo, result: TestResult) => Promise<void>;
  /** Hook to run before spec generation */
  beforeGenerate?: (spec: OpenAPISpec) => Promise<OpenAPISpec>;
  /** Hook to run after spec generation */
  afterGenerate?: (spec: OpenAPISpec) => Promise<OpenAPISpec>;
}

// Breaking change related types
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

// Mock server related types
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
