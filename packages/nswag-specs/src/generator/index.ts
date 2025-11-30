/**
 * 스펙 생성기 모듈
 * OpenAPI 스펙 파일을 JSON/YAML 형식으로 생성
 */

import { stringify as yamlStringify } from 'yaml';
import type { OpenAPISpec, GeneratorOptions } from '../types/index.js';

/**
 * OpenAPI 스펙을 JSON 문자열로 변환
 */
export function toJSON(spec: OpenAPISpec, pretty = true): string {
  return pretty ? JSON.stringify(spec, null, 2) : JSON.stringify(spec);
}

/**
 * OpenAPI 스펙을 YAML 문자열로 변환
 */
export function toYAML(spec: OpenAPISpec): string {
  return yamlStringify(spec, { indent: 2 });
}

/**
 * 스펙 생성기 클래스
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
      throw new Error('OpenAPI 스펙에는 info 필드가 필요합니다');
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
