/**
 * Test Context Manager
 * Manages context data during test execution
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
 * Extended Test Context Interface
 * Users can add custom properties through module extension
 *
 * @example
 * declare module '@builder-shin/nswag-specs' {
 *   interface ExtendedTestContext {
 *     authToken?: string;
 *     dbConnection?: DatabaseConnection;
 *   }
 * }
 */
export interface ExtendedTestContext {
  // Interface that users can extend
  [key: string]: unknown;
}

/**
 * Test Context Manager Class
 * Manages test isolation and context data
 */
export class TestContextManager {
  private currentContext: (TestContext & ExtendedTestContext) | null = null;
  private contextStack: (TestContext & ExtendedTestContext)[] = [];
  private vcrMode: VCRMode = 'none';
  private plugins: NswagPlugin[] = [];
  private extensionData: ExtendedTestContext = {};

  /**
   * Register Plugins
   */
  registerPlugins(plugins: NswagPlugin[]): void {
    this.plugins = plugins;
  }

  /**
   * Set Extension Data
   */
  setExtensionData(data: ExtendedTestContext): void {
    this.extensionData = { ...this.extensionData, ...data };
  }

  /**
   * Get Extension Data
   */
  getExtensionData(): ExtendedTestContext {
    return { ...this.extensionData };
  }

  /**
   * Begin New Test Context
   */
  begin(testName: string, specFile: string): TestContext & ExtendedTestContext {
    const context: TestContext & ExtendedTestContext = {
      testName,
      specFile,
      startTime: Date.now(),
      vcrMode: this.vcrMode,
      ...this.extensionData,
    };

    // Push to stack to support nested tests
    if (this.currentContext) {
      this.contextStack.push(this.currentContext);
    }

    this.currentContext = context;
    return context;
  }

  /**
   * End Current Context
   */
  end(): TestContext | null {
    const endedContext = this.currentContext;

    // Restore previous context from stack
    this.currentContext = this.contextStack.pop() ?? null;

    return endedContext;
  }

  /**
   * Get Current Context
   */
  getCurrent(): TestContext | null {
    return this.currentContext;
  }

  /**
   * Check if Context Exists
   */
  hasContext(): boolean {
    return this.currentContext !== null;
  }

  /**
   * Set VCR Mode
   */
  setVCRMode(mode: VCRMode): void {
    this.vcrMode = mode;
    if (this.currentContext) {
      this.currentContext.vcrMode = mode;
    }
  }

  /**
   * Get VCR Mode
   */
  getVCRMode(): VCRMode {
    return this.vcrMode;
  }

  /**
   * Add Data to Context
   */
  set<K extends keyof TestContext>(key: K, value: TestContext[K]): void {
    if (this.currentContext) {
      this.currentContext[key] = value;
    }
  }

  /**
   * Get Data from Context
   */
  get<K extends keyof TestContext>(key: K): TestContext[K] | undefined {
    return this.currentContext?.[key];
  }

  /**
   * Create BeforeEach Context
   */
  createBeforeEachContext(metadata: RequestMetadata): BeforeEachContext | null {
    if (!this.currentContext) return null;

    return {
      ...this.currentContext,
      metadata,
    };
  }

  /**
   * Create RequestContext
   */
  createRequestContext(request: unknown): RequestContext | null {
    if (!this.currentContext) return null;

    return {
      ...this.currentContext,
      request,
    };
  }

  /**
   * Create AfterEach Context
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
   * Calculate Test Execution Time
   */
  getElapsedTime(): number {
    if (!this.currentContext) return 0;
    return Date.now() - this.currentContext.startTime;
  }

  /**
   * Reset All Contexts
   */
  reset(): void {
    this.currentContext = null;
    this.contextStack = [];
  }

  /**
   * Get Context Depth (nesting level)
   */
  getDepth(): number {
    return this.contextStack.length + (this.currentContext ? 1 : 0);
  }

  /**
   * Serialize Context (for debugging)
   */
  serialize(): string {
    return JSON.stringify({
      current: this.currentContext,
      stackDepth: this.contextStack.length,
      vcrMode: this.vcrMode,
    }, null, 2);
  }

  /**
   * Get Registered Plugins
   */
  getPlugins(): NswagPlugin[] {
    return [...this.plugins];
  }

  /**
   * Run Plugin Hooks Before Test
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
   * Run Plugin Hooks After Test
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
   * Reset Extension Data
   */
  resetExtensionData(): void {
    this.extensionData = {};
  }
}

// Singleton instance
let contextManagerInstance: TestContextManager | null = null;

/**
 * Get Test Context Manager Instance
 */
export function getContextManager(): TestContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new TestContextManager();
  }
  return contextManagerInstance;
}

/**
 * Reset Test Context Manager
 */
export function resetContextManager(): void {
  if (contextManagerInstance) {
    contextManagerInstance.reset();
  }
  contextManagerInstance = null;
}

/**
 * Get Current Test Context (convenience function)
 */
export function getCurrentTestContext(): TestContext | null {
  return getContextManager().getCurrent();
}

/**
 * Begin Test Context (convenience function)
 */
export function beginTestContext(testName: string, specFile: string): TestContext {
  return getContextManager().begin(testName, specFile);
}

/**
 * End Test Context (convenience function)
 */
export function endTestContext(): TestContext | null {
  return getContextManager().end();
}
