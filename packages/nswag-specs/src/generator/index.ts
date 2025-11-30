/**
 * Spec generator module
 * Generate OpenAPI spec files in JSON/YAML format
 */

import { stringify as yamlStringify } from 'yaml';
import type { OpenAPISpec, GeneratorOptions } from '../types/index.js';

/**
 * Convert OpenAPI spec to JSON string
 */
export function toJSON(spec: OpenAPISpec, pretty = true): string {
  return pretty ? JSON.stringify(spec, null, 2) : JSON.stringify(spec);
}

/**
 * Convert OpenAPI spec to YAML string
 */
export function toYAML(spec: OpenAPISpec): string {
  return yamlStringify(spec, { indent: 2 });
}

/**
 * Spec generator class
 */
export class SpecGenerator {
  private spec: Partial<OpenAPISpec> = {
    openapi: '3.0.3',
    paths: {},
  };

  constructor(options?: Partial<GeneratorOptions>) {
    if (options) {
      this.spec.info = {
        title: options.title ?? 'API Documentation',
        version: options.version ?? '1.0.0',
        description: options.description,
      };
    }
  }

  setInfo(info: OpenAPISpec['info']): this {
    this.spec.info = info;
    return this;
  }

  addPath(path: string, item: OpenAPISpec['paths'][string]): this {
    this.spec.paths![path] = item;
    return this;
  }

  setComponents(components: OpenAPISpec['components']): this {
    this.spec.components = components;
    return this;
  }

  build(): OpenAPISpec {
    if (!this.spec.info) {
      throw new Error('OpenAPI spec requires info field');
    }
    return this.spec as OpenAPISpec;
  }

  toJSON(pretty = true): string {
    return toJSON(this.build(), pretty);
  }

  toYAML(): string {
    return toYAML(this.build());
  }
}
