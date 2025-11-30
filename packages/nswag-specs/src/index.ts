/**
 * @aspect/nswag-specs
 * OpenAPI 기반 DSL과 테스트 러너 통합, 스펙 파일 생성
 */

// 핵심 타입 내보내기
export * from './types/index.js';

// DSL 빌더 내보내기
export * from './dsl/index.js';

// 스펙 생성기 내보내기
export * from './generator/index.js';

// 검증기 내보내기
export * from './validator/index.js';

// 설정 모듈 내보내기
export {
  defineConfig,
  loadConfig,
  resolveConfig,
  validateConfig,
  findConfigFile,
  loadConfigFile,
  getEnvironmentConfig,
  DEFAULT_CONFIG,
} from './config/index.js';

export type {
  NswagConfig,
  ResolvedNswagConfig,
  NswagPlugin,
  TestFramework,
  EnvironmentConfig,
} from './config/index.js';

// 테스팅 유틸리티 내보내기 (configure, HttpClient 등)
export {
  configure,
  getConfiguration,
  resetConfiguration,
} from './testing/configure.js';

export {
  createHttpClient,
  HttpClient,
} from './testing/http-client.js';

export {
  SpecCollector,
  getSpecCollector,
} from './testing/spec-collector.js';

export {
  ResponseValidator,
  getResponseValidator,
} from './testing/response-validator.js';

export {
  TestContextManager,
  getContextManager,
  getCurrentTestContext,
  beginTestContext,
  endTestContext,
} from './testing/context-manager.js';

export type { ExtendedTestContext } from './testing/context-manager.js';

// 에러 클래스 내보내기
export {
  NswagSchemaValidationError,
  NswagConfigurationError,
  NswagTestError,
  NswagGenerationError,
  NswagPluginError,
  NswagMockServerError,
  isNswagError,
  wrapError,
} from './errors/index.js';

// 로거 내보내기
export {
  loggers,
  debug,
  debugValidation,
  debugGenerate,
  debugTest,
  debugMock,
  debugPlugin,
  debugConfig,
  debugCompare,
  createLogger,
  isNamespaceEnabled,
  measureTime,
  measureTimeAsync,
} from './logger/index.js';

export type { Logger, LogLevel, DebugNamespace } from './logger/index.js';

// 플러그인 시스템 내보내기
export {
  definePlugin,
  PluginEngine,
  getPluginEngine,
  resetPluginEngine,
  securityAuditPlugin,
  deprecationCheckPlugin,
  timestampPlugin,
  loggingPlugin,
} from './plugin/index.js';

export type { DefinePluginOptions } from './plugin/index.js';

// 스펙 비교 내보내기
export {
  compareSpecs,
  hasBreakingChanges,
  formatCompareResult,
} from './compare/index.js';

// Mock 서버 내보내기
export { createMockServer, MockGenerator, generateMock, mockGenerator } from './mock/index.js';

// 스키마 변환기 내보내기
export * from './converter/index.js';
