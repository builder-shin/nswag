/**
 * nswag-api 타입 정의
 * 명세서 섹션 5. @aspect/nswag-api 모듈 기반
 */

/**
 * OpenAPI 객체 타입 (openapi-types 호환)
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
 * Express Request 타입 (프레임워크 독립)
 */
export interface ExpressRequest {
  headers: Record<string, string | string[] | undefined>;
  session?: { userRole?: string; [key: string]: unknown };
  path: string;
  method: string;
  [key: string]: unknown;
}

/**
 * Fastify Request 타입 (프레임워크 독립)
 */
export interface FastifyRequest {
  headers: Record<string, string | string[] | undefined>;
  session?: { userRole?: string; [key: string]: unknown };
  url: string;
  method: string;
  [key: string]: unknown;
}

/**
 * Koa Context 타입 (프레임워크 독립)
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
 * 동적 OpenAPI 필터 함수 타입
 * 프레임워크별로 두 번째 파라미터 타입이 다름
 */
export type OpenapiFilterFn<TContext = ExpressRequest | FastifyRequest | KoaContext> = (
  openapi: OpenAPIObject,
  reqOrCtx: TContext
) => OpenAPIObject | Promise<OpenAPIObject>;

/**
 * Express 전용 필터 함수 타입
 */
export type ExpressOpenapiFilterFn = OpenapiFilterFn<ExpressRequest>;

/**
 * Fastify 전용 필터 함수 타입
 */
export type FastifyOpenapiFilterFn = OpenapiFilterFn<FastifyRequest>;

/**
 * Koa 전용 필터 함수 타입
 */
export type KoaOpenapiFilterFn = OpenapiFilterFn<KoaContext>;

/**
 * 인증 설정 타입
 */
export interface AuthConfig {
  /** 인증 활성화 여부 */
  enabled: boolean;
  /** 인증 타입 */
  type: 'basic' | 'bearer' | 'api-key';
  /** 인증 자격 증명 */
  credentials: {
    /** basic 인증용 사용자명 */
    username?: string;
    /** basic 인증용 비밀번호 */
    password?: string;
    /** bearer 인증용 토큰 */
    token?: string;
    /** api-key 인증용 API 키 */
    apiKey?: string;
    /** api-key 인증 시 헤더명 (기본: 'X-API-Key') */
    headerName?: string;
  };
}

/**
 * 캐시 설정 타입
 */
export interface CacheConfig {
  /** 캐시 활성화 여부 */
  enabled: boolean;
  /** 캐시 유효 시간 (밀리초) */
  ttl: number;
}

/**
 * CORS 설정 타입
 */
export interface CorsConfig {
  /** CORS 활성화 여부 */
  enabled: boolean;
  /** 허용할 오리진 목록 */
  origins: string[];
}

/**
 * nswag-api 미들웨어 옵션
 */
export interface NswagApiOptions<TContext = ExpressRequest | FastifyRequest | KoaContext> {
  /** OpenAPI 파일들이 위치한 루트 디렉토리 */
  openapiRoot: string;

  /** 응답 형식 (기본: 파일 확장자에 따름) */
  defaultFormat?: 'json' | 'yaml';

  /** 캐싱 설정 */
  cache?: CacheConfig;

  /** CORS 설정 */
  cors?: CorsConfig;

  /** 인증 설정 (프로덕션 환경에서 문서 보호) */
  auth?: AuthConfig;

  /** 동적 필터 함수 */
  openapiFilter?: OpenapiFilterFn<TContext>;

  /** 커스텀 응답 헤더 */
  openapiHeaders?: Record<string, string>;
}

/**
 * Express 미들웨어 옵션
 */
export interface ExpressNswagApiOptions extends NswagApiOptions<ExpressRequest> {
  openapiFilter?: ExpressOpenapiFilterFn;
}

/**
 * Fastify 플러그인 옵션
 */
export interface FastifyNswagApiOptions extends NswagApiOptions<FastifyRequest> {
  /** 라우트 prefix (Fastify 플러그인용) */
  prefix?: string;
  openapiFilter?: FastifyOpenapiFilterFn;
}

/**
 * NestJS 모듈 옵션
 */
export interface NestJSNswagApiOptions extends NswagApiOptions {
  /** 라우트 경로 */
  path?: string;
}

/**
 * Koa 미들웨어 옵션
 */
export interface KoaNswagApiOptions extends NswagApiOptions<KoaContext> {
  /** 라우트 prefix */
  prefix?: string;
  openapiFilter?: KoaOpenapiFilterFn;
}

/**
 * 기본 옵션 값
 */
export const DEFAULT_OPTIONS = {
  defaultFormat: 'json' as const,
  cache: {
    enabled: true,
    ttl: 60000, // 1분
  },
  cors: {
    enabled: false,
    origins: [],
  },
  openapiHeaders: {},
};

/**
 * 캐시 엔트리 타입
 */
export interface CacheEntry {
  content: OpenAPIObject;
  timestamp: number;
  format: 'json' | 'yaml';
}

/**
 * 파일 정보 타입
 */
export interface FileInfo {
  /** 파일 절대 경로 */
  absolutePath: string;
  /** 상대 경로 (openapiRoot 기준) */
  relativePath: string;
  /** 파일 포맷 */
  format: 'json' | 'yaml';
  /** 버전 (예: v1, v2) */
  version?: string;
}
