/**
 * DSL-based OpenAPI spec generator
 * Phase 4: API version and documentation options
 *
 * Generate OpenAPI spec from DSL context
 */

import { stringify as yamlStringify } from 'yaml';
import type {
  PathContext,
  MethodContext,
  ResponseContext,
  SchemaObject,
  ParameterObject,
  RequestBodyObject,
  ExternalDocsObject,
} from './types.js';
import { getDSLContextManager } from './context.js';
import { GlobalConfigManager } from './global-config.js';
import {
  filterDocumentableResponses,
  extractPaths,
} from './document-utils.js';
import { processSchema } from './schema-utils.js';

// ============================================================================
// OpenAPI spec types (for generation)
// ============================================================================

/**
 * Generated OpenAPI spec
 */
export interface GeneratedOpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    termsOfService?: string;
    contact?: {
      name?: string;
      url?: string;
      email?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, GeneratedPathItem>;
  tags?: Array<{
    name: string;
    description?: string;
    externalDocs?: ExternalDocsObject;
  }>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, unknown>;
  };
  externalDocs?: ExternalDocsObject;
}

/**
 * Generated Path Item
 */
export interface GeneratedPathItem {
  summary?: string;
  description?: string;
  get?: GeneratedOperation;
  post?: GeneratedOperation;
  put?: GeneratedOperation;
  patch?: GeneratedOperation;
  delete?: GeneratedOperation;
  head?: GeneratedOperation;
  options?: GeneratedOperation;
  parameters?: GeneratedParameter[];
}

/**
 * Generated Operation
 */
export interface GeneratedOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  externalDocs?: ExternalDocsObject;
  parameters?: GeneratedParameter[];
  requestBody?: GeneratedRequestBody;
  responses: Record<string, GeneratedResponse>;
  security?: Array<Record<string, string[]>>;
}

/**
 * Generated Parameter
 */
export interface GeneratedParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: SchemaObject;
  example?: unknown;
  /** x-enum-descriptions extension field (Enum descriptions) */
  'x-enum-descriptions'?: Record<string, string>;
}

/**
 * Generated RequestBody
 */
export interface GeneratedRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, { schema?: SchemaObject; example?: unknown }>;
}

/**
 * Generated Response
 */
export interface GeneratedResponse {
  description: string;
  headers?: Record<string, { description?: string; schema?: SchemaObject }>;
  content?: Record<string, { schema?: SchemaObject; example?: unknown }>;
}

// ============================================================================
// Spec generator
// ============================================================================

/**
 * DSL spec generator class
 */
export class DSLSpecGenerator {
  private specPath?: string;

  constructor(specPath?: string) {
    this.specPath = specPath;
  }

  /**
   * Generate OpenAPI spec from DSL context
   */
  generate(): GeneratedOpenAPISpec {
    const manager = getDSLContextManager();
    const rootDescribes = manager.getRootDescribes();

    // Get spec config
    const specConfig = this.specPath
      ? GlobalConfigManager.getSpecConfig(this.specPath)
      : undefined;

    // Base spec structure
    const spec: GeneratedOpenAPISpec = {
      openapi: specConfig?.openapi ?? GlobalConfigManager.getDefaultOpenAPIVersion(),
      info: {
        title: specConfig?.info?.title ?? 'API Documentation',
        version: specConfig?.info?.version ?? '1.0.0',
        description: specConfig?.info?.description,
        termsOfService: specConfig?.info?.termsOfService,
        contact: specConfig?.info?.contact,
        license: specConfig?.info?.license,
      },
      servers: specConfig?.servers,
      paths: {},
      tags: specConfig?.tags,
      externalDocs: specConfig?.externalDocs,
    };

    // Filter by spec file
    const targetDescribes = this.specPath
      ? rootDescribes.filter(d => d.options.openapiSpec === this.specPath)
      : rootDescribes;

    // Collected tags
    const collectedTags = new Set<string>();

    // Process each Describe
    for (const describe of targetDescribes) {
      const paths = extractPaths(describe);
      for (const pathCtx of paths) {
        const pathItem = this.buildPathItem(pathCtx, collectedTags);
        if (pathItem && Object.keys(pathItem).length > 0) {
          const existingPath = spec.paths[pathCtx.pathTemplate];
          if (existingPath) {
            // Merge with existing path
            spec.paths[pathCtx.pathTemplate] = {
              ...existingPath,
              ...pathItem,
            };
          } else {
            spec.paths[pathCtx.pathTemplate] = pathItem;
          }
        }
      }
    }

    // Add collected tags
    if (collectedTags.size > 0 && !spec.tags) {
      spec.tags = Array.from(collectedTags).map(name => ({ name }));
    }

    return spec;
  }

  /**
   * Build Path Item
   */
  private buildPathItem(
    pathCtx: PathContext,
    collectedTags: Set<string>
  ): GeneratedPathItem | null {
    const pathItem: GeneratedPathItem = {};

    // Path level parameters
    if (pathCtx.parameters.length > 0) {
      pathItem.parameters = pathCtx.parameters.map(p => this.convertParameter(p));
    }

    // Process only documentable methods
    for (const methodCtx of pathCtx.methods) {
      const documentableResponses = filterDocumentableResponses(methodCtx.responses);
      if (documentableResponses.length === 0) {
        continue;
      }

      const operation = this.buildOperation(methodCtx, documentableResponses, collectedTags);
      const method = methodCtx.httpMethod.toLowerCase() as keyof GeneratedPathItem;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (pathItem as any)[method] = operation;
    }

    return pathItem;
  }

  /**
   * Build Operation
   */
  private buildOperation(
    methodCtx: MethodContext,
    responses: ResponseContext[],
    collectedTags: Set<string>
  ): GeneratedOperation {
    // Collect tags
    methodCtx.tags.forEach(tag => collectedTags.add(tag));

    const operation: GeneratedOperation = {
      summary: methodCtx.summary,
      responses: {},
    };

    // Operation ID
    if (methodCtx.operationId) {
      operation.operationId = methodCtx.operationId;
    }

    // Detailed description
    if (methodCtx.description) {
      operation.description = methodCtx.description;
    }

    // Tags
    if (methodCtx.tags.length > 0) {
      operation.tags = [...methodCtx.tags];
    }

    // Deprecated
    if (methodCtx.deprecated) {
      operation.deprecated = true;
    }

    // External Docs
    if (methodCtx.externalDocs) {
      operation.externalDocs = methodCtx.externalDocs;
    }

    // Parameters
    if (methodCtx.parameters.length > 0) {
      operation.parameters = methodCtx.parameters.map(p => this.convertParameter(p));
    }

    // Request body
    if (methodCtx.requestBody) {
      operation.requestBody = this.convertRequestBody(methodCtx.requestBody);
    }

    // Responses
    for (const responseCtx of responses) {
      const responseObj = this.buildResponse(responseCtx);
      operation.responses[String(responseCtx.statusCode)] = responseObj;
    }

    // Security requirements (Phase 5)
    if (methodCtx.security && methodCtx.security.length > 0) {
      operation.security = methodCtx.security;
    }

    return operation;
  }

  /**
   * Build Response
   */
  private buildResponse(responseCtx: ResponseContext): GeneratedResponse {
    const response: GeneratedResponse = {
      description: responseCtx.description,
    };

    // Headers
    if (responseCtx.headers) {
      response.headers = {};
      for (const [name, headerObj] of Object.entries(responseCtx.headers)) {
        response.headers[name] = {
          description: headerObj.description,
          schema: headerObj.schema
            ? processSchema(headerObj.schema, responseCtx.options, this.specPath)
            : undefined,
        };
      }
    }

    // Content
    if (responseCtx.content) {
      response.content = {};
      for (const [mediaType, mediaTypeObj] of Object.entries(responseCtx.content)) {
        response.content[mediaType] = {
          schema: mediaTypeObj.schema
            ? processSchema(mediaTypeObj.schema, responseCtx.options, this.specPath)
            : undefined,
          example: mediaTypeObj.example,
        };
      }
    } else if (responseCtx.schema) {
      // Wrap with default content-type if only schema exists
      response.content = {
        'application/json': {
          schema: processSchema(responseCtx.schema, responseCtx.options, this.specPath),
        },
      };
    }

    return response;
  }

  /**
   * Convert Parameter
   */
  private convertParameter(param: ParameterObject): GeneratedParameter {
    // body parameter is not supported in OpenAPI 3.0
    if (param.in === 'body') {
      // body should be converted to requestBody
      return {
        name: param.name,
        in: 'query', // Convert to default
        description: param.description,
        required: param.required,
        deprecated: param.deprecated,
        schema: param.schema
          ? processSchema(param.schema, {}, this.specPath)
          : undefined,
        example: param.example,
      };
    }

    const result: GeneratedParameter = {
      name: param.name,
      in: param.in,
      description: param.description,
      required: param.required,
      deprecated: param.deprecated,
      schema: param.schema
        ? processSchema(param.schema, {}, this.specPath)
        : undefined,
      example: param.example,
    };

    // nswag extension Enum processing: convert { value: description } format to enum array + x-enum-descriptions
    if (param.enum && typeof param.enum === 'object') {
      const enumValues = Object.keys(param.enum);
      const enumDescriptions: Record<string, string> = {};

      for (const [value, description] of Object.entries(param.enum)) {
        if (typeof description === 'string') {
          enumDescriptions[value] = description;
        }
      }

      // Add enum array to schema
      if (result.schema) {
        result.schema = {
          ...result.schema,
          enum: enumValues,
        };
      } else {
        result.schema = {
          type: 'string',
          enum: enumValues,
        };
      }

      // Add x-enum-descriptions extension field
      if (Object.keys(enumDescriptions).length > 0) {
        result['x-enum-descriptions'] = enumDescriptions;
      }
    }

    return result;
  }

  /**
   * Convert RequestBody
   */
  private convertRequestBody(body: RequestBodyObject): GeneratedRequestBody {
    const result: GeneratedRequestBody = {
      description: body.description,
      required: body.required,
      content: {},
    };

    for (const [mediaType, mediaTypeObj] of Object.entries(body.content)) {
      result.content[mediaType] = {
        schema: mediaTypeObj.schema
          ? processSchema(mediaTypeObj.schema, {}, this.specPath)
          : undefined,
        example: mediaTypeObj.example,
      };
    }

    return result;
  }

  /**
   * Output as JSON
   */
  toJSON(pretty = true): string {
    const spec = this.generate();
    return pretty ? JSON.stringify(spec, null, 2) : JSON.stringify(spec);
  }

  /**
   * Output as YAML
   */
  toYAML(): string {
    const spec = this.generate();
    return yamlStringify(spec, { indent: 2 });
  }
}

// ============================================================================
// Multiple spec generation
// ============================================================================

/**
 * Multiple spec generation result
 */
export interface MultiSpecResult {
  specPath: string;
  spec: GeneratedOpenAPISpec;
  json: string;
  yaml: string;
}

/**
 * Generate all configured spec files
 */
export function generateAllSpecs(): MultiSpecResult[] {
  const specPaths = GlobalConfigManager.getSpecPaths();
  const results: MultiSpecResult[] = [];

  // Generate by spec file
  for (const specPath of specPaths) {
    const generator = new DSLSpecGenerator(specPath);
    const spec = generator.generate();

    results.push({
      specPath,
      spec,
      json: JSON.stringify(spec, null, 2),
      yaml: yamlStringify(spec, { indent: 2 }),
    });
  }

  // Default spec (includes describes without openapiSpec)
  if (specPaths.length === 0) {
    const generator = new DSLSpecGenerator();
    const spec = generator.generate();

    results.push({
      specPath: 'openapi.json',
      spec,
      json: JSON.stringify(spec, null, 2),
      yaml: yamlStringify(spec, { indent: 2 }),
    });
  }

  return results;
}

/**
 * Generate single spec from DSL context
 */
export function generateSpec(specPath?: string): GeneratedOpenAPISpec {
  const generator = new DSLSpecGenerator(specPath);
  return generator.generate();
}

/**
 * Generate JSON spec from DSL context
 */
export function generateSpecJSON(specPath?: string, pretty = true): string {
  const generator = new DSLSpecGenerator(specPath);
  return generator.toJSON(pretty);
}

/**
 * Generate YAML spec from DSL context
 */
export function generateSpecYAML(specPath?: string): string {
  const generator = new DSLSpecGenerator(specPath);
  return generator.toYAML();
}
