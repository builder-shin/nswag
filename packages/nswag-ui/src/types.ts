/**
 * @aspect/nswag-ui 타입 정의
 * Swagger UI 및 Redoc UI 설정 옵션
 */

/**
 * UI 엔진 유형
 */
export type UIEngine = 'swagger-ui' | 'redoc';

/**
 * 스펙 URL 정보 (다중 스펙 지원)
 */
export interface SpecUrl {
  /** OpenAPI 스펙 URL */
  url: string;
  /** 스펙 이름 (선택 드롭다운에 표시) */
  name: string;
}

/**
 * Basic Auth 설정
 */
export interface BasicAuthConfig {
  /** Basic Auth 활성화 여부 */
  enabled: boolean;
  /** 인증 자격 증명 */
  credentials: {
    username: string;
    password: string;
  };
}

/**
 * Swagger UI 네이티브 설정 옵션
 * @see https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/
 */
export interface SwaggerUIConfigObject {
  /** 모델 섹션 기본 펼침 깊이 (기본: 1, -1은 모두 숨김) */
  defaultModelsExpandDepth?: number;
  /** 개별 모델 기본 펼침 깊이 (기본: 1) */
  defaultModelExpandDepth?: number;
  /** 작업 확장 방식: 'list' | 'full' | 'none' */
  docExpansion?: 'list' | 'full' | 'none';
  /** API 요청 소요 시간 표시 */
  displayRequestDuration?: boolean;
  /** 필터 검색창 표시 */
  filter?: boolean | string;
  /** 딥 링킹 활성화 */
  deepLinking?: boolean;
  /** 인증 정보 저장 */
  persistAuthorization?: boolean;
  /** 확장 속성 표시 */
  showExtensions?: boolean;
  /** 공통 확장 속성 표시 */
  showCommonExtensions?: boolean;
  /** OAuth2 리다이렉트 URL */
  oauth2RedirectUrl?: string;
  /** OAuth 설정 */
  oauth?: {
    clientId?: string;
    clientSecret?: string;
    realm?: string;
    appName?: string;
    scopeSeparator?: string;
    scopes?: string;
    additionalQueryStringParams?: Record<string, string>;
    useBasicAuthenticationWithAccessCodeGrant?: boolean;
    usePkceWithAuthorizationCodeGrant?: boolean;
  };
  /** 기타 설정 */
  [key: string]: unknown;
}

/**
 * Swagger UI 옵션
 */
export interface SwaggerUiOptions {
  // === 스펙 URL ===
  /** 단일 스펙 URL */
  specUrl?: string;
  /** 다중 스펙 URL 목록 */
  specUrls?: SpecUrl[];
  /** 기본 선택할 스펙 이름 */
  primaryName?: string;

  // === Basic Auth ===
  /** Basic Auth 설정 */
  basicAuth?: BasicAuthConfig;

  // === Swagger UI 네이티브 설정 ===
  /** Swagger UI 설정 객체 */
  configObject?: SwaggerUIConfigObject;

  // === 커스터마이징 ===
  /** 커스텀 HTML 템플릿 경로 */
  customHtmlPath?: string;
  /** 인라인 커스텀 CSS */
  customCss?: string;
  /** 외부 커스텀 CSS URL */
  customCssUrl?: string;
  /** 커스텀 JavaScript 코드 */
  customJs?: string;
  /** 커스텀 파비콘 URL */
  customFavicon?: string;
  /** 커스텀 페이지 제목 */
  customSiteTitle?: string;
}

/**
 * Redoc 네이티브 설정 옵션
 * @see https://redocly.com/docs/redoc/config
 */
export interface RedocRawOptions {
  /** 테마 설정 */
  theme?: {
    colors?: {
      primary?: {
        main?: string;
      };
      success?: {
        main?: string;
      };
      warning?: {
        main?: string;
      };
      error?: {
        main?: string;
      };
      text?: {
        primary?: string;
        secondary?: string;
      };
      responses?: {
        success?: {
          color?: string;
          backgroundColor?: string;
        };
        error?: {
          color?: string;
          backgroundColor?: string;
        };
      };
      http?: {
        get?: string;
        post?: string;
        put?: string;
        patch?: string;
        delete?: string;
      };
    };
    typography?: {
      fontSize?: string;
      fontFamily?: string;
      headings?: {
        fontFamily?: string;
        fontWeight?: string;
      };
      code?: {
        fontSize?: string;
        fontFamily?: string;
      };
    };
    sidebar?: {
      width?: string;
      backgroundColor?: string;
      textColor?: string;
    };
    rightPanel?: {
      backgroundColor?: string;
      width?: string;
    };
    logo?: {
      maxHeight?: string;
      maxWidth?: string;
      gutter?: string;
    };
  };
  /** 확장 가능한 기본 상태 */
  expandDefaultServerVariables?: boolean;
  /** 요청 샘플 표시 */
  expandResponses?: string;
  /** 하나만 열기 */
  maxDisplayedEnumValues?: number;
  /** 사이드바 숨김 */
  hideSidebar?: boolean;
  /** 다운로드 버튼 숨김 */
  hideDownloadButton?: boolean;
  /** 호스트 이름 숨김 */
  hideHostname?: boolean;
  /** 로딩 표시기 숨김 */
  hideLoading?: boolean;
  /** 스키마 제목 숨김 */
  hideSchemaPattern?: boolean;
  /** 단일 요청 샘플 탭 숨김 */
  hideSingleRequestSampleTab?: boolean;
  /** JSON 샘플 펼침 깊이 */
  jsonSampleExpandLevel?: number | 'all';
  /** 네이티브 스크롤바 사용 */
  nativeScrollbars?: boolean;
  /** 요청 본문 응답 탭 제거 */
  noAutoAuth?: boolean;
  /** 경로 쿼리 펼치기 */
  pathInMiddlePanel?: boolean;
  /** 필수 속성 우선 표시 */
  requiredPropsFirst?: boolean;
  /** 스크롤 Y 오프셋 */
  scrollYOffset?: number | string;
  /** 확장 표시 */
  showExtensions?: boolean | string[];
  /** 응답 샘플 정렬 */
  sortPropsAlphabetically?: boolean;
  /** 기타 설정 */
  [key: string]: unknown;
}

/**
 * Redoc 옵션
 */
export interface RedocOptions {
  /** 스펙 URL (필수) */
  specUrl: string;

  // === Basic Auth ===
  /** Basic Auth 설정 */
  basicAuth?: BasicAuthConfig;

  // === Redoc 네이티브 설정 ===
  /** Redoc 설정 객체 */
  options?: RedocRawOptions;

  // === 커스터마이징 ===
  /** 인라인 커스텀 CSS */
  customCss?: string;
  /** 외부 커스텀 CSS URL */
  customCssUrl?: string;
  /** 커스텀 JavaScript 코드 */
  customJs?: string;
  /** 커스텀 파비콘 URL */
  customFavicon?: string;
  /** 커스텀 페이지 제목 */
  customSiteTitle?: string;
}

/**
 * NestJS 모듈 옵션
 */
export interface NswagUiModuleOptions {
  /** UI 경로 (기본: /docs) */
  path: string;
  /** 스펙 URL 목록 */
  specUrls: SpecUrl[];
  /** UI 엔진 선택: 'swagger-ui' | 'redoc' */
  engine: UIEngine;
  /** 기본 선택 스펙 이름 */
  primaryName?: string;
  /** Basic Auth 설정 */
  basicAuth?: BasicAuthConfig;
  /** 커스터마이징 옵션 */
  customization?: {
    customCss?: string;
    customCssUrl?: string;
    customJs?: string;
    customFavicon?: string;
    customSiteTitle?: string;
  };
  /** 엔진별 추가 설정 */
  engineOptions?: SwaggerUIConfigObject | RedocRawOptions;
}

/**
 * Fastify Swagger UI 플러그인 옵션
 */
export interface FastifySwaggerUiPluginOptions extends SwaggerUiOptions {
  /** 라우트 prefix (기본: /docs) */
  prefix?: string;
}

/**
 * Fastify Redoc 플러그인 옵션
 */
export interface FastifyRedocPluginOptions extends RedocOptions {
  /** 라우트 prefix (기본: /redoc) */
  prefix?: string;
}

// ========== 레거시 호환 타입 (하위 호환성) ==========

/**
 * @deprecated SwaggerUiOptions를 사용하세요
 */
export type SwaggerUIOptions = SwaggerUiOptions;

/**
 * UI 유형 (레거시)
 * @deprecated UIEngine을 사용하세요
 */
export type UIType = UIEngine;

/**
 * Redoc 테마 설정 (레거시)
 * @deprecated RedocRawOptions.theme을 사용하세요
 */
export interface RedocTheme {
  colors?: {
    primary?: {
      main?: string;
    };
  };
  typography?: {
    fontSize?: string;
    fontFamily?: string;
  };
  sidebar?: {
    backgroundColor?: string;
  };
}

// ========== 기본값 상수 ==========

/**
 * 기본 Swagger UI 옵션
 */
export const DEFAULT_SWAGGER_UI_OPTIONS = {
  customSiteTitle: 'API Documentation',
  configObject: {
    deepLinking: true,
    displayRequestDuration: true,
    filter: true,
    persistAuthorization: true,
  },
} as const;

/**
 * 기본 Redoc 옵션
 */
export const DEFAULT_REDOC_OPTIONS = {
  customSiteTitle: 'API Documentation',
  options: {
    expandResponses: '200,201',
    hideDownloadButton: false,
    nativeScrollbars: true,
  },
} as const;
