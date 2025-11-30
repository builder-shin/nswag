/**
 * Jest 커스텀 환경
 * nswag-specs 테스트를 위한 Jest 환경 설정
 */

import type {
  TestContext,
  BeforeEachContext,
  AfterEachContext,
  RequestMetadata,
  ConfigureOptions,
} from '../types/index.js';
import {
  getContextManager,
  resetContextManager,
} from '../testing/context-manager.js';
import { getSpecCollector, resetSpecCollector } from '../testing/spec-collector.js';
import { getResponseValidator } from '../testing/response-validator.js';
import { createHttpClient, resetHttpClient } from '../testing/http-client.js';

// Jest 환경 타입 (실제 jest 타입에 의존하지 않음)
type JestEnvironmentContext = {
  testPath: string;
  docblockPragmas: Record<string, string | string[]>;
};

type JestEnvironmentConfig = {
  projectConfig: {
    testEnvironmentOptions?: Record<string, unknown>;
  };
};

type JestGlobal = typeof globalThis & {
  __NSWAG_CONTEXT__?: NswagTestContext;
};

/**
 * nswag-specs 전용 Jest 환경 클래스
 * 메타데이터 컨텍스트 주입, 스펙 수집, 응답 검증 자동화
 */
export class NswagTestEnvironment {
  private global: JestGlobal;
  private testPath: string;
  private options: Record<string, unknown>;
  private contextManager = getContextManager();
  private specCollector = getSpecCollector();
  private responseValidator = getResponseValidator();

  constructor(config: JestEnvironmentConfig, context: JestEnvironmentContext) {
    this.global = globalThis as JestGlobal;
    this.testPath = context.testPath;
    this.options = config.projectConfig.testEnvironmentOptions ?? {};

    // 글로벌 nswag 컨텍스트 설정
    this.setupGlobalContext();
  }

  /**
   * 글로벌 컨텍스트 설정
   */
  private setupGlobalContext(): void {
    this.global.__NSWAG_CONTEXT__ = {
      configure: (options: ConfigureOptions) => {
        // configure 함수 위임
        const { configure } = require('../testing/configure.js');
        configure(options);
      },
      getContext: () => this.contextManager.getCurrent(),
      getHttpClient: () => createHttpClient(),
      getSpecCollector: () => this.specCollector,
      beforeEach: (metadata: RequestMetadata) => {
        return this.contextManager.createBeforeEachContext(metadata);
      },
      afterEach: (result: AfterEachResult) => {
        return this.handleAfterEach(result);
      },
    };
  }

  /**
   * 환경 설정 (테스트 스위트 시작 전)
   */
  async setup(): Promise<void> {
    // 컨텍스트 관리자 초기화
    resetContextManager();
    resetSpecCollector();
    resetHttpClient();

    // 환경 옵션 적용
    if (this.options.vcrMode) {
      this.contextManager.setVCRMode(this.options.vcrMode as 'record' | 'playback' | 'none');
    }
  }

  /**
   * 환경 정리 (테스트 스위트 종료 후)
   */
  async teardown(): Promise<void> {
    // 스펙 수집 결과 저장 (옵션에 따라)
    if (this.options.outputSpec) {
      await this.saveCollectedSpecs();
    }

    // 리소스 정리
    resetContextManager();
    resetHttpClient();

    // 글로벌 컨텍스트 제거
    delete this.global.__NSWAG_CONTEXT__;
  }

  /**
   * 각 테스트 시작 전
   */
  handleTestEvent(event: TestEvent): void {
    if (event.name === 'test_start') {
      this.contextManager.begin(
        event.test?.name ?? 'unknown',
        this.testPath,
      );
    } else if (event.name === 'test_done') {
      this.contextManager.end();
    }
  }

  /**
   * AfterEach 처리
   */
  private handleAfterEach(result: AfterEachResult): AfterEachContext | null {
    const { metadata, request, response } = result;
    const responseTime = this.contextManager.getElapsedTime();

    // 응답 검증
    const extendedMetadata = this.responseValidator.validate(
      metadata,
      response,
      responseTime,
    );

    // 스펙 수집
    this.specCollector.collect(metadata, request, response);

    // AfterEach 컨텍스트 생성
    return this.contextManager.createAfterEachContext(
      metadata,
      request,
      response,
      response.statusCode,
      responseTime,
      extendedMetadata.validated,
      extendedMetadata.validationErrors,
    );
  }

  /**
   * 수집된 스펙 저장
   */
  private async saveCollectedSpecs(): Promise<void> {
    const spec = this.specCollector.toOpenAPISpec();
    const outputPath = this.options.outputSpec as string;

    try {
      const fs = await import('fs/promises');
      const content = JSON.stringify(spec, null, 2);
      await fs.writeFile(outputPath, content, 'utf-8');
    } catch (error) {
      console.error('스펙 파일 저장 실패:', error);
    }
  }
}

// 타입 정의
interface NswagTestContext {
  configure: (options: ConfigureOptions) => void;
  getContext: () => TestContext | null;
  getHttpClient: () => ReturnType<typeof createHttpClient>;
  getSpecCollector: () => ReturnType<typeof getSpecCollector>;
  beforeEach: (metadata: RequestMetadata) => BeforeEachContext | null;
  afterEach: (result: AfterEachResult) => AfterEachContext | null;
}

interface AfterEachResult {
  metadata: RequestMetadata;
  request: { path: string; method: string; headers: Record<string, string>; body?: string };
  response: { statusCode: number; headers: Record<string, string>; body: string };
}

interface TestEvent {
  name: string;
  test?: { name: string };
}

// 레거시 호환성을 위한 간단한 환경 클래스
export class JestEnvironment {
  private context: TestContext | null = null;

  constructor() {
    // Jest 환경 초기화
  }

  /**
   * 테스트 컨텍스트 설정
   */
  setContext(context: TestContext): void {
    this.context = context;
  }

  /**
   * 테스트 컨텍스트 조회
   */
  getContext(): TestContext | null {
    return this.context;
  }

  /**
   * 환경 정리
   */
  teardown(): void {
    this.context = null;
  }
}

// 기본 export
export default NswagTestEnvironment;
