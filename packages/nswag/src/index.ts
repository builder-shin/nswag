/**
 * @aspect/nswag
 * Node.js용 OpenAPI 스펙 생성 및 문서화 도구 - 메타 패키지
 *
 * 이 패키지는 세 가지 핵심 모듈을 모두 포함하는 편의용 패키지입니다:
 * - @aspect/nswag-specs: OpenAPI 기반 DSL과 테스트 러너 통합
 * - @aspect/nswag-api: API 엔드포인트 미들웨어
 * - @aspect/nswag-ui: Swagger UI / Redoc 문서 인터페이스
 */

// @aspect/nswag-specs 재내보내기
export * from '@aspect/nswag-specs';

// @aspect/nswag-api 재내보내기 (네임스페이스로)
export * as api from '@aspect/nswag-api';

// @aspect/nswag-ui 재내보내기 (네임스페이스로)
export * as ui from '@aspect/nswag-ui';
