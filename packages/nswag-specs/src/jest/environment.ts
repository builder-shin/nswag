/**
 * Jest Custom Environment
 * Jest environment configuration for nswag-specs testing
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

// Jest environment types (does not depend on actual jest types)
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
 * nswag-specs Dedicated Jest Environment Class
 * Automates metadata context injection, spec collection, and response validation
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

    // Setup global nswag context
    this.setupGlobalContext();
  }

  /**
   * Setup Global Context
   */
  private setupGlobalContext(): void {
    this.global.__NSWAG_CONTEXT__ = {
      configure: (options: ConfigureOptions) => {
        // Delegate configure function
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
   * Setup Environment (before test suite starts)
   */
  async setup(): Promise<void> {
    // Initialize context manager
    resetContextManager();
    resetSpecCollector();
    resetHttpClient();

    // Apply environment options
    if (this.options.vcrMode) {
      this.contextManager.setVCRMode(this.options.vcrMode as 'record' | 'playback' | 'none');
    }
  }

  /**
   * Teardown Environment (after test suite ends)
   */
  async teardown(): Promise<void> {
    // Save spec collection results (based on options)
    if (this.options.outputSpec) {
      await this.saveCollectedSpecs();
    }

    // Clean up resources
    resetContextManager();
    resetHttpClient();

    // Remove global context
    delete this.global.__NSWAG_CONTEXT__;
  }

  /**
   * Before Each Test
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
   * Handle AfterEach
   */
  private handleAfterEach(result: AfterEachResult): AfterEachContext | null {
    const { metadata, request, response } = result;
    const responseTime = this.contextManager.getElapsedTime();

    // Validate response
    const extendedMetadata = this.responseValidator.validate(
      metadata,
      response,
      responseTime,
    );

    // Collect spec
    this.specCollector.collect(metadata, request, response);

    // Create AfterEach context
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
   * Save Collected Specs
   */
  private async saveCollectedSpecs(): Promise<void> {
    const spec = this.specCollector.toOpenAPISpec();
    const outputPath = this.options.outputSpec as string;

    try {
      const fs = await import('fs/promises');
      const content = JSON.stringify(spec, null, 2);
      await fs.writeFile(outputPath, content, 'utf-8');
    } catch (error) {
      console.error('Failed to save spec file:', error);
    }
  }
}

// Type definitions
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

// Simple environment class for legacy compatibility
export class JestEnvironment {
  private context: TestContext | null = null;

  constructor() {
    // Initialize Jest environment
  }

  /**
   * Set Test Context
   */
  setContext(context: TestContext): void {
    this.context = context;
  }

  /**
   * Get Test Context
   */
  getContext(): TestContext | null {
    return this.context;
  }

  /**
   * Teardown Environment
   */
  teardown(): void {
    this.context = null;
  }
}

// Default export
export default NswagTestEnvironment;
