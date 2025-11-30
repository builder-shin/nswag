/**
 * DSL Builder Module
 * Provides fluent API for generating OpenAPI specs
 *
 * Phase 3: Basic DSL
 * Phase 4: API versioning and documentation options
 * Phase 5: Schema and security features
 */

// Existing builder classes
export { PathBuilder } from './path-builder.js';
export { OperationBuilder } from './operation-builder.js';
export { SchemaBuilder } from './schema-builder.js';

// DSL type definitions
export type {
  // OpenAPI spec configuration types (Phase 4)
  // Using alias for DSL version as OpenAPISpecInfo is exported with same name from types/index.js
  OpenAPISpecInfo as DSLOpenAPISpecInfo,
  OpenAPISpecsConfig,
  GlobalConfigOptions,
  ExternalDocsObject,
  // Context types
  DSLBlockType,
  HttpMethod,
  ResponseTag,
  DescribeOptions,
  ParameterLocation,
  ParameterObject,
  SchemaObject,
  MediaTypeObject,
  ExampleObject,
  EncodingObject,
  HeaderObject,
  RequestBodyObject,
  ResponseOptions,
  // Using alias for DSL version as VCROptions is exported with same name from types/index.js
  VCROptions as DSLVCROptions,
  RunTestOptions,
  TestResponse,
  TestRequest,
  DSLRequestMetadata,
  DSLResponseMetadata,
  ExtendedDSLMetadata,
  OperationMetadata,
  // Using alias for DSL version as SecurityRequirement is exported with same name from types/index.js
  SecurityRequirement as DSLSecurityRequirement,
  DSLBeforeEachContext,
  DSLAfterEachContext,
  // Using alias for DSL version as ExampleContext is exported with same name from types/index.js
  ExampleContext as DSLExampleContext,
  SubmitRequestResult,
  DescribeContext,
  PathContext,
  MethodContext,
  ResponseContext,
  TestDefinition,
  ItTestDefinition,
  DSLContext,
  BeforeAllHook,
  AfterAllHook,
  BeforeEachHook,
  AfterEachHook,
  // Phase 5: Schema and security feature types
  HeaderOptions,
  RequestBodyExampleOptions,
  SecuritySchemeType,
  ApiKeySecurityScheme,
  HttpSecurityScheme,
  OAuthFlowObject,
  OAuthFlowsObject,
  OAuth2SecurityScheme,
  OpenIdConnectSecurityScheme,
  SecuritySchemeObject,
  EnumDescriptions,
} from './types.js';

// DSL context management
export {
  DSLContextManager,
  getDSLContextManager,
  resetDSLContextManager,
  getCurrentDSLContext,
} from './context.js';

// Global configuration management (Phase 4)
export {
  GlobalConfigManager,
  configureOpenAPI,
  getGlobalConfig,
  resetGlobalConfig,
  getSpecConfig,
  getOpenAPIVersion,
} from './global-config.js';

// DSL functions
export {
  // Structure definition functions
  describe,
  path,
  // HTTP method functions
  get,
  post,
  put,
  patch,
  del,
  head,
  options,
  // Metadata functions
  tags,
  consumes,
  produces,
  // Operation metadata functions (Phase 4)
  operationId,
  summary,
  description,
  deprecated,
  externalDocs,
  // Parameter functions
  parameter,
  requestBody,
  requestParams,
  requestHeaders,
  // Schema functions
  schema,
  // Response functions
  response,
  // Test functions
  runTest,
  it,
  // Hook functions
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  // Explicit request/validation API
  submitRequest,
  assertResponseMatchesMetadata,
  // Utilities
  getCurrentMetadata,
  // Phase 5: Schema and security features
  header,
  example,
  requestBodyExample,
  security,
} from './functions.js';

// Schema utilities (Phase 4)
export {
  normalizeNullable,
  applySchemaValidationOptions,
  processSchema,
  validateAgainstSchema,
  isOpenAPI31,
  // Phase 5: $ref schema reference resolution
  registerSchema,
  clearSchemaRegistry,
  getRegisteredSchema,
  resolveSchemaRef,
  registerSchemasFromSpec,
  // Phase 5: Composite schema validation
  validateOneOf,
  validateAnyOf,
  validateAllOf,
  validateCompositeSchema,
  mergeAllOfSchemas,
} from './schema-utils.js';
export type { SchemaValidationError, SchemaRegistry } from './schema-utils.js';

// Documentation utilities (Phase 4)
export {
  shouldDocument,
  shouldDocumentResponse,
  filterDocumentableResponses,
  filterDocumentableMethods,
  filterDocumentablePaths,
  getTargetSpec,
  groupBySpec,
  flattenDescribes,
  extractPaths,
  calculateDocumentationStats,
} from './document-utils.js';
export type { DocumentationStats } from './document-utils.js';

// DSL spec generator (Phase 4)
export {
  DSLSpecGenerator,
  generateAllSpecs,
  generateSpec,
  generateSpecJSON,
  generateSpecYAML,
} from './spec-generator.js';
export type {
  GeneratedOpenAPISpec,
  GeneratedPathItem,
  GeneratedOperation,
  GeneratedParameter,
  GeneratedRequestBody,
  GeneratedResponse,
  MultiSpecResult,
} from './spec-generator.js';
