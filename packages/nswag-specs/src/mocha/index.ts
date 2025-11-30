/**
 * Mocha 통합 모듈
 * Mocha 테스트 프레임워크와의 통합 기능 제공
 *
 * @example
 * // .mocharc.js
 * module.exports = {
 *   require: ['@aspect/nswag-specs/mocha'],
 * };
 *
 * @example
 * // Root Hook Plugin 사용
 * // .mocharc.js
 * module.exports = {
 *   require: ['@aspect/nswag-specs/mocha'],
 *   'root-hooks': true,
 * };
 */

import type { ConfigureOptions, RequestMetadata, TestContext } from '../types/index.js';
import { configure } from '../testing/configure.js';
import { getContextManager, resetContextManager } from '../testing/context-manager.js';
import { getSpecCollector, resetSpecCollector } from '../testing/spec-collector.js';
import { createHttpClient, resetHttpClient } from '../testing/http-client.js';
import { getResponseValidator } from '../testing/response-validator.js';

// Mocha 글로벌 타입 확장
declare global {
  var __NSWAG__: NswagGlobal;
}

/**
 * nswag 글로벌 API
 */
interface NswagGlobal {
  configure: (options: ConfigureOptions) => void;
  getHttpClient: () => ReturnType<typeof createHttpClient>;
  getContext: () => TestContext | null;
  collect: (metadata: RequestMetadata) => void;
}

// 컨텍스트 관리자 인스턴스
const contextManager = getContextManager();
const specCollector = getSpecCollector();
const responseValidator = getResponseValidator();

/**
 * 글로벌 nswag API 설정
 */
function setupGlobalApi(): void {
  globalThis.__NSWAG__ = {
    configure: (options: ConfigureOptions) => {
      configure(options);
    },
    getHttpClient: () => {
      return createHttpClient();
    },
    getContext: () => {
      return contextManager.getCurrent();
    },
    collect: (metadata: RequestMetadata) => {
      const httpClient = createHttpClient();
      const request = httpClient.getLastRequest();
      const response = httpClient.getLastResponse();

      if (request && response) {
        specCollector.collect(metadata, request, response);

        // 응답 검증
        const result = responseValidator.validate(metadata, response, 0);
        if (!result.validated && result.validationErrors?.length) {
          console.warn('[nswag-specs] 응답 검증 경고:', result.validationErrors);
        }
      }
    },
  };
}

/**
 * Mocha Root Hook Plugin
 * Mocha 8.0+ 버전의 Root Hook Plugin API 사용
 *
 * @see https://mochajs.org/#root-hook-plugins
 *
 * @example
 * // .mocharc.js
 * module.exports = {
 *   require: ['@aspect/nswag-specs/mocha'],
 * };
 */
export const mochaHooks = {
  /**
   * 모든 테스트 시작 전 (한 번만 실행)
   */
  beforeAll(): void {
    setupGlobalApi();
    resetContextManager();
    resetSpecCollector();
    resetHttpClient();
  },

  /**
   * 모든 테스트 종료 후 (한 번만 실행)
   */
  afterAll(): void {
    // 스펙 수집 결과 출력
    if (specCollector.count > 0) {
      console.log(`[nswag-specs] ${specCollector.count}개의 엔드포인트 수집됨`);
    }
  },

  /**
   * 각 테스트 시작 전
   */
  beforeEach(): void {
    // Mocha에서 현재 테스트 정보 가져오기
    // @ts-expect-error Mocha 글로벌 컨텍스트
    const currentTest = this?.currentTest || this?.test;
    const testName = currentTest?.title ?? 'unknown';
    const testFile = currentTest?.file ?? 'unknown';

    contextManager.begin(testName, testFile);
  },

  /**
   * 각 테스트 종료 후
   */
  afterEach(): void {
    contextManager.end();
  },
};

/**
 * Mocha hooks 생성 함수 (레거시 API)
 *
 * @deprecated mochaHooks export 사용 권장
 */
export function createMochaHooks(options?: ConfigureOptions) {
  if (options) {
    configure(options);
  }

  return {
    beforeAll: mochaHooks.beforeAll,
    afterAll: mochaHooks.afterAll,
    beforeEach: mochaHooks.beforeEach,
    afterEach: mochaHooks.afterEach,
  };
}

/**
 * Mocha 환경 설정 함수
 *
 * @deprecated mochaHooks export 사용 권장
 */
export function setupMocha(options?: ConfigureOptions): void {
  setupGlobalApi();
  if (options) {
    configure(options);
  }
}

/**
 * 현재 테스트 컨텍스트 조회
 */
export function getContext() {
  return contextManager.getCurrent();
}

/**
 * 테스트 컨텍스트 정리
 */
export function teardown(): void {
  resetContextManager();
  resetHttpClient();
}

// 편의 함수 export
export { configure } from '../testing/configure.js';
export { createHttpClient } from '../testing/http-client.js';
export { getContextManager, getCurrentTestContext } from '../testing/context-manager.js';
export { getSpecCollector } from '../testing/spec-collector.js';

/**
 * Mocha 테스트 환경 옵션 타입
 */
export interface MochaTestEnvironmentOptions {
  /** VCR 모드: record, playback, none */
  vcrMode?: 'record' | 'playback' | 'none';
  /** 스펙 출력 경로 */
  outputSpec?: string;
  /** 응답 검증 활성화 */
  validateResponses?: boolean;
}

// 자동 초기화 (require 시 자동 실행)
setupGlobalApi();
