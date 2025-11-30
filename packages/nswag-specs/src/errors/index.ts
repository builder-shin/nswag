/**
 * Nswag 에러 클래스 정의
 * Phase 9 명세서 기반 구현
 */

import type { Schema, OpenAPISpec } from '../types/index.js';

/**
 * 스키마 검증 실패 에러
 * 응답 본문이 OpenAPI 스키마와 일치하지 않을 때 발생
 */
export class NswagSchemaValidationError extends Error {
  /** 검증 오류 목록 */
  errors: { path: string; message: string }[];
  /** 예상 스키마 */
  expectedSchema: Schema;
  /** 실제 응답 */
  actualResponse: unknown;
  /** HTTP 경로 */
  requestPath?: string;
  /** HTTP 메서드 */
  requestMethod?: string;
  /** HTTP 상태 코드 */
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

    // Error 스택 트레이스 유지
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
 * 설정 오류 에러
 * configure() 함수나 nswag.config.ts의 잘못된 설정 시 발생
 */
export class NswagConfigurationError extends Error {
  /** 잘못된 설정 키 */
  configKey: string;
  /** 잘못된 값 */
  invalidValue: unknown;
  /** 예상 타입 */
  expectedType: string;
  /** 추가 힌트 */
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
 * 테스트 실행 오류 에러
 * 테스트 실행 중 발생하는 오류
 */
export class NswagTestError extends Error {
  /** 테스트 이름 */
  testName: string;
  /** HTTP 경로 */
  path: string;
  /** HTTP 메서드 */
  method: string;
  /** 원인 에러 */
  cause?: Error;
  /** 실패 단계 */
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
 * 스펙 생성 오류 에러
 * OpenAPI 스펙 파일 생성 중 발생하는 오류
 */
export class NswagGenerationError extends Error {
  /** 스펙 파일 경로 */
  specFile: string;
  /** 실패 이유 */
  reason: string;
  /** 부분적으로 생성된 스펙 */
  partialSpec?: OpenAPISpec;
  /** 실패한 테스트 목록 */
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
 * 플러그인 오류 에러
 * 플러그인 실행 중 발생하는 오류
 */
export class NswagPluginError extends Error {
  /** 플러그인 이름 */
  pluginName: string;
  /** 훅 이름 */
  hookName: string;
  /** 원인 에러 */
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
 * Mock 서버 오류 에러
 * Mock 서버 실행 중 발생하는 오류
 */
export class NswagMockServerError extends Error {
  /** 오류 유형 */
  errorType: 'startup' | 'routing' | 'validation' | 'handler' | 'shutdown';
  /** 관련 경로 */
  path?: string;
  /** 원인 에러 */
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
 * 에러 유틸리티 함수
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
 * 에러 래핑 헬퍼
 * 일반 에러를 Nswag 에러로 래핑
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
