/**
 * HTTP 클라이언트 및 앱 설정
 * configure() 함수를 통한 테스트 환경 구성
 */

import type {
  ConfigureOptions,
  RequestDefaults,
  AppInstance,
} from '../types/index.js';

// 글로벌 설정 저장소
interface GlobalConfiguration {
  app?: AppInstance;
  baseUrl?: string;
  requestDefaults: RequestDefaults;
  httpServer?: unknown;
}

let globalConfig: GlobalConfiguration = {
  requestDefaults: {},
};

/**
 * 테스트 환경 설정
 * Express, Fastify, Koa, NestJS 앱 또는 baseUrl로 HTTP 클라이언트 설정
 *
 * @example
 * // Express 앱 사용
 * configure({ app: expressApp });
 *
 * @example
 * // 실행 중인 서버 URL 사용
 * configure({ baseUrl: 'http://localhost:3000' });
 *
 * @example
 * // NestJS 앱 사용
 * const app = await NestFactory.create(AppModule);
 * configure({ app: app.getHttpServer() });
 *
 * @example
 * // 기본 요청 옵션 설정
 * configure({
 *   app: expressApp,
 *   requestDefaults: {
 *     headers: { 'Authorization': 'Bearer token' },
 *     timeout: 5000,
 *   },
 * });
 */
export function configure(options: ConfigureOptions): void {
  if (!options.app && !options.baseUrl) {
    throw new Error('configure()에는 app 또는 baseUrl 중 하나가 필요합니다.');
  }

  globalConfig = {
    app: options.app,
    baseUrl: options.baseUrl,
    requestDefaults: {
      ...globalConfig.requestDefaults,
      ...options.requestDefaults,
    },
    httpServer: extractHttpServer(options.app),
  };
}

/**
 * 현재 설정 조회
 */
export function getConfiguration(): GlobalConfiguration {
  return { ...globalConfig };
}

/**
 * 설정 초기화
 * 테스트 정리 시 사용
 */
export function resetConfiguration(): void {
  globalConfig = {
    requestDefaults: {},
  };
}

/**
 * 앱 인스턴스에서 HTTP 서버 추출
 * NestJS, Express, Fastify, Koa 등 다양한 프레임워크 지원
 */
function extractHttpServer(app: unknown): unknown {
  if (!app) return undefined;

  // NestJS 앱인 경우 (getHttpServer 메서드 존재)
  if (typeof app === 'object' && app !== null) {
    const nestApp = app as { getHttpServer?: () => unknown };
    if (typeof nestApp.getHttpServer === 'function') {
      return nestApp.getHttpServer();
    }

    // Fastify 앱인 경우 (server 속성 존재)
    const fastifyApp = app as { server?: unknown };
    if (fastifyApp.server) {
      return fastifyApp.server;
    }

    // Koa 앱인 경우 (callback 메서드 존재)
    const koaApp = app as { callback?: () => unknown };
    if (typeof koaApp.callback === 'function') {
      return app;
    }
  }

  // Express 앱이거나 기타 HTTP 서버
  return app;
}

/**
 * 설정된 앱 또는 baseUrl 가져오기
 * supertest와 함께 사용하기 위한 헬퍼
 */
export function getTestTarget(): AppInstance | string {
  if (globalConfig.httpServer) {
    return globalConfig.httpServer;
  }
  if (globalConfig.app) {
    return globalConfig.app;
  }
  if (globalConfig.baseUrl) {
    return globalConfig.baseUrl;
  }
  throw new Error('테스트 대상이 설정되지 않았습니다. configure()를 먼저 호출하세요.');
}

/**
 * 기본 요청 옵션 가져오기
 */
export function getRequestDefaults(): RequestDefaults {
  return { ...globalConfig.requestDefaults };
}
