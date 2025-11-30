/**
 * Vitest Plugin
 * Virtual module injection, HMR integration, automatic reporter registration
 */

import type { ConfigureOptions } from '../types/index.js';

/**
 * Vitest Plugin Options
 */
export interface NswagPluginOptions {
  /** VCR mode */
  vcrMode?: 'record' | 'playback' | 'none';
  /** Spec output path */
  outputSpec?: string;
  /** Enable response validation */
  validateResponses?: boolean;
  /** Global configuration */
  configure?: ConfigureOptions;
}

/**
 * Vite Plugin Type (simplified)
 */
interface VitePlugin {
  name: string;
  enforce?: 'pre' | 'post';
  configResolved?: (config: unknown) => void;
  resolveId?: (id: string) => string | undefined;
  load?: (id: string) => string | undefined;
  configureServer?: (server: unknown) => void;
}

/**
 * nswag-specs Vitest plugin
 *
 * @example
 * // vitest.config.ts
 * import { defineConfig } from 'vitest/config';
 * import { nswagPlugin } from '@aspect/nswag-specs/vitest';
 *
 * export default defineConfig({
 *   plugins: [nswagPlugin()],
 *   test: {
 *     setupFiles: ['@aspect/nswag-specs/vitest/setup'],
 *   },
 * });
 */
export function nswagPlugin(options: NswagPluginOptions = {}): VitePlugin {
  const virtualModuleId = 'virtual:nswag-specs';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'nswag-specs',
    enforce: 'pre',

    /**
     * Process after config resolution
     */
    configResolved(_config: unknown) {
      // Store plugin options
      if (options.configure) {
        // Global configuration is handled in setup file
      }
    },

    /**
     * Resolve virtual module ID
     */
    resolveId(id: string): string | undefined {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
      return undefined;
    },

    /**
     * Load virtual module
     */
    load(id: string): string | undefined {
      if (id === resolvedVirtualModuleId) {
        // Generate virtual module content
        return generateVirtualModule(options);
      }
      return undefined;
    },

    /**
     * Configure dev server (HMR integration)
     */
    configureServer(server: unknown) {
      // Handle HMR events
      const viteServer = server as {
        ws?: {
          on: (event: string, callback: (data: unknown) => void) => void;
        };
        moduleGraph?: {
          invalidateModule: (mod: unknown) => void;
          getModuleById: (id: string) => unknown;
        };
      };

      if (viteServer.ws) {
        viteServer.ws.on('nswag:reload', () => {
          // Invalidate module cache
          if (viteServer.moduleGraph) {
            const mod = viteServer.moduleGraph.getModuleById(resolvedVirtualModuleId);
            if (mod) {
              viteServer.moduleGraph.invalidateModule(mod);
            }
          }
        });
      }
    },
  };
}

/**
 * Generate virtual module code
 */
function generateVirtualModule(options: NswagPluginOptions): string {
  return `
// Auto-generated nswag-specs virtual module
export const nswagOptions = ${JSON.stringify(options, null, 2)};

export const vcrMode = "${options.vcrMode ?? 'none'}";
export const validateResponses = ${options.validateResponses ?? true};
export const outputSpec = ${options.outputSpec ? `"${options.outputSpec}"` : 'undefined'};

// Get configuration
export { configure, getConfiguration } from '@aspect/nswag-specs/testing';
export { createHttpClient } from '@aspect/nswag-specs/testing';
export { getContextManager } from '@aspect/nswag-specs/testing';
export { getSpecCollector } from '@aspect/nswag-specs/testing';
`;
}

/**
 * Default export
 */
export default nswagPlugin;
