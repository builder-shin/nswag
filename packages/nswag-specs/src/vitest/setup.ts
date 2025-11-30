/**
 * Vitest 셋업 파일
 * 테스트 실행 전 필요한 초기화 수행
 *
 * @example
 * // vitest.config.ts
 * export default defineConfig({
 *   test: {
 *     setupFiles: ['@aspect/nswag-specs/vitest/setup'],
 *   },
 * });
 */

import type { ConfigureOptions, RequestMetadata, TestContext } from '../types/index.js';
import { configure } from '../testing/configure.js';
import { getContextManager, resetContextManager } from '../testing/context-manager.js';
import { getSpecCollector, resetSpecCollector } from '../testing/spec-collector.js';
import { createHttpClient, resetHttpClient } from '../testing/http-client.js';
import { getResponseValidator } from '../testing/response-validator.js';

// 테스트 프레임워크 글로벌 함수 타입
declare function beforeAll(fn: () => void | Promise<void>): void;
declare function afterAll(fn: () => void | Promise<void>): void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare function beforeEach(fn: (context: any) => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;

// Vitest 글로벌 타입 확장
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
 * Vitest 훅 설정
 */
function setupVitestHooks(): void {
  // beforeAll: 테스트 스위트 시작
  if (typeof beforeAll !== 'undefined') {
    beforeAll(() => {
      resetContextManager();
      resetSpecCollector();
      resetHttpClient();
    });
  }

  // afterAll: 테스트 스위트 종료
  if (typeof afterAll !== 'undefined') {
    afterAll(() => {
      // 스펙 수집 결과 출력
      if (specCollector.count > 0) {
        console.log(`[nswag-specs] ${specCollector.count}개의 엔드포인트 수집됨`);
      }
    });
  }

  // beforeEach: 각 테스트 시작
  if (typeof beforeEach !== 'undefined') {
    beforeEach((context) => {
      // Vitest 컨텍스트에서 테스트 정보 가져오기
      const testName = (context as { task?: { name?: string } })?.task?.name ?? 'unknown';
      const testFile = (context as { task?: { file?: { name?: string } } })?.task?.file?.name ?? 'unknown';

      contextManager.begin(testName, testFile);
    });
  }

  // afterEach: 각 테스트 종료
  if (typeof afterEach !== 'undefined') {
    afterEach(() => {
      contextManager.end();
    });
  }
}

// 자동 초기화
setupGlobalApi();
setupVitestHooks();

/**
 * Vitest 환경 설정 함수 (수동 설정용)
 *
 * @deprecated 자동 초기화 사용 권장
 */
export function setupVitest(options?: ConfigureOptions): void {
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
