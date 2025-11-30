/**
 * Nswag error class definitions
 * Implementation based on Phase 9 specification
 */

import type { Schema, OpenAPISpec } from '../types/index.js';

/**
 * Schema validation error
 * Thrown when the response body does not match the OpenAPI schema
 */
export class NswagSchemaValidationError extends Error {
  /** List of validation errors */
  errors: { path: string; message: string }[];
  /** Expected schema */
  expectedSchema: Schema;
  /** Actual response */
  actualResponse: unknown;
  /** HTTP path */
  requestPath?: string;
  /** HTTP method */
  requestMethod?: string;
  /** HTTP status code */
  statusCode?: number;

  constructor(options: {
    errors: { path: string; message: string }[];
    expectedSchema: Schema;
    actualResponse: unknown;
    requestPath?: string;
    requestMethod?: string;
    statusCode?: number;
  }) {
    const message = NswagSchemaValidationError.formatMessage(options);
    super(message);
    this.name = 'NswagSchemaValidationError';
    this.errors = options.errors;
    this.expectedSchema = options.expectedSchema;
    this.actualResponse = options.actualResponse;
    this.requestPath = options.requestPath;
    this.requestMethod = options.requestMethod;
    this.statusCode = options.statusCode;

    // Preserve Error stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NswagSchemaValidationError);
    }
  }

  private static formatMessage(options: {
    errors: { path: string; message: string }[];
    expectedSchema: Schema;
    actualResponse: unknown;
    requestPath?: string;
    requestMethod?: string;
    statusCode?: number;
  }): string {
    const lines: string[] = [
      'Response body does not match schema',
      '',
    ];

    if (options.requestPath) {
      lines.push(`Path: ${options.requestPath}`);
    }
    if (options.requestMethod) {
      lines.push(`Method: ${options.requestMethod.toUpperCase()}`);
    }
    if (options.statusCode) {
      lines.push(`Status: ${options.statusCode}`);
    }

    lines.push('');
    lines.push('Expected schema:');
    lines.push(JSON.stringify(options.expectedSchema, null, 2));
    lines.push('');
    lines.push('Actual response:');
    lines.push(JSON.stringify(options.actualResponse, null, 2));
    lines.push('');
    lines.push('Validation errors:');

    for (const error of options.errors) {
      lines.push(`  - ${error.path}: ${error.message}`);
    }

    return lines.join('\n');
  }
}

/**
 * Configuration error
 * Thrown when configure() function or nswag.config.ts has invalid settings
 */
export class NswagConfigurationError extends Error {
  /** Invalid configuration key */
  configKey: string;
  /** Invalid value */
  invalidValue: unknown;
  /** Expected type */
  expectedType: string;
  /** Additional hint */
  hint?: string;

  constructor(options: {
    configKey: string;
    invalidValue: unknown;
    expectedType: string;
    hint?: string;
  }) {
    const message = NswagConfigurationError.formatMessage(options);
    super(message);
    this.name = 'NswagConfigurationError';
    this.configKey = options.configKey;
    this.invalidValue = options.invalidValue;
    this.expectedType = options.expectedType;
    this.hint = options.hint;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NswagConfigurationError);
    }
  }

  private static formatMessage(options: {
    configKey: string;
    invalidValue: unknown;
    expectedType: string;
    hint?: string;
  }): string {
    const lines: string[] = [
      `Invalid configuration for "${options.configKey}"`,
      '',
      `Expected type: ${options.expectedType}`,
      `Received: ${JSON.stringify(options.invalidValue)}`,
    ];

    if (options.hint) {
      lines.push('');
      lines.push(`Hint: ${options.hint}`);
    }

    return lines.join('\n');
  }
}

/**
 * Test execution error
 * Thrown during test execution
 */
export class NswagTestError extends Error {
  /** Test name */
  testName: string;
  /** HTTP path */
  path: string;
  /** HTTP method */
  method: string;
  /** Cause error */
  cause?: Error;
  /** Failure phase */
  phase?: 'setup' | 'request' | 'validation' | 'teardown';

  constructor(options: {
    testName: string;
    path: string;
    method: string;
    cause?: Error;
    phase?: 'setup' | 'request' | 'validation' | 'teardown';
    message?: string;
  }) {
    const message = options.message || NswagTestError.formatMessage(options);
    super(message);
    this.name = 'NswagTestError';
    this.testName = options.testName;
    this.path = options.path;
    this.method = options.method;
    this.cause = options.cause;
    this.phase = options.phase;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NswagTestError);
    }
  }

  private static formatMessage(options: {
    testName: string;
    path: string;
    method: string;
    cause?: Error;
    phase?: 'setup' | 'request' | 'validation' | 'teardown';
  }): string {
    const lines: string[] = [
      `Test failed: ${options.testName}`,
      '',
      `Path: ${options.path}`,
      `Method: ${options.method.toUpperCase()}`,
    ];

    if (options.phase) {
      lines.push(`Phase: ${options.phase}`);
    }

    if (options.cause) {
      lines.push('');
      lines.push('Caused by:');
      lines.push(`  ${options.cause.name}: ${options.cause.message}`);
    }

    return lines.join('\n');
  }
}

/**
 * Spec generation error
 * Thrown during OpenAPI spec file generation
 */
export class NswagGenerationError extends Error {
  /** Spec file path */
  specFile: string;
  /** Failure reason */
  reason: string;
  /** Partially generated spec */
  partialSpec?: OpenAPISpec;
  /** List of failed tests */
  failedTests?: string[];

  constructor(options: {
    specFile: string;
    reason: string;
    partialSpec?: OpenAPISpec;
    failedTests?: string[];
  }) {
    const message = NswagGenerationError.formatMessage(options);
    super(message);
    this.name = 'NswagGenerationError';
    this.specFile = options.specFile;
    this.reason = options.reason;
    this.partialSpec = options.partialSpec;
    this.failedTests = options.failedTests;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NswagGenerationError);
    }
  }

  private static formatMessage(options: {
    specFile: string;
    reason: string;
    failedTests?: string[];
  }): string {
    const lines: string[] = [
      `Failed to generate OpenAPI spec: ${options.specFile}`,
      '',
      `Reason: ${options.reason}`,
    ];

    if (options.failedTests && options.failedTests.length > 0) {
      lines.push('');
      lines.push('Failed tests:');
      for (const test of options.failedTests) {
        lines.push(`  - ${test}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Plugin error
 * Thrown during plugin execution
 */
export class NswagPluginError extends Error {
  /** Plugin name */
  pluginName: string;
  /** Hook name */
  hookName: string;
  /** Cause error */
  cause?: Error;

  constructor(options: {
    pluginName: string;
    hookName: string;
    cause?: Error;
  }) {
    const message = `Plugin "${options.pluginName}" failed in hook "${options.hookName}"${
      options.cause ? `: ${options.cause.message}` : ''
    }`;
    super(message);
    this.name = 'NswagPluginError';
    this.pluginName = options.pluginName;
    this.hookName = options.hookName;
    this.cause = options.cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NswagPluginError);
    }
  }
}

/**
 * Mock server error
 * Thrown during mock server execution
 */
export class NswagMockServerError extends Error {
  /** Error type */
  errorType: 'startup' | 'routing' | 'validation' | 'handler' | 'shutdown';
  /** Related path */
  path?: string;
  /** Cause error */
  cause?: Error;

  constructor(options: {
    errorType: 'startup' | 'routing' | 'validation' | 'handler' | 'shutdown';
    message: string;
    path?: string;
    cause?: Error;
  }) {
    super(options.message);
    this.name = 'NswagMockServerError';
    this.errorType = options.errorType;
    this.path = options.path;
    this.cause = options.cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NswagMockServerError);
    }
  }
}

/**
 * Error utility function
 */
export function isNswagError(error: unknown): error is Error {
  return (
    error instanceof NswagSchemaValidationError ||
    error instanceof NswagConfigurationError ||
    error instanceof NswagTestError ||
    error instanceof NswagGenerationError ||
    error instanceof NswagPluginError ||
    error instanceof NswagMockServerError
  );
}

/**
 * Error wrapping helper
 * Wraps general errors into Nswag errors
 */
export function wrapError(error: unknown, context: {
  testName?: string;
  path?: string;
  method?: string;
}): Error {
  if (error instanceof Error) {
    if (isNswagError(error)) {
      return error;
    }

    if (context.testName && context.path && context.method) {
      return new NswagTestError({
        testName: context.testName,
        path: context.path,
        method: context.method,
        cause: error,
      });
    }

    return error;
  }

  return new Error(String(error));
}
