/**
 * DSL 빌더 모듈
 * OpenAPI 스펙을 생성하기 위한 플루언트 API 제공
 *
 * Phase 3: 기본 DSL
 * Phase 4: API 버전 및 문서화 옵션
 * Phase 5: 스키마 및 보안 기능
 */

// 기존 빌더 클래스
export { PathBuilder } from './path-builder.js';
export { OperationBuilder } from './operation-builder.js';
export { SchemaBuilder } from './schema-builder.js';

// DSL 타입 정의
export type {
  // OpenAPI 스펙 설정 타입 (Phase 4)
  // OpenAPISpecInfo는 types/index.js에서 동일한 이름으로 내보내므로 DSL 버전은 별칭 사용
  OpenAPISpecInfo as DSLOpenAPISpecInfo,
  OpenAPISpecsConfig,
  GlobalConfigOptions,
  ExternalDocsObject,
  // 컨텍스트 타입
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
  // VCROptions는 types/index.js에서 동일한 이름으로 내보내므로 DSL 버전은 별칭 사용
  VCROptions as DSLVCROptions,
  RunTestOptions,
  TestResponse,
  TestRequest,
  DSLRequestMetadata,
  DSLResponseMetadata,
  ExtendedDSLMetadata,
  OperationMetadata,
  // SecurityRequirement는 types/index.js에서 동일한 이름으로 내보내므로 DSL 버전은 별칭 사용
  SecurityRequirement as DSLSecurityRequirement,
  DSLBeforeEachContext,
  DSLAfterEachContext,
  // ExampleContext는 types/index.js에서 동일한 이름으로 내보내므로 DSL 버전은 별칭 사용
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
  // Phase 5: 스키마 및 보안 기능 타입
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

// DSL 컨텍스트 관리
export {
  DSLContextManager,
  getDSLContextManager,
  resetDSLContextManager,
  getCurrentDSLContext,
} from './context.js';

// 전역 설정 관리 (Phase 4)
export {
  GlobalConfigManager,
  configureOpenAPI,
  getGlobalConfig,
  resetGlobalConfig,
  getSpecConfig,
  getOpenAPIVersion,
} from './global-config.js';

// DSL 함수
export {
  // 구조 정의 함수
  describe,
  path,
  // HTTP 메서드 함수
  get,
  post,
  put,
  patch,
  del,
  head,
  options,
  // 메타데이터 함수
  tags,
  consumes,
  produces,
  // Operation 메타데이터 함수 (Phase 4)
  operationId,
  summary,
  description,
  deprecated,
  externalDocs,
  // 파라미터 함수
  parameter,
  requestBody,
  requestParams,
  requestHeaders,
  // 스키마 함수
  schema,
  // 응답 함수
  response,
  // 테스트 함수
  runTest,
  it,
  // 훅 함수
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  // 명시적 요청/검증 API
  submitRequest,
  assertResponseMatchesMetadata,
  // 유틸리티
  getCurrentMetadata,
  // Phase 5: 스키마 및 보안 기능
  header,
  example,
  requestBodyExample,
  security,
} from './functions.js';

// 스키마 유틸리티 (Phase 4)
export {
  normalizeNullable,
  applySchemaValidationOptions,
  processSchema,
  validateAgainstSchema,
  isOpenAPI31,
  // Phase 5: $ref 스키마 참조 해석
  registerSchema,
  clearSchemaRegistry,
  getRegisteredSchema,
  resolveSchemaRef,
  registerSchemasFromSpec,
  // Phase 5: 복합 스키마 검증
  validateOneOf,
  validateAnyOf,
  validateAllOf,
  validateCompositeSchema,
  mergeAllOfSchemas,
} from './schema-utils.js';
export type { SchemaValidationError, SchemaRegistry } from './schema-utils.js';

// 문서화 유틸리티 (Phase 4)
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

// DSL 스펙 생성기 (Phase 4)
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
