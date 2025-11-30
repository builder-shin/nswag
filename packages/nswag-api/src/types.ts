/**
 * nswag-api type definitions
 * Based on specification section 5. @builder-shin/nswag-api module
 */

/**
 * OpenAPI object type (openapi-types compatible)
 */
export interface OpenAPIObject {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
    [key: string]: unknown;
  };
  host?: string;
  basePath?: string;
  servers?: Array<{
    url: string;
    description?: string;
    [key: string]: unknown;
  }>;
  paths: Record<string, unknown>;
  components?: Record<string, unknown>;
  tags?: Array<{ name: string; description?: string }>;
  [key: string]: unknown;
}

/**
 * Express Request type (framework independent)
 */
export interface ExpressRequest {
  headers: Record<string, string | string[] | undefined>;
  session?: { userRole?: string; [key: string]: unknown };
  path: string;
  method: string;
  [key: string]: unknown;
}

/**
 * Fastify Request type (framework independent)
 */
export interface FastifyRequest {
  headers: Record<string, string | string[] | undefined>;
  session?: { userRole?: string; [key: string]: unknown };
  url: string;
  method: string;
  [key: string]: unknown;
}

/**
 * Koa Context type (framework independent)
 */
export interface KoaContext {
  headers: Record<string, string | string[] | undefined>;
  session?: { userRole?: string; [key: string]: unknown };
  path: string;
  method: string;
  request: {
    headers: Record<string, string | string[] | undefined>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Dynamic OpenAPI filter function type
 * Second parameter type differs by framework
 */
export type OpenapiFilterFn<TContext = ExpressRequest | FastifyRequest | KoaContext> = (
  openapi: OpenAPIObject,
  reqOrCtx: TContext
) => OpenAPIObject | Promise<OpenAPIObject>;

/**
 * Express-specific filter function type
 */
export type ExpressOpenapiFilterFn = OpenapiFilterFn<ExpressRequest>;

/**
 * Fastify-specific filter function type
 */
export type FastifyOpenapiFilterFn = OpenapiFilterFn<FastifyRequest>;

/**
 * Koa-specific filter function type
 */
export type KoaOpenapiFilterFn = OpenapiFilterFn<KoaContext>;

/**
 * Authentication configuration type
 */
export interface AuthConfig {
  /** Whether authentication is enabled */
  enabled: boolean;
  /** Authentication type */
  type: 'basic' | 'bearer' | 'api-key';
  /** Authentication credentials */
  credentials: {
    /** Username for basic authentication */
    username?: string;
    /** Password for basic authentication */
    password?: string;
    /** Token for bearer authentication */
    token?: string;
    /** API key for api-key authentication */
    apiKey?: string;
    /** Header name for api-key authentication (default: 'X-API-Key') */
    headerName?: string;
  };
}

/**
 * Cache configuration type
 */
export interface CacheConfig {
  /** Whether caching is enabled */
  enabled: boolean;
  /** Cache time-to-live (milliseconds) */
  ttl: number;
}

/**
 * CORS configuration type
 */
export interface CorsConfig {
  /** Whether CORS is enabled */
  enabled: boolean;
  /** List of allowed origins */
  origins: string[];
}

/**
 * nswag-api middleware options
 */
export interface NswagApiOptions<TContext = ExpressRequest | FastifyRequest | KoaContext> {
  /** Root directory where OpenAPI files are located */
  openapiRoot: string;

  /** Response format (default: depends on file extension) */
  defaultFormat?: 'json' | 'yaml';

  /** Caching configuration */
  cache?: CacheConfig;

  /** CORS configuration */
  cors?: CorsConfig;

  /** Authentication configuration (for protecting documentation in production) */
  auth?: AuthConfig;

  /** Dynamic filter function */
  openapiFilter?: OpenapiFilterFn<TContext>;

  /** Custom response headers */
  openapiHeaders?: Record<string, string>;
}

/**
 * Express middleware options
 */
export interface ExpressNswagApiOptions extends NswagApiOptions<ExpressRequest> {
  openapiFilter?: ExpressOpenapiFilterFn;
}

/**
 * Fastify plugin options
 */
export interface FastifyNswagApiOptions extends NswagApiOptions<FastifyRequest> {
  /** Route prefix (for Fastify plugin) */
  prefix?: string;
  openapiFilter?: FastifyOpenapiFilterFn;
}

/**
 * NestJS module options
 */
export interface NestJSNswagApiOptions extends NswagApiOptions {
  /** Route path */
  path?: string;
}

/**
 * Koa middleware options
 */
export interface KoaNswagApiOptions extends NswagApiOptions<KoaContext> {
  /** Route prefix */
  prefix?: string;
  openapiFilter?: KoaOpenapiFilterFn;
}

/**
 * Default option values
 */
export const DEFAULT_OPTIONS = {
  defaultFormat: 'json' as const,
  cache: {
    enabled: true,
    ttl: 60000, // 1 minute
  },
  cors: {
    enabled: false,
    origins: [],
  },
  openapiHeaders: {},
};

/**
 * Cache entry type
 */
export interface CacheEntry {
  content: OpenAPIObject;
  timestamp: number;
  format: 'json' | 'yaml';
}

/**
 * File information type
 */
export interface FileInfo {
  /** Absolute file path */
  absolutePath: string;
  /** Relative path (based on openapiRoot) */
  relativePath: string;
  /** File format */
  format: 'json' | 'yaml';
  /** Version (e.g., v1, v2) */
  version?: string;
}
