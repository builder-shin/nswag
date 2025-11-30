/**
 * HTTP Client and App Configuration
 * Configure test environment through configure() function
 */

import type {
  ConfigureOptions,
  RequestDefaults,
  AppInstance,
} from '../types/index.js';

// Global configuration storage
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
 * Configure Test Environment
 * Configure HTTP client with Express, Fastify, Koa, NestJS app or baseUrl
 *
 * @example
 * // Using Express app
 * configure({ app: expressApp });
 *
 * @example
 * // Using running server URL
 * configure({ baseUrl: 'http://localhost:3000' });
 *
 * @example
 * // Using NestJS app
 * const app = await NestFactory.create(AppModule);
 * configure({ app: app.getHttpServer() });
 *
 * @example
 * // Setting default request options
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
    throw new Error('configure() requires either app or baseUrl.');
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
 * Get Current Configuration
 */
export function getConfiguration(): GlobalConfiguration {
  return { ...globalConfig };
}

/**
 * Reset Configuration
 * Used for test cleanup
 */
export function resetConfiguration(): void {
  globalConfig = {
    requestDefaults: {},
  };
}

/**
 * Extract HTTP Server from App Instance
 * Supports various frameworks including NestJS, Express, Fastify, Koa
 */
function extractHttpServer(app: unknown): unknown {
  if (!app) return undefined;

  // NestJS app (has getHttpServer method)
  if (typeof app === 'object' && app !== null) {
    const nestApp = app as { getHttpServer?: () => unknown };
    if (typeof nestApp.getHttpServer === 'function') {
      return nestApp.getHttpServer();
    }

    // Fastify app (has server property)
    const fastifyApp = app as { server?: unknown };
    if (fastifyApp.server) {
      return fastifyApp.server;
    }

    // Koa app (has callback method)
    const koaApp = app as { callback?: () => unknown };
    if (typeof koaApp.callback === 'function') {
      return app;
    }
  }

  // Express app or other HTTP server
  return app;
}

/**
 * Get Configured App or BaseUrl
 * Helper for use with supertest
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
  throw new Error('Test target is not configured. Call configure() first.');
}

/**
 * Get Default Request Options
 */
export function getRequestDefaults(): RequestDefaults {
  return { ...globalConfig.requestDefaults };
}
