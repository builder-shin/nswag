/**
 * Global configuration manager
 * Phase 4: API version and documentation options
 *
 * Manage openapiSpecs multi-version configuration and global options
 */

import type { GlobalConfigOptions, OpenAPISpecInfo, OpenAPISpecsConfig } from './types.js';

/**
 * Global configuration store
 */
interface GlobalConfigStore {
  openapiRoot: string;
  openapiSpecs: OpenAPISpecsConfig;
  openapiNoAdditionalProperties: boolean;
  openapiAllPropertiesRequired: boolean;
  defaultOpenAPIVersion: '3.0.3' | '3.1.0';
}

/**
 * Default configuration values
 */
const defaultConfig: GlobalConfigStore = {
  openapiRoot: './openapi',
  openapiSpecs: {},
  openapiNoAdditionalProperties: false,
  openapiAllPropertiesRequired: false,
  defaultOpenAPIVersion: '3.0.3',
};

/**
 * Current configuration store
 */
let currentConfig: GlobalConfigStore = { ...defaultConfig };

/**
 * Global configuration manager class
 */
export class GlobalConfigManager {
  /**
   * Configure global settings
   *
   * @example
   * GlobalConfigManager.configure({
   *   openapiRoot: './openapi',
   *   openapiSpecs: {
   *     'v1/openapi.json': {
   *       openapi: '3.0.3',
   *       info: { title: 'API V1', version: 'v1' },
   *       servers: [{ url: 'https://api.example.com' }]
   *     },
   *     'v2/openapi.yaml': {
   *       openapi: '3.0.3',
   *       info: { title: 'API V2', version: 'v2' },
   *       servers: [{ url: 'https://api.example.com' }]
   *     }
   *   }
   * });
   */
  static configure(options: GlobalConfigOptions): void {
    currentConfig = {
      openapiRoot: options.openapiRoot ?? currentConfig.openapiRoot,
      openapiSpecs: options.openapiSpecs ?? currentConfig.openapiSpecs,
      openapiNoAdditionalProperties: options.openapiNoAdditionalProperties ?? currentConfig.openapiNoAdditionalProperties,
      openapiAllPropertiesRequired: options.openapiAllPropertiesRequired ?? currentConfig.openapiAllPropertiesRequired,
      defaultOpenAPIVersion: options.defaultOpenAPIVersion ?? currentConfig.defaultOpenAPIVersion,
    };
  }

  /**
   * Get current configuration
   */
  static getConfig(): Readonly<GlobalConfigStore> {
    return { ...currentConfig };
  }

  /**
   * Get OpenAPI root path
   */
  static getOpenapiRoot(): string {
    return currentConfig.openapiRoot;
  }

  /**
   * Get configuration for specific spec file
   */
  static getSpecConfig(specPath: string): Partial<OpenAPISpecInfo> | undefined {
    return currentConfig.openapiSpecs[specPath];
  }

  /**
   * Get all spec file paths
   */
  static getSpecPaths(): string[] {
    return Object.keys(currentConfig.openapiSpecs);
  }

  /**
   * Check if spec configuration exists
   */
  static hasSpec(specPath: string): boolean {
    return specPath in currentConfig.openapiSpecs;
  }

  /**
   * Add/update spec configuration
   */
  static setSpecConfig(specPath: string, config: Partial<OpenAPISpecInfo>): void {
    currentConfig.openapiSpecs[specPath] = config;
  }

  /**
   * Get global noAdditionalProperties option
   */
  static getNoAdditionalProperties(): boolean {
    return currentConfig.openapiNoAdditionalProperties;
  }

  /**
   * Get global allPropertiesRequired option
   */
  static getAllPropertiesRequired(): boolean {
    return currentConfig.openapiAllPropertiesRequired;
  }

  /**
   * Get default OpenAPI version
   */
  static getDefaultOpenAPIVersion(): '3.0.3' | '3.1.0' {
    return currentConfig.defaultOpenAPIVersion;
  }

  /**
   * Get OpenAPI version for specific spec
   */
  static getOpenAPIVersion(specPath?: string): string {
    if (specPath && currentConfig.openapiSpecs[specPath]?.openapi) {
      return currentConfig.openapiSpecs[specPath].openapi!;
    }
    return currentConfig.defaultOpenAPIVersion;
  }

  /**
   * Reset configuration
   */
  static reset(): void {
    currentConfig = { ...defaultConfig };
  }
}

// ============================================================================
// Convenience functions
// ============================================================================

/**
 * Configure global settings function
 *
 * @example
 * configureOpenAPI({
 *   openapiRoot: './openapi',
 *   openapiSpecs: {
 *     'v1/openapi.json': {
 *       openapi: '3.0.3',
 *       info: { title: 'API V1', version: 'v1' }
 *     }
 *   },
 *   openapiNoAdditionalProperties: true,
 *   openapiAllPropertiesRequired: true
 * });
 */
export function configureOpenAPI(options: GlobalConfigOptions): void {
  GlobalConfigManager.configure(options);
}

/**
 * Get current global configuration
 */
export function getGlobalConfig(): Readonly<GlobalConfigStore> {
  return GlobalConfigManager.getConfig();
}

/**
 * Reset global configuration
 */
export function resetGlobalConfig(): void {
  GlobalConfigManager.reset();
}

/**
 * Get configuration for specific spec
 */
export function getSpecConfig(specPath: string): Partial<OpenAPISpecInfo> | undefined {
  return GlobalConfigManager.getSpecConfig(specPath);
}

/**
 * Get OpenAPI version
 */
export function getOpenAPIVersion(specPath?: string): string {
  return GlobalConfigManager.getOpenAPIVersion(specPath);
}
