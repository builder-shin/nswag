/**
 * 테스트 컨텍스트 관리자
 * 테스트 실행 중 컨텍스트 데이터 관리
 */

import type {
  TestContext,
  RequestContext,
  BeforeEachContext,
  AfterEachContext,
  RequestMetadata,
  RequestData,
  ResponseData,
  VCRMode,
  NswagPlugin,
  TestInfo,
  TestResult,
} from '../types/index.js';

/**
 * 확장된 테스트 컨텍스트 인터페이스
 * 사용자가 모듈 확장을 통해 커스텀 속성 추가 가능
 *
 * @example
 * declare module '@aspect/nswag-specs' {
 *   interface ExtendedTestContext {
 *     authToken?: string;
 *     dbConnection?: DatabaseConnection;
 *   }
 * }
 */
export interface ExtendedTestContext {
  // 사용자가 확장할 수 있는 인터페이스
  [key: string]: unknown;
}

/**
 * 테스트 컨텍스트 관리자 클래스
 * 테스트 격리 및 컨텍스트 데이터 관리
 */
export class TestContextManager {
  private currentContext: (TestContext & ExtendedTestContext) | null = null;
  private contextStack: (TestContext & ExtendedTestContext)[] = [];
  private vcrMode: VCRMode = 'none';
  private plugins: NswagPlugin[] = [];
  private extensionData: ExtendedTestContext = {};

  /**
   * 플러그인 등록
   */
  registerPlugins(plugins: NswagPlugin[]): void {
    this.plugins = plugins;
  }

  /**
   * 확장 데이터 설정
   */
  setExtensionData(data: ExtendedTestContext): void {
    this.extensionData = { ...this.extensionData, ...data };
  }

  /**
   * 확장 데이터 가져오기
   */
  getExtensionData(): ExtendedTestContext {
    return { ...this.extensionData };
  }

  /**
   * 새 테스트 컨텍스트 시작
   */
  begin(testName: string, specFile: string): TestContext & ExtendedTestContext {
    const context: TestContext & ExtendedTestContext = {
      testName,
      specFile,
      startTime: Date.now(),
      vcrMode: this.vcrMode,
      ...this.extensionData,
    };

    // 중첩 테스트 지원을 위해 스택에 push
    if (this.currentContext) {
      this.contextStack.push(this.currentContext);
    }

    this.currentContext = context;
    return context;
  }

  /**
   * 현재 컨텍스트 종료
   */
  end(): TestContext | null {
    const endedContext = this.currentContext;

    // 스택에서 이전 컨텍스트 복원
    this.currentContext = this.contextStack.pop() ?? null;

    return endedContext;
  }

  /**
   * 현재 컨텍스트 조회
   */
  getCurrent(): TestContext | null {
    return this.currentContext;
  }

  /**
   * 현재 컨텍스트가 있는지 확인
   */
  hasContext(): boolean {
    return this.currentContext !== null;
  }

  /**
   * VCR 모드 설정
   */
  setVCRMode(mode: VCRMode): void {
    this.vcrMode = mode;
    if (this.currentContext) {
      this.currentContext.vcrMode = mode;
    }
  }

  /**
   * VCR 모드 조회
   */
  getVCRMode(): VCRMode {
    return this.vcrMode;
  }

  /**
   * 컨텍스트에 데이터 추가
   */
  set<K extends keyof TestContext>(key: K, value: TestContext[K]): void {
    if (this.currentContext) {
      this.currentContext[key] = value;
    }
  }

  /**
   * 컨텍스트에서 데이터 조회
   */
  get<K extends keyof TestContext>(key: K): TestContext[K] | undefined {
    return this.currentContext?.[key];
  }

  /**
   * BeforeEach 컨텍스트 생성
   */
  createBeforeEachContext(metadata: RequestMetadata): BeforeEachContext | null {
    if (!this.currentContext) return null;

    return {
      ...this.currentContext,
      metadata,
    };
  }

  /**
   * RequestContext 생성
   */
  createRequestContext(request: unknown): RequestContext | null {
    if (!this.currentContext) return null;

    return {
      ...this.currentContext,
      request,
    };
  }

  /**
   * AfterEach 컨텍스트 생성
   */
  createAfterEachContext(
    metadata: RequestMetadata,
    request: RequestData,
    response: ResponseData,
    actualStatusCode: number,
    responseTime: number,
    validated: boolean,
    validationErrors?: string[],
  ): AfterEachContext | null {
    if (!this.currentContext) return null;

    return {
      ...this.currentContext,
      metadata: {
        ...metadata,
        actualStatusCode,
        responseTime,
        validated,
        validationErrors,
      },
      request,
      response,
    };
  }

  /**
   * 테스트 실행 시간 계산
   */
  getElapsedTime(): number {
    if (!this.currentContext) return 0;
    return Date.now() - this.currentContext.startTime;
  }

  /**
   * 모든 컨텍스트 초기화
   */
  reset(): void {
    this.currentContext = null;
    this.contextStack = [];
  }

  /**
   * 컨텍스트 깊이 조회 (중첩 레벨)
   */
  getDepth(): number {
    return this.contextStack.length + (this.currentContext ? 1 : 0);
  }

  /**
   * 컨텍스트 직렬화 (디버깅용)
   */
  serialize(): string {
    return JSON.stringify({
      current: this.currentContext,
      stackDepth: this.contextStack.length,
      vcrMode: this.vcrMode,
    }, null, 2);
  }

  /**
   * 등록된 플러그인 가져오기
   */
  getPlugins(): NswagPlugin[] {
    return [...this.plugins];
  }

  /**
   * 테스트 실행 전 플러그인 훅 실행
   */
  async runBeforeTestPlugins(testInfo: TestInfo): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.beforeTest) {
        try {
          await plugin.beforeTest(testInfo);
        } catch (error) {
          console.error(`Plugin "${plugin.name}" beforeTest hook failed:`, error);
        }
      }
    }
  }

  /**
   * 테스트 실행 후 플러그인 훅 실행
   */
  async runAfterTestPlugins(testInfo: TestInfo, result: TestResult): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.afterTest) {
        try {
          await plugin.afterTest(testInfo, result);
        } catch (error) {
          console.error(`Plugin "${plugin.name}" afterTest hook failed:`, error);
        }
      }
    }
  }

  /**
   * 확장 데이터 초기화
   */
  resetExtensionData(): void {
    this.extensionData = {};
  }
}

// 싱글톤 인스턴스
let contextManagerInstance: TestContextManager | null = null;

/**
 * 테스트 컨텍스트 관리자 인스턴스 가져오기
 */
export function getContextManager(): TestContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new TestContextManager();
  }
  return contextManagerInstance;
}

/**
 * 테스트 컨텍스트 관리자 리셋
 */
export function resetContextManager(): void {
  if (contextManagerInstance) {
    contextManagerInstance.reset();
  }
  contextManagerInstance = null;
}

/**
 * 현재 테스트 컨텍스트 가져오기 (편의 함수)
 */
export function getCurrentTestContext(): TestContext | null {
  return getContextManager().getCurrent();
}

/**
 * 테스트 컨텍스트 시작 (편의 함수)
 */
export function beginTestContext(testName: string, specFile: string): TestContext {
  return getContextManager().begin(testName, specFile);
}

/**
 * 테스트 컨텍스트 종료 (편의 함수)
 */
export function endTestContext(): TestContext | null {
  return getContextManager().end();
}
