/**
 * Basic Auth 처리 로직
 * Swagger UI 및 Redoc UI 보호를 위한 인증 미들웨어
 */

import type { BasicAuthConfig } from './types.js';

/**
 * 인증 결과 인터페이스
 */
export interface AuthResult {
  /** 인증 성공 여부 */
  authenticated: boolean;
  /** 인증 실패 시 응답 헤더 */
  headers?: Record<string, string>;
  /** 인증 실패 시 상태 코드 */
  statusCode?: number;
  /** 인증 실패 시 응답 본문 */
  body?: string;
}

/**
 * Basic Auth 검증
 *
 * @param authHeader - Authorization 헤더 값
 * @param config - Basic Auth 설정
 * @returns 인증 결과
 */
export function verifyBasicAuth(
  authHeader: string | undefined,
  config: BasicAuthConfig
): AuthResult {
  // Basic Auth가 비활성화되어 있으면 항상 인증 성공
  if (!config.enabled) {
    return { authenticated: true };
  }

  // Authorization 헤더가 없는 경우
  if (!authHeader) {
    return createUnauthorizedResponse();
  }

  // Basic Auth 형식 검증
  if (!authHeader.startsWith('Basic ')) {
    return createUnauthorizedResponse();
  }

  try {
    // Base64 디코딩
    const base64Credentials = authHeader.slice(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    // 자격 증명 검증
    if (
      username === config.credentials.username &&
      password === config.credentials.password
    ) {
      return { authenticated: true };
    }

    return createUnauthorizedResponse();
  } catch {
    return createUnauthorizedResponse();
  }
}

/**
 * 401 Unauthorized 응답 생성
 */
function createUnauthorizedResponse(): AuthResult {
  return {
    authenticated: false,
    statusCode: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="API Documentation"',
    },
    body: 'Unauthorized',
  };
}

/**
 * Express용 Basic Auth 미들웨어 생성
 *
 * @param config - Basic Auth 설정
 * @returns Express 미들웨어 함수
 */
export function createExpressBasicAuthMiddleware(
  config?: BasicAuthConfig
): (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => void {
  return (req: ExpressRequest, res: ExpressResponse, next: ExpressNext) => {
    // Basic Auth가 설정되지 않았거나 비활성화된 경우 통과
    if (!config || !config.enabled) {
      return next();
    }

    const authHeader = req.headers.authorization;
    const result = verifyBasicAuth(authHeader, config);

    if (result.authenticated) {
      return next();
    }

    // 인증 실패 응답
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    res.status(result.statusCode ?? 401).send(result.body ?? 'Unauthorized');
  };
}

/**
 * Fastify용 Basic Auth preHandler 생성
 *
 * @param config - Basic Auth 설정
 * @returns Fastify preHandler 함수
 */
export function createFastifyBasicAuthHook(
  config?: BasicAuthConfig
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Basic Auth가 설정되지 않았거나 비활성화된 경우 통과
    if (!config || !config.enabled) {
      return;
    }

    const authHeader = request.headers.authorization;
    const result = verifyBasicAuth(authHeader, config);

    if (result.authenticated) {
      return;
    }

    // 인증 실패 응답
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        reply.header(key, value);
      });
    }
    reply.status(result.statusCode ?? 401).send(result.body ?? 'Unauthorized');
  };
}

/**
 * NestJS용 Basic Auth Guard 로직
 *
 * @param authHeader - Authorization 헤더 값
 * @param config - Basic Auth 설정
 * @returns 인증 성공 여부
 */
export function validateBasicAuth(
  authHeader: string | undefined,
  config?: BasicAuthConfig
): boolean {
  if (!config || !config.enabled) {
    return true;
  }

  const result = verifyBasicAuth(authHeader, config);
  return result.authenticated;
}

// ========== 타입 정의 (Express/Fastify 의존성 없이) ==========

/**
 * Express Request 타입 (의존성 없이 사용)
 */
interface ExpressRequest {
  headers: {
    authorization?: string;
  };
}

/**
 * Express Response 타입 (의존성 없이 사용)
 */
interface ExpressResponse {
  setHeader(name: string, value: string): void;
  status(code: number): ExpressResponse;
  send(body: string): void;
}

/**
 * Express Next 함수 타입
 */
type ExpressNext = () => void;

/**
 * Fastify Request 타입 (의존성 없이 사용)
 */
interface FastifyRequest {
  headers: {
    authorization?: string;
  };
}

/**
 * Fastify Reply 타입 (의존성 없이 사용)
 */
interface FastifyReply {
  header(name: string, value: string): FastifyReply;
  status(code: number): FastifyReply;
  send(payload: string): FastifyReply;
}
