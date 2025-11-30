/**
 * HTTP 클라이언트
 * supertest를 래핑하여 스펙 수집 및 응답 검증 기능 제공
 */

import type {
  RequestDefaults,
  RequestData,
  ResponseData,
  RequestMetadata,
} from '../types/index.js';
import { getTestTarget, getRequestDefaults } from './configure.js';

// supertest 타입 (선택적 의존성)
type SuperTestRequest = {
  set: (key: string, value: string) => SuperTestRequest;
  send: (body: unknown) => SuperTestRequest;
  query: (params: Record<string, unknown>) => SuperTestRequest;
  timeout: (ms: number) => SuperTestRequest;
  expect: (status: number) => Promise<SuperTestResponse>;
  then: (resolve: (res: SuperTestResponse) => void, reject?: (err: Error) => void) => Promise<void>;
};

type SuperTestResponse = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  text: string;
};

type SuperTestAgent = {
  get: (url: string) => SuperTestRequest;
  post: (url: string) => SuperTestRequest;
  put: (url: string) => SuperTestRequest;
  patch: (url: string) => SuperTestRequest;
  delete: (url: string) => SuperTestRequest;
  options: (url: string) => SuperTestRequest;
  head: (url: string) => SuperTestRequest;
};

/**
 * HTTP 클라이언트 클래스
 * supertest를 래핑하여 요청/응답 데이터 수집
 */
export class HttpClient {
  private agent: SuperTestAgent | null = null;
  private supertest: ((app: unknown) => SuperTestAgent) | null = null;
  private defaults: RequestDefaults;

  // 마지막 요청/응답 데이터 저장
  private lastRequest: RequestData | null = null;
  private lastResponse: ResponseData | null = null;
  private lastMetadata: RequestMetadata | null = null;

  constructor(defaults?: RequestDefaults) {
    this.defaults = defaults ?? getRequestDefaults();
    this.initSupertest();
  }

  /**
   * supertest 초기화 (동적 import)
   */
  private async initSupertest(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const supertestModule = await import('supertest');
      // supertest 타입 호환성 처리
      this.supertest = (supertestModule.default || supertestModule) as unknown as (app: unknown) => SuperTestAgent;
    } catch {
      // supertest가 설치되지 않은 경우 무시
    }
  }

  /**
   * 에이전트 생성 또는 캐시된 에이전트 반환
   */
  private getAgent(): SuperTestAgent {
    if (!this.supertest) {
      throw new Error('supertest가 설치되지 않았습니다. npm install supertest를 실행하세요.');
    }

    if (!this.agent) {
      const target = getTestTarget();
      this.agent = this.supertest(target);
    }

    return this.agent;
  }

  /**
   * 요청에 기본 설정 적용
   */
  private applyDefaults(req: SuperTestRequest): SuperTestRequest {
    let request = req;

    // 기본 헤더 적용
    if (this.defaults.headers) {
      for (const [key, value] of Object.entries(this.defaults.headers)) {
        request = request.set(key, value);
      }
    }

    // 타임아웃 적용
    if (this.defaults.timeout) {
      request = request.timeout(this.defaults.timeout);
    }

    return request;
  }

  /**
   * 요청 데이터 저장
   */
  private recordRequest(
    method: string,
    path: string,
    headers: Record<string, string>,
    body?: unknown,
  ): void {
    this.lastRequest = {
      method: method.toUpperCase(),
      path,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    };
  }

  /**
   * 응답 데이터 저장
   */
  private recordResponse(response: SuperTestResponse): void {
    this.lastResponse = {
      statusCode: response.status,
      headers: response.headers as Record<string, string>,
      body: typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
    };
  }

  /**
   * GET 요청
   */
  async get(
    path: string,
    options?: { headers?: Record<string, string>; query?: Record<string, unknown> },
  ): Promise<SuperTestResponse> {
    let req = this.getAgent().get(path);
    req = this.applyDefaults(req);

    const headers = { ...this.defaults.headers, ...options?.headers };
    for (const [key, value] of Object.entries(headers)) {
      req = req.set(key, value);
    }

    if (options?.query) {
      req = req.query(options.query);
    }

    this.recordRequest('GET', path, headers);

    return new Promise((resolve, reject) => {
      req.then(
        (res: SuperTestResponse) => {
          this.recordResponse(res);
          resolve(res);
        },
        (err: Error) => reject(err),
      );
    });
  }

  /**
   * POST 요청
   */
  async post(
    path: string,
    body?: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<SuperTestResponse> {
    let req = this.getAgent().post(path);
    req = this.applyDefaults(req);

    const headers = { ...this.defaults.headers, ...options?.headers };
    for (const [key, value] of Object.entries(headers)) {
      req = req.set(key, value);
    }

    if (body) {
      req = req.send(body);
    }

    this.recordRequest('POST', path, headers, body);

    return new Promise((resolve, reject) => {
      req.then(
        (res: SuperTestResponse) => {
          this.recordResponse(res);
          resolve(res);
        },
        (err: Error) => reject(err),
      );
    });
  }

  /**
   * PUT 요청
   */
  async put(
    path: string,
    body?: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<SuperTestResponse> {
    let req = this.getAgent().put(path);
    req = this.applyDefaults(req);

    const headers = { ...this.defaults.headers, ...options?.headers };
    for (const [key, value] of Object.entries(headers)) {
      req = req.set(key, value);
    }

    if (body) {
      req = req.send(body);
    }

    this.recordRequest('PUT', path, headers, body);

    return new Promise((resolve, reject) => {
      req.then(
        (res: SuperTestResponse) => {
          this.recordResponse(res);
          resolve(res);
        },
        (err: Error) => reject(err),
      );
    });
  }

  /**
   * PATCH 요청
   */
  async patch(
    path: string,
    body?: unknown,
    options?: { headers?: Record<string, string> },
  ): Promise<SuperTestResponse> {
    let req = this.getAgent().patch(path);
    req = this.applyDefaults(req);

    const headers = { ...this.defaults.headers, ...options?.headers };
    for (const [key, value] of Object.entries(headers)) {
      req = req.set(key, value);
    }

    if (body) {
      req = req.send(body);
    }

    this.recordRequest('PATCH', path, headers, body);

    return new Promise((resolve, reject) => {
      req.then(
        (res: SuperTestResponse) => {
          this.recordResponse(res);
          resolve(res);
        },
        (err: Error) => reject(err),
      );
    });
  }

  /**
   * DELETE 요청
   */
  async delete(
    path: string,
    options?: { headers?: Record<string, string> },
  ): Promise<SuperTestResponse> {
    let req = this.getAgent().delete(path);
    req = this.applyDefaults(req);

    const headers = { ...this.defaults.headers, ...options?.headers };
    for (const [key, value] of Object.entries(headers)) {
      req = req.set(key, value);
    }

    this.recordRequest('DELETE', path, headers);

    return new Promise((resolve, reject) => {
      req.then(
        (res: SuperTestResponse) => {
          this.recordResponse(res);
          resolve(res);
        },
        (err: Error) => reject(err),
      );
    });
  }

  /**
   * 마지막 요청 데이터 조회
   */
  getLastRequest(): RequestData | null {
    return this.lastRequest;
  }

  /**
   * 마지막 응답 데이터 조회
   */
  getLastResponse(): ResponseData | null {
    return this.lastResponse;
  }

  /**
   * 마지막 메타데이터 조회
   */
  getLastMetadata(): RequestMetadata | null {
    return this.lastMetadata;
  }

  /**
   * 메타데이터 설정 (테스트 프레임워크에서 사용)
   */
  setMetadata(metadata: RequestMetadata): void {
    this.lastMetadata = metadata;
  }

  /**
   * 에이전트 리셋
   */
  reset(): void {
    this.agent = null;
    this.lastRequest = null;
    this.lastResponse = null;
    this.lastMetadata = null;
  }
}

// 싱글톤 인스턴스
let httpClientInstance: HttpClient | null = null;

/**
 * HTTP 클라이언트 생성 또는 기존 인스턴스 반환
 */
export function createHttpClient(defaults?: RequestDefaults): HttpClient {
  if (!httpClientInstance) {
    httpClientInstance = new HttpClient(defaults);
  }
  return httpClientInstance;
}

/**
 * HTTP 클라이언트 인스턴스 리셋
 */
export function resetHttpClient(): void {
  if (httpClientInstance) {
    httpClientInstance.reset();
  }
  httpClientInstance = null;
}
