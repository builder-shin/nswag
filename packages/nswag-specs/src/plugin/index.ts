/**
 * 플러그인 시스템
 * Phase 9 명세서 기반 구현
 */

import type {
  NswagPlugin,
  OpenAPISpec,
  TestInfo,
  TestResult,
} from '../types/index.js';
import { NswagPluginError } from '../errors/index.js';
import { debugPlugin } from '../logger/index.js';

/**
 * 플러그인 정의 옵션
 */
export interface DefinePluginOptions {
  /** 플러그인 이름 */
  name: string;
  /** 테스트 실행 전 훅 */
  beforeTest?: (testInfo: TestInfo) => Promise<void>;
  /** 테스트 실행 후 훅 */
  afterTest?: (testInfo: TestInfo, result: TestResult) => Promise<void>;
  /** 스펙 생성 전 훅 */
  beforeGenerate?: (spec: OpenAPISpec) => Promise<OpenAPISpec>;
  /** 스펙 생성 후 훅 */
  afterGenerate?: (spec: OpenAPISpec) => Promise<OpenAPISpec>;
}

/**
 * 플러그인 정의 함수
 * 타입 안전한 플러그인 생성을 위한 헬퍼
 *
 * @example
 * const auditPlugin = definePlugin({
 *   name: 'audit',
 *   beforeTest: async (testInfo) => {
 *     if (!testInfo.security?.length) {
 *       console.warn(`Warning: ${testInfo.path} has no security defined`);
 *     }
 *   },
 *   afterGenerate: async (spec) => {
 *     for (const path in spec.paths) {
 *       for (const method in spec.paths[path]) {
 *         spec.paths[path][method]['x-audit'] = true;
 *       }
 *     }
 *     return spec;
 *   },
 * });
 */
export function definePlugin(options: DefinePluginOptions): NswagPlugin {
  return {
    name: options.name,
    beforeTest: options.beforeTest,
    afterTest: options.afterTest,
    beforeGenerate: options.beforeGenerate,
    afterGenerate: options.afterGenerate,
  };
}

/**
 * 플러그인 실행 엔진
 * 플러그인 라이프사이클 관리 및 훅 실행
 */
export class PluginEngine {
  private plugins: NswagPlugin[] = [];

  /**
   * 플러그인 등록
   */
  register(plugin: NswagPlugin): void {
    if (this.plugins.some((p) => p.name === plugin.name)) {
      debugPlugin.warn(`Plugin "${plugin.name}" is already registered, skipping`);
      return;
    }
    this.plugins.push(plugin);
    debugPlugin.info(`Plugin "${plugin.name}" registered`);
  }

  /**
   * 여러 플러그인 등록
   */
  registerAll(plugins: NswagPlugin[]): void {
    for (const plugin of plugins) {
      this.register(plugin);
    }
  }

  /**
   * 플러그인 등록 해제
   */
  unregister(pluginName: string): boolean {
    const index = this.plugins.findIndex((p) => p.name === pluginName);
    if (index !== -1) {
      this.plugins.splice(index, 1);
      debugPlugin.info(`Plugin "${pluginName}" unregistered`);
      return true;
    }
    return false;
  }

  /**
   * 모든 플러그인 초기화
   */
  clear(): void {
    this.plugins = [];
    debugPlugin.info('All plugins cleared');
  }

  /**
   * 등록된 플러그인 목록
   */
  getPlugins(): NswagPlugin[] {
    return [...this.plugins];
  }

  /**
   * 특정 플러그인 조회
   */
  getPlugin(name: string): NswagPlugin | undefined {
    return this.plugins.find((p) => p.name === name);
  }

  /**
   * beforeTest 훅 실행
   */
  async runBeforeTest(testInfo: TestInfo): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.beforeTest) {
        try {
          debugPlugin.debug(`Running beforeTest for plugin "${plugin.name}"`);
          await plugin.beforeTest(testInfo);
        } catch (error) {
          const pluginError = new NswagPluginError({
            pluginName: plugin.name,
            hookName: 'beforeTest',
            cause: error instanceof Error ? error : new Error(String(error)),
          });
          debugPlugin.error(pluginError.message);
          throw pluginError;
        }
      }
    }
  }

  /**
   * afterTest 훅 실행
   */
  async runAfterTest(testInfo: TestInfo, result: TestResult): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.afterTest) {
        try {
          debugPlugin.debug(`Running afterTest for plugin "${plugin.name}"`);
          await plugin.afterTest(testInfo, result);
        } catch (error) {
          const pluginError = new NswagPluginError({
            pluginName: plugin.name,
            hookName: 'afterTest',
            cause: error instanceof Error ? error : new Error(String(error)),
          });
          debugPlugin.error(pluginError.message);
          throw pluginError;
        }
      }
    }
  }

  /**
   * beforeGenerate 훅 실행
   * 스펙을 순차적으로 변환
   */
  async runBeforeGenerate(spec: OpenAPISpec): Promise<OpenAPISpec> {
    let currentSpec = spec;

    for (const plugin of this.plugins) {
      if (plugin.beforeGenerate) {
        try {
          debugPlugin.debug(`Running beforeGenerate for plugin "${plugin.name}"`);
          currentSpec = await plugin.beforeGenerate(currentSpec);
        } catch (error) {
          const pluginError = new NswagPluginError({
            pluginName: plugin.name,
            hookName: 'beforeGenerate',
            cause: error instanceof Error ? error : new Error(String(error)),
          });
          debugPlugin.error(pluginError.message);
          throw pluginError;
        }
      }
    }

    return currentSpec;
  }

  /**
   * afterGenerate 훅 실행
   * 스펙을 순차적으로 변환
   */
  async runAfterGenerate(spec: OpenAPISpec): Promise<OpenAPISpec> {
    let currentSpec = spec;

    for (const plugin of this.plugins) {
      if (plugin.afterGenerate) {
        try {
          debugPlugin.debug(`Running afterGenerate for plugin "${plugin.name}"`);
          currentSpec = await plugin.afterGenerate(currentSpec);
        } catch (error) {
          const pluginError = new NswagPluginError({
            pluginName: plugin.name,
            hookName: 'afterGenerate',
            cause: error instanceof Error ? error : new Error(String(error)),
          });
          debugPlugin.error(pluginError.message);
          throw pluginError;
        }
      }
    }

    return currentSpec;
  }
}

// 싱글톤 인스턴스
let pluginEngineInstance: PluginEngine | null = null;

/**
 * 플러그인 엔진 인스턴스 가져오기
 */
export function getPluginEngine(): PluginEngine {
  if (!pluginEngineInstance) {
    pluginEngineInstance = new PluginEngine();
  }
  return pluginEngineInstance;
}

/**
 * 플러그인 엔진 리셋
 */
export function resetPluginEngine(): void {
  if (pluginEngineInstance) {
    pluginEngineInstance.clear();
  }
  pluginEngineInstance = null;
}

/**
 * 내장 플러그인들
 */

/**
 * 보안 감사 플러그인
 * 보안 정의가 없는 엔드포인트에 경고
 */
export const securityAuditPlugin = definePlugin({
  name: 'security-audit',
  beforeTest: async (testInfo) => {
    if (!testInfo.security || testInfo.security.length === 0) {
      debugPlugin.warn(
        `[security-audit] Warning: ${testInfo.method.toUpperCase()} ${testInfo.path} has no security defined`
      );
    }
  },
});

/**
 * 감가상각 체크 플러그인
 * deprecated 표시된 엔드포인트 사용 시 경고
 */
export const deprecationCheckPlugin = definePlugin({
  name: 'deprecation-check',
  afterGenerate: async (spec) => {
    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem || {})) {
        if (
          method !== 'parameters' &&
          typeof operation === 'object' &&
          operation &&
          'deprecated' in operation &&
          operation.deprecated
        ) {
          debugPlugin.warn(
            `[deprecation-check] ${method.toUpperCase()} ${path} is marked as deprecated`
          );
        }
      }
    }
    return spec;
  },
});

/**
 * 타임스탬프 플러그인
 * 생성된 스펙에 생성 시간 추가
 */
export const timestampPlugin = definePlugin({
  name: 'timestamp',
  afterGenerate: async (spec) => {
    return {
      ...spec,
      info: {
        ...spec.info,
        'x-generated-at': new Date().toISOString(),
      },
    } as OpenAPISpec;
  },
});

/**
 * 로깅 플러그인
 * 테스트 실행 정보 로깅
 */
export const loggingPlugin = definePlugin({
  name: 'logging',
  beforeTest: async (testInfo) => {
    debugPlugin.info(
      `[logging] Starting test: ${testInfo.method.toUpperCase()} ${testInfo.path}`
    );
  },
  afterTest: async (testInfo, result) => {
    const status = result.success ? '✓' : '✗';
    debugPlugin.info(
      `[logging] ${status} ${testInfo.method.toUpperCase()} ${testInfo.path} - ${result.statusCode} (${result.responseTime}ms)`
    );
  },
});
