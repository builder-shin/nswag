/**
 * HTTP Client
 * Wraps supertest to provide spec collection and response validation capabilities
 */

import type {
  RequestDefaults,
  RequestData,
  ResponseData,
  RequestMetadata,
} from '../types/index.js';
import { getTestTarget, getRequestDefaults } from './configure.js';

// supertest types (optional dependency)
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
 * HTTP Client Class
 * Wraps supertest to collect request/response data
 */
export class HttpClient {
  private agent: SuperTestAgent | null = null;
  private supertest: ((app: unknown) => SuperTestAgent) | null = null;
  private defaults: RequestDefaults;

  // Store last request/response data
  private lastRequest: RequestData | null = null;
  private lastResponse: ResponseData | null = null;
  private lastMetadata: RequestMetadata | null = null;

  constructor(defaults?: RequestDefaults) {
    this.defaults = defaults ?? getRequestDefaults();
    this.initSupertest();
  }

  /**
   * Initialize supertest (dynamic import)
   */
  private async initSupertest(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const supertestModule = await import('supertest');
      // Handle supertest type compatibility
      this.supertest = (supertestModule.default || supertestModule) as unknown as (app: unknown) => SuperTestAgent;
    } catch {
      // Ignore if supertest is not installed
    }
  }

  /**
   * Create Agent or Return Cached Agent
   */
  private getAgent(): SuperTestAgent {
    if (!this.supertest) {
      throw new Error('supertest is not installed. Run npm install supertest.');
    }

    if (!this.agent) {
      const target = getTestTarget();
      this.agent = this.supertest(target);
    }

    return this.agent;
  }

  /**
   * Apply Default Settings to Request
   */
  private applyDefaults(req: SuperTestRequest): SuperTestRequest {
    let request = req;

    // Apply default headers
    if (this.defaults.headers) {
      for (const [key, value] of Object.entries(this.defaults.headers)) {
        request = request.set(key, value);
      }
    }

    // Apply timeout
    if (this.defaults.timeout) {
      request = request.timeout(this.defaults.timeout);
    }

    return request;
  }

  /**
   * Record Request Data
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
   * Record Response Data
   */
  private recordResponse(response: SuperTestResponse): void {
    this.lastResponse = {
      statusCode: response.status,
      headers: response.headers as Record<string, string>,
      body: typeof response.body === 'string' ? response.body : JSON.stringify(response.body),
    };
  }

  /**
   * GET Request
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
   * POST Request
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
   * PUT Request
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
   * PATCH Request
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
   * DELETE Request
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
   * Get Last Request Data
   */
  getLastRequest(): RequestData | null {
    return this.lastRequest;
  }

  /**
   * Get Last Response Data
   */
  getLastResponse(): ResponseData | null {
    return this.lastResponse;
  }

  /**
   * Get Last Metadata
   */
  getLastMetadata(): RequestMetadata | null {
    return this.lastMetadata;
  }

  /**
   * Set Metadata (used by test frameworks)
   */
  setMetadata(metadata: RequestMetadata): void {
    this.lastMetadata = metadata;
  }

  /**
   * Reset Agent
   */
  reset(): void {
    this.agent = null;
    this.lastRequest = null;
    this.lastResponse = null;
    this.lastMetadata = null;
  }
}

// Singleton instance
let httpClientInstance: HttpClient | null = null;

/**
 * Create HTTP Client or Return Existing Instance
 */
export function createHttpClient(defaults?: RequestDefaults): HttpClient {
  if (!httpClientInstance) {
    httpClientInstance = new HttpClient(defaults);
  }
  return httpClientInstance;
}

/**
 * Reset HTTP Client Instance
 */
export function resetHttpClient(): void {
  if (httpClientInstance) {
    httpClientInstance.reset();
  }
  httpClientInstance = null;
}
