/**
 * DSL 컨텍스트 관리자
 * 중첩 블록 처리 및 메타데이터 수집
 */

import type {
  DSLContext,
  DescribeContext,
  PathContext,
  MethodContext,
  ResponseContext,
  DescribeOptions,
  HttpMethod,
  ResponseOptions,
  ParameterObject,
  RequestBodyObject,
  SchemaObject,
  HeaderObject,
  MediaTypeObject,
  TestDefinition,
  BeforeAllHook,
  AfterAllHook,
  BeforeEachHook,
  AfterEachHook,
  ExternalDocsObject,
  SecurityRequirement,
  HeaderOptions,
  ExampleObject,
} from './types.js';

/**
 * DSL 컨텍스트 스택 관리자
 */
export class DSLContextManager {
  private contextStack: DSLContext[] = [];
  private rootDescribes: DescribeContext[] = [];

  /**
   * 현재 컨텍스트 가져오기
   */
  getCurrentContext(): DSLContext | null {
    return this.contextStack[this.contextStack.length - 1] ?? null;
  }

  /**
   * 특정 타입의 부모 컨텍스트 찾기
   */
  findParentContext<T extends DSLContext['type']>(
    type: T,
  ): Extract<DSLContext, { type: T }> | null {
    for (let i = this.contextStack.length - 1; i >= 0; i--) {
      const ctx = this.contextStack[i];
      if (ctx && ctx.type === type) {
        return ctx as Extract<DSLContext, { type: T }>;
      }
    }
    return null;
  }

  /**
   * 현재 Describe 컨텍스트 가져오기
   */
  getCurrentDescribe(): DescribeContext | null {
    return this.findParentContext('describe');
  }

  /**
   * 현재 Path 컨텍스트 가져오기
   */
  getCurrentPath(): PathContext | null {
    return this.findParentContext('path');
  }

  /**
   * 현재 Method 컨텍스트 가져오기
   */
  getCurrentMethod(): MethodContext | null {
    return this.findParentContext('method');
  }

  /**
   * 현재 Response 컨텍스트 가져오기
   */
  getCurrentResponse(): ResponseContext | null {
    return this.findParentContext('response');
  }

  // ============================================================================
  // Describe 컨텍스트
  // ============================================================================

  /**
   * Describe 컨텍스트 시작
   */
  beginDescribe(name: string, options: DescribeOptions = {}): DescribeContext {
    const context: DescribeContext = {
      type: 'describe',
      name,
      options,
      children: [],
    };

    // 부모 describe에 추가
    const parentDescribe = this.getCurrentDescribe();
    if (parentDescribe) {
      parentDescribe.children.push(context);
    } else {
      this.rootDescribes.push(context);
    }

    this.contextStack.push(context);
    return context;
  }

  /**
   * Describe 컨텍스트 종료
   */
  endDescribe(): DescribeContext | null {
    const current = this.getCurrentContext();
    if (current?.type === 'describe') {
      return this.contextStack.pop() as DescribeContext;
    }
    return null;
  }

  // ============================================================================
  // Path 컨텍스트
  // ============================================================================

  /**
   * Path 컨텍스트 시작
   */
  beginPath(pathTemplate: string): PathContext {
    const parentDescribe = this.getCurrentDescribe();

    const context: PathContext = {
      type: 'path',
      pathTemplate,
      parent: parentDescribe,
      methods: [],
      parameters: [],
    };

    if (parentDescribe) {
      parentDescribe.children.push(context);
    }

    this.contextStack.push(context);
    return context;
  }

  /**
   * Path 컨텍스트 종료
   */
  endPath(): PathContext | null {
    const current = this.getCurrentContext();
    if (current?.type === 'path') {
      return this.contextStack.pop() as PathContext;
    }
    return null;
  }

  // ============================================================================
  // Method 컨텍스트
  // ============================================================================

  /**
   * Method 컨텍스트 시작
   */
  beginMethod(httpMethod: HttpMethod, summary: string): MethodContext {
    const parentPath = this.getCurrentPath();

    const context: MethodContext = {
      type: 'method',
      httpMethod,
      summary,
      parent: parentPath,
      tags: [],
      consumes: [],
      produces: [],
      parameters: [],
      requestBody: undefined,
      schema: undefined,
      requestParams: {},
      requestHeaders: {},
      responses: [],
      beforeAllHooks: [],
      afterAllHooks: [],
    };

    if (parentPath) {
      parentPath.methods.push(context);
    }

    this.contextStack.push(context);
    return context;
  }

  /**
   * Method 컨텍스트 종료
   */
  endMethod(): MethodContext | null {
    const current = this.getCurrentContext();
    if (current?.type === 'method') {
      return this.contextStack.pop() as MethodContext;
    }
    return null;
  }

  // ============================================================================
  // Response 컨텍스트
  // ============================================================================

  /**
   * Response 컨텍스트 시작
   */
  beginResponse(
    statusCode: number,
    description: string,
    options: ResponseOptions = {},
  ): ResponseContext {
    const parentMethod = this.getCurrentMethod();

    const context: ResponseContext = {
      type: 'response',
      statusCode,
      description,
      options,
      parent: parentMethod,
      schema: undefined,
      headers: undefined,
      content: undefined,
      beforeEachHooks: [],
      afterEachHooks: [],
      tests: [],
    };

    if (parentMethod) {
      parentMethod.responses.push(context);
    }

    this.contextStack.push(context);
    return context;
  }

  /**
   * Response 컨텍스트 종료
   */
  endResponse(): ResponseContext | null {
    const current = this.getCurrentContext();
    if (current?.type === 'response') {
      return this.contextStack.pop() as ResponseContext;
    }
    return null;
  }

  // ============================================================================
  // 메타데이터 설정 메서드
  // ============================================================================

  /**
   * 태그 추가 (Method 컨텍스트)
   */
  addTags(...tags: string[]): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.tags.push(...tags);
    }
  }

  /**
   * Consumes 미디어 타입 추가 (Method 컨텍스트)
   */
  addConsumes(...mediaTypes: string[]): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.consumes.push(...mediaTypes);
    }
  }

  /**
   * Produces 미디어 타입 추가 (Method 컨텍스트)
   */
  addProduces(...mediaTypes: string[]): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.produces.push(...mediaTypes);
    }
  }

  // ============================================================================
  // Operation 메타데이터 설정 메서드 (Phase 4)
  // ============================================================================

  /**
   * Operation ID 설정 (Method 컨텍스트)
   * API 클라이언트 코드 생성 시 사용되는 고유 식별자
   */
  setOperationId(id: string): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.operationId = id;
    }
  }

  /**
   * Operation 설명 설정 (Method 컨텍스트)
   * 상세한 엔드포인트 설명
   */
  setDescription(text: string): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.description = text;
    }
  }

  /**
   * Deprecated 설정 (Method 컨텍스트)
   * 엔드포인트 사용 중단 표시
   */
  setDeprecated(isDeprecated: boolean): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.deprecated = isDeprecated;
    }
  }

  /**
   * 외부 문서 링크 설정 (Method 컨텍스트)
   */
  setExternalDocs(docs: ExternalDocsObject): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.externalDocs = docs;
    }
  }

  /**
   * 파라미터 추가
   */
  addParameter(param: ParameterObject): void {
    // Path 컨텍스트 또는 Method 컨텍스트에 추가
    const method = this.getCurrentMethod();
    if (method) {
      method.parameters.push(param);
      return;
    }

    const path = this.getCurrentPath();
    if (path) {
      path.parameters.push(param);
    }
  }

  /**
   * 요청 본문 설정 (Method 컨텍스트)
   */
  setRequestBody(body: RequestBodyObject): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.requestBody = body;
    }
  }

  /**
   * 스키마 설정
   */
  setSchema(schema: SchemaObject): void {
    // Response 컨텍스트가 있으면 응답 스키마로 설정
    const response = this.getCurrentResponse();
    if (response) {
      response.schema = schema;
      return;
    }

    // Method 컨텍스트에 요청 스키마로 설정
    const method = this.getCurrentMethod();
    if (method) {
      method.schema = schema;
    }
  }

  /**
   * 요청 파라미터 설정 (Method 컨텍스트)
   */
  setRequestParams(
    params: Record<string, unknown> | (() => Record<string, unknown>) | (() => Promise<Record<string, unknown>>),
  ): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.requestParams = params;
    }
  }

  /**
   * 요청 헤더 설정 (Method 컨텍스트)
   */
  setRequestHeaders(headers: Record<string, string>): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.requestHeaders = { ...method.requestHeaders, ...headers };
    }
  }

  /**
   * 응답 헤더 설정 (Response 컨텍스트)
   */
  setResponseHeaders(headers: Record<string, HeaderObject>): void {
    const response = this.getCurrentResponse();
    if (response) {
      response.headers = { ...response.headers, ...headers };
    }
  }

  /**
   * 응답 콘텐츠 설정 (Response 컨텍스트)
   */
  setResponseContent(content: Record<string, MediaTypeObject>): void {
    const response = this.getCurrentResponse();
    if (response) {
      response.content = { ...response.content, ...content };
    }
  }

  // ============================================================================
  // 테스트 정의 메서드
  // ============================================================================

  /**
   * 테스트 추가 (Response 컨텍스트)
   */
  addTest(test: TestDefinition): void {
    const response = this.getCurrentResponse();
    if (response) {
      response.tests.push(test);
    }
  }

  // ============================================================================
  // 훅 메서드
  // ============================================================================

  /**
   * beforeAll 훅 추가 (Method 컨텍스트)
   */
  addBeforeAll(hook: BeforeAllHook): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.beforeAllHooks.push(hook);
    }
  }

  /**
   * afterAll 훅 추가 (Method 컨텍스트)
   */
  addAfterAll(hook: AfterAllHook): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.afterAllHooks.push(hook);
    }
  }

  /**
   * beforeEach 훅 추가 (Response 컨텍스트)
   */
  addBeforeEach(hook: BeforeEachHook): void {
    const response = this.getCurrentResponse();
    if (response) {
      response.beforeEachHooks.push(hook);
    }
  }

  /**
   * afterEach 훅 추가 (Response 컨텍스트)
   */
  addAfterEach(hook: AfterEachHook): void {
    const response = this.getCurrentResponse();
    if (response) {
      response.afterEachHooks.push(hook);
    }
  }

  // ============================================================================
  // Phase 5: 스키마 및 보안 기능 메서드
  // ============================================================================

  /**
   * 보안 요구사항 설정 (Method 컨텍스트)
   *
   * @example
   * setSecurity([{ basic_auth: [] }]);
   * setSecurity([{ oauth2: ['read', 'write'] }]);
   * setSecurity([]); // 전역 security 비활성화
   */
  setSecurity(requirements: SecurityRequirement[]): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.security = requirements;
    }
  }

  /**
   * 응답 헤더 추가 (Response 컨텍스트)
   *
   * @example
   * addResponseHeader('X-Rate-Limit', {
   *   schema: { type: 'integer' },
   *   description: 'Rate limit remaining'
   * });
   */
  addResponseHeader(name: string, options: HeaderOptions): void {
    const response = this.getCurrentResponse();
    if (response) {
      if (!response.headers) {
        response.headers = {};
      }
      response.headers[name] = {
        description: options.description,
        required: options.required,
        deprecated: options.deprecated,
        schema: options.schema,
        example: options.example,
      };
    }
  }

  /**
   * 응답 예제 추가 (Response 컨텍스트)
   *
   * @example
   * addResponseExample('application/json', 'example_key', { id: 1 }, 'Summary', 'Description');
   */
  addResponseExample(
    mediaType: string,
    key: string,
    value: unknown,
    summary?: string,
    description?: string
  ): void {
    const response = this.getCurrentResponse();
    if (response) {
      if (!response.content) {
        response.content = {};
      }
      if (!response.content[mediaType]) {
        response.content[mediaType] = {};
      }
      if (!response.content[mediaType].examples) {
        response.content[mediaType].examples = {};
      }

      const example: ExampleObject = { value };
      if (summary) example.summary = summary;
      if (description) example.description = description;

      response.content[mediaType].examples[key] = example;
    }
  }

  /**
   * 요청 본문 예제 추가 (Method 컨텍스트)
   *
   * @example
   * addRequestBodyExample({ id: 1 }, 'example_key', 'Summary', 'Description');
   */
  addRequestBodyExample(
    value: unknown,
    name?: string,
    summary?: string,
    description?: string
  ): void {
    const method = this.getCurrentMethod();
    if (method && method.requestBody) {
      const mediaType = Object.keys(method.requestBody.content)[0];
      if (mediaType) {
        const content = method.requestBody.content[mediaType];
        if (content) {
          if (!content.examples) {
            content.examples = {};
          }

          const exampleKey = name ?? `example_${Object.keys(content.examples).length}`;
          const example: ExampleObject = { value };
          if (summary) example.summary = summary;
          if (description) example.description = description;

          content.examples[exampleKey] = example;
        }
      }
    }
  }

  // ============================================================================
  // 유틸리티 메서드
  // ============================================================================

  /**
   * 루트 Describe 컨텍스트 목록 가져오기
   */
  getRootDescribes(): DescribeContext[] {
    return this.rootDescribes;
  }

  /**
   * 모든 컨텍스트 초기화
   */
  reset(): void {
    this.contextStack = [];
    this.rootDescribes = [];
  }

  /**
   * 컨텍스트 스택 깊이
   */
  getDepth(): number {
    return this.contextStack.length;
  }

  /**
   * 현재 컨텍스트가 특정 타입인지 확인
   */
  isInContext(type: DSLContext['type']): boolean {
    return this.findParentContext(type as never) !== null;
  }

  /**
   * 전체 경로 템플릿 생성 (중첩된 path 고려)
   */
  getFullPath(): string {
    let fullPath = '';
    for (const ctx of this.contextStack) {
      if (ctx.type === 'path') {
        fullPath += ctx.pathTemplate;
      }
    }
    return fullPath || '/';
  }

  /**
   * 디버깅용 직렬화
   */
  serialize(): string {
    return JSON.stringify(
      {
        stackDepth: this.contextStack.length,
        currentType: this.getCurrentContext()?.type ?? null,
        rootDescribeCount: this.rootDescribes.length,
      },
      null,
      2,
    );
  }
}

// 싱글톤 인스턴스
let contextManagerInstance: DSLContextManager | null = null;

/**
 * DSL 컨텍스트 관리자 인스턴스 가져오기
 */
export function getDSLContextManager(): DSLContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new DSLContextManager();
  }
  return contextManagerInstance;
}

/**
 * DSL 컨텍스트 관리자 리셋
 */
export function resetDSLContextManager(): void {
  if (contextManagerInstance) {
    contextManagerInstance.reset();
  }
  contextManagerInstance = null;
}

/**
 * 현재 DSL 컨텍스트 가져오기 (편의 함수)
 */
export function getCurrentDSLContext(): DSLContext | null {
  return getDSLContextManager().getCurrentContext();
}
