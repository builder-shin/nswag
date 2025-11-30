/**
 * Plugin system
 * Phase 9 specification-based implementation
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
 * Plugin definition options
 */
export interface DefinePluginOptions {
  /** Plugin name */
  name: string;
  /** Before test hook */
  beforeTest?: (testInfo: TestInfo) => Promise<void>;
  /** After test hook */
  afterTest?: (testInfo: TestInfo, result: TestResult) => Promise<void>;
  /** Before generate hook */
  beforeGenerate?: (spec: OpenAPISpec) => Promise<OpenAPISpec>;
  /** After generate hook */
  afterGenerate?: (spec: OpenAPISpec) => Promise<OpenAPISpec>;
}

/**
 * Plugin definition function
 * Helper for type-safe plugin creation
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
 * Plugin execution engine
 * Manages plugin lifecycle and hook execution
 */
export class PluginEngine {
  private plugins: NswagPlugin[] = [];

  /**
   * Register plugin
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
   * Register multiple plugins
   */
  registerAll(plugins: NswagPlugin[]): void {
    for (const plugin of plugins) {
      this.register(plugin);
    }
  }

  /**
   * Unregister plugin
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
   * Clear all plugins
   */
  clear(): void {
    this.plugins = [];
    debugPlugin.info('All plugins cleared');
  }

  /**
   * Get registered plugins list
   */
  getPlugins(): NswagPlugin[] {
    return [...this.plugins];
  }

  /**
   * Get specific plugin
   */
  getPlugin(name: string): NswagPlugin | undefined {
    return this.plugins.find((p) => p.name === name);
  }

  /**
   * Run beforeTest hook
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
   * Run afterTest hook
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
   * Run beforeGenerate hook
   * Transform spec sequentially
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
   * Run afterGenerate hook
   * Transform spec sequentially
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

// Singleton instance
let pluginEngineInstance: PluginEngine | null = null;

/**
 * Get plugin engine instance
 */
export function getPluginEngine(): PluginEngine {
  if (!pluginEngineInstance) {
    pluginEngineInstance = new PluginEngine();
  }
  return pluginEngineInstance;
}

/**
 * Reset plugin engine
 */
export function resetPluginEngine(): void {
  if (pluginEngineInstance) {
    pluginEngineInstance.clear();
  }
  pluginEngineInstance = null;
}

/**
 * Built-in plugins
 */

/**
 * Security audit plugin
 * Warns about endpoints without security definitions
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
 * Deprecation check plugin
 * Warns when using deprecated endpoints
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
 * Timestamp plugin
 * Adds generation time to generated spec
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
 * Logging plugin
 * Logs test execution information
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
