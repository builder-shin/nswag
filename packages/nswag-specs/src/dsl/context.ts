/**
 * DSL context manager
 * Handles nested blocks and metadata collection
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
 * DSL context stack manager
 */
export class DSLContextManager {
  private contextStack: DSLContext[] = [];
  private rootDescribes: DescribeContext[] = [];

  /**
   * Get current context
   */
  getCurrentContext(): DSLContext | null {
    return this.contextStack[this.contextStack.length - 1] ?? null;
  }

  /**
   * Find parent context of specific type
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
   * Get current Describe context
   */
  getCurrentDescribe(): DescribeContext | null {
    return this.findParentContext('describe');
  }

  /**
   * Get current Path context
   */
  getCurrentPath(): PathContext | null {
    return this.findParentContext('path');
  }

  /**
   * Get current Method context
   */
  getCurrentMethod(): MethodContext | null {
    return this.findParentContext('method');
  }

  /**
   * Get current Response context
   */
  getCurrentResponse(): ResponseContext | null {
    return this.findParentContext('response');
  }

  // ============================================================================
  // Describe context
  // ============================================================================

  /**
   * Begin Describe context
   */
  beginDescribe(name: string, options: DescribeOptions = {}): DescribeContext {
    const context: DescribeContext = {
      type: 'describe',
      name,
      options,
      children: [],
    };

    // Add to parent describe
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
   * End Describe context
   */
  endDescribe(): DescribeContext | null {
    const current = this.getCurrentContext();
    if (current?.type === 'describe') {
      return this.contextStack.pop() as DescribeContext;
    }
    return null;
  }

  // ============================================================================
  // Path context
  // ============================================================================

  /**
   * Begin Path context
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
   * End Path context
   */
  endPath(): PathContext | null {
    const current = this.getCurrentContext();
    if (current?.type === 'path') {
      return this.contextStack.pop() as PathContext;
    }
    return null;
  }

  // ============================================================================
  // Method context
  // ============================================================================

  /**
   * Begin Method context
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
   * End Method context
   */
  endMethod(): MethodContext | null {
    const current = this.getCurrentContext();
    if (current?.type === 'method') {
      return this.contextStack.pop() as MethodContext;
    }
    return null;
  }

  // ============================================================================
  // Response context
  // ============================================================================

  /**
   * Begin Response context
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
   * End Response context
   */
  endResponse(): ResponseContext | null {
    const current = this.getCurrentContext();
    if (current?.type === 'response') {
      return this.contextStack.pop() as ResponseContext;
    }
    return null;
  }

  // ============================================================================
  // Metadata setter methods
  // ============================================================================

  /**
   * Add tags (Method context)
   */
  addTags(...tags: string[]): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.tags.push(...tags);
    }
  }

  /**
   * Add consumes media types (Method context)
   */
  addConsumes(...mediaTypes: string[]): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.consumes.push(...mediaTypes);
    }
  }

  /**
   * Add produces media types (Method context)
   */
  addProduces(...mediaTypes: string[]): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.produces.push(...mediaTypes);
    }
  }

  // ============================================================================
  // Operation metadata setter methods (Phase 4)
  // ============================================================================

  /**
   * Set operation ID (Method context)
   * Unique identifier used when generating API client code
   */
  setOperationId(id: string): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.operationId = id;
    }
  }

  /**
   * Set operation description (Method context)
   * Detailed endpoint description
   */
  setDescription(text: string): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.description = text;
    }
  }

  /**
   * Set deprecated flag (Method context)
   * Mark endpoint as deprecated
   */
  setDeprecated(isDeprecated: boolean): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.deprecated = isDeprecated;
    }
  }

  /**
   * Set external documentation link (Method context)
   */
  setExternalDocs(docs: ExternalDocsObject): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.externalDocs = docs;
    }
  }

  /**
   * Add parameter
   */
  addParameter(param: ParameterObject): void {
    // Add to Path context or Method context
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
   * Set request body (Method context)
   */
  setRequestBody(body: RequestBodyObject): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.requestBody = body;
    }
  }

  /**
   * Set schema
   */
  setSchema(schema: SchemaObject): void {
    // Set as response schema if Response context exists
    const response = this.getCurrentResponse();
    if (response) {
      response.schema = schema;
      return;
    }

    // Set as request schema in Method context
    const method = this.getCurrentMethod();
    if (method) {
      method.schema = schema;
    }
  }

  /**
   * Set request parameters (Method context)
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
   * Set request headers (Method context)
   */
  setRequestHeaders(headers: Record<string, string>): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.requestHeaders = { ...method.requestHeaders, ...headers };
    }
  }

  /**
   * Set response headers (Response context)
   */
  setResponseHeaders(headers: Record<string, HeaderObject>): void {
    const response = this.getCurrentResponse();
    if (response) {
      response.headers = { ...response.headers, ...headers };
    }
  }

  /**
   * Set response content (Response context)
   */
  setResponseContent(content: Record<string, MediaTypeObject>): void {
    const response = this.getCurrentResponse();
    if (response) {
      response.content = { ...response.content, ...content };
    }
  }

  // ============================================================================
  // Test definition methods
  // ============================================================================

  /**
   * Add test (Response context)
   */
  addTest(test: TestDefinition): void {
    const response = this.getCurrentResponse();
    if (response) {
      response.tests.push(test);
    }
  }

  // ============================================================================
  // Hook methods
  // ============================================================================

  /**
   * Add beforeAll hook (Method context)
   */
  addBeforeAll(hook: BeforeAllHook): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.beforeAllHooks.push(hook);
    }
  }

  /**
   * Add afterAll hook (Method context)
   */
  addAfterAll(hook: AfterAllHook): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.afterAllHooks.push(hook);
    }
  }

  /**
   * Add beforeEach hook (Response context)
   */
  addBeforeEach(hook: BeforeEachHook): void {
    const response = this.getCurrentResponse();
    if (response) {
      response.beforeEachHooks.push(hook);
    }
  }

  /**
   * Add afterEach hook (Response context)
   */
  addAfterEach(hook: AfterEachHook): void {
    const response = this.getCurrentResponse();
    if (response) {
      response.afterEachHooks.push(hook);
    }
  }

  // ============================================================================
  // Phase 5: Schema and security feature methods
  // ============================================================================

  /**
   * Set security requirements (Method context)
   *
   * @example
   * setSecurity([{ basic_auth: [] }]);
   * setSecurity([{ oauth2: ['read', 'write'] }]);
   * setSecurity([]); // Disable global security
   */
  setSecurity(requirements: SecurityRequirement[]): void {
    const method = this.getCurrentMethod();
    if (method) {
      method.security = requirements;
    }
  }

  /**
   * Add response header (Response context)
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
   * Add response example (Response context)
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
   * Add request body example (Method context)
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
  // Utility methods
  // ============================================================================

  /**
   * Get root Describe context list
   */
  getRootDescribes(): DescribeContext[] {
    return this.rootDescribes;
  }

  /**
   * Reset all contexts
   */
  reset(): void {
    this.contextStack = [];
    this.rootDescribes = [];
  }

  /**
   * Get context stack depth
   */
  getDepth(): number {
    return this.contextStack.length;
  }

  /**
   * Check if current context is of specific type
   */
  isInContext(type: DSLContext['type']): boolean {
    return this.findParentContext(type as never) !== null;
  }

  /**
   * Generate full path template (considering nested paths)
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
   * Serialize for debugging
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

// Singleton instance
let contextManagerInstance: DSLContextManager | null = null;

/**
 * Get DSL context manager instance
 */
export function getDSLContextManager(): DSLContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new DSLContextManager();
  }
  return contextManagerInstance;
}

/**
 * Reset DSL context manager
 */
export function resetDSLContextManager(): void {
  if (contextManagerInstance) {
    contextManagerInstance.reset();
  }
  contextManagerInstance = null;
}

/**
 * Get current DSL context (convenience function)
 */
export function getCurrentDSLContext(): DSLContext | null {
  return getDSLContextManager().getCurrentContext();
}
