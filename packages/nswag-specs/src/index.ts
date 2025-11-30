/**
 * @builder-shin/nswag-specs
 * OpenAPI-based DSL and test runner integration, spec file generation
 */

// Export core types
export * from './types/index.js';

// Export DSL builder
export * from './dsl/index.js';

// Export spec generator
export * from './generator/index.js';

// Export validator
export * from './validator/index.js';

// Export config module
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

// Export testing utilities (configure, HttpClient, etc.)
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

// Export error classes
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

// Export logger
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

// Export plugin system
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

// Export spec comparison
export {
  compareSpecs,
  hasBreakingChanges,
  formatCompareResult,
} from './compare/index.js';

// Export mock server
export { createMockServer, MockGenerator, generateMock, mockGenerator } from './mock/index.js';

// Export schema converters
export * from './converter/index.js';
