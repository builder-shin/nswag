/**
 * Jest 셋업 파일
 * setupFilesAfterEnv에서 사용
 * 테스트 실행 전 nswag-specs 환경 초기화
 */

import type { ConfigureOptions, RequestMetadata, TestContext } from '../types/index.js';
import { configure } from '../testing/configure.js';
import { getContextManager } from '../testing/context-manager.js';
import { getSpecCollector } from '../testing/spec-collector.js';
import { createHttpClient } from '../testing/http-client.js';
import { getResponseValidator } from '../testing/response-validator.js';

// 테스트 프레임워크 글로벌 함수 타입
declare function beforeAll(fn: () => void | Promise<void>): void;
declare function afterAll(fn: () => void | Promise<void>): void;
declare function beforeEach(fn: () => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;

// Jest 글로벌 타입 확장
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      __NSWAG__: NswagGlobal;
    }
  }
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

/**
 * 글로벌 nswag API 설정
 */
function setupGlobalApi(): void {
  const contextManager = getContextManager();
  const specCollector = getSpecCollector();
  const responseValidator = getResponseValidator();

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
 * Jest 훅 설정
 */
function setupJestHooks(): void {
  const contextManager = getContextManager();

  // beforeAll: 테스트 스위트 시작
  if (typeof beforeAll !== 'undefined') {
    beforeAll(() => {
      // 초기화 로직
    });
  }

  // afterAll: 테스트 스위트 종료
  if (typeof afterAll !== 'undefined') {
    afterAll(() => {
      // 스펙 수집 결과 출력 (옵션)
      const collector = getSpecCollector();
      if (collector.count > 0) {
        console.log(`[nswag-specs] ${collector.count}개의 엔드포인트 수집됨`);
      }
    });
  }

  // beforeEach: 각 테스트 시작
  if (typeof beforeEach !== 'undefined') {
    beforeEach(() => {
      // 현재 테스트 정보 가져오기 (Jest expect.getState 사용)
      let testName = 'unknown';
      let testPath = 'unknown';

      try {
        // @ts-expect-error Jest 내부 API
        const state = expect.getState();
        testName = state.currentTestName ?? 'unknown';
        testPath = state.testPath ?? 'unknown';
      } catch {
        // Jest API 접근 실패 시 무시
      }

      contextManager.begin(testName, testPath);
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
setupJestHooks();

// 편의 함수 export
export { configure } from '../testing/configure.js';
export { createHttpClient } from '../testing/http-client.js';
export { getContextManager, getCurrentTestContext } from '../testing/context-manager.js';
export { getSpecCollector } from '../testing/spec-collector.js';
