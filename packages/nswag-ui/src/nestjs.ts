/**
 * NestJS 모듈
 * NestJS 앱에 Swagger UI 또는 Redoc 통합
 */

import {
  generateSwaggerUIHtml,
  generateRedocHtml,
} from './html-generator.js';
import {
  validateBasicAuth,
} from './basic-auth.js';
import type {
  NswagUiModuleOptions,
  SwaggerUiOptions,
  RedocOptions,
  SwaggerUIConfigObject,
  RedocRawOptions,
} from './types.js';

// ========== NestJS 타입 정의 (의존성 없이 사용) ==========

type Constructor<T = object> = new (...args: unknown[]) => T;

interface DynamicModule {
  module: Constructor;
  providers?: unknown[];
  exports?: unknown[];
  controllers?: Constructor[];
  imports?: unknown[];
  global?: boolean;
}

// ========== 토큰 상수 ==========

/**
 * NswagUI 설정 주입 토큰
 */
export const NSWAG_UI_OPTIONS = 'NSWAG_UI_OPTIONS';

// ========== NswagUiModule 클래스 ==========

/**
 * NswagUI NestJS 모듈
 *
 * @example
 * ```typescript
 * import { NswagUiModule } from '@aspect/nswag-ui/nestjs';
 *
 * @Module({
 *   imports: [
 *     NswagUiModule.forRoot({
 *       path: '/docs',
 *       specUrls: [
 *         { url: '/api-docs/v1/openapi.json', name: 'API V1 Docs' },
 *         { url: '/api-docs/v2/openapi.json', name: 'API V2 Docs' },
 *       ],
 *       engine: 'swagger-ui',  // 'swagger-ui' | 'redoc'
 *       primaryName: 'API V2 Docs',
 *       basicAuth: {
 *         enabled: true,
 *         credentials: { username: 'admin', password: 'secret' }
 *       }
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
export class NswagUiModule {
  /**
   * 정적 설정으로 모듈 초기화
   *
   * @param options - UI 설정 옵션
   * @returns 동적 모듈
   */
  static forRoot(options: NswagUiModuleOptions): DynamicModule {
    // HTML 생성
    const html = generateUiHtml(options);

    // 핸들러 팩토리 생성
    const uiHandlerFactory = {
      provide: 'NSWAG_UI_HANDLER',
      useFactory: () => ({
        getHtml: () => html,
        path: options.path,
        contentType: 'text/html',
        validateAuth: (authHeader: string | undefined) =>
          validateBasicAuth(authHeader, options.basicAuth),
      }),
    };

    // 옵션 프로바이더
    const optionsProvider = {
      provide: NSWAG_UI_OPTIONS,
      useValue: options,
    };

    return {
      module: NswagUiModule,
      providers: [optionsProvider, uiHandlerFactory],
      exports: [NSWAG_UI_OPTIONS, 'NSWAG_UI_HANDLER'],
      global: true,
    };
  }

  /**
   * 비동기 설정으로 모듈 초기화
   *
   * @param options - 비동기 설정 옵션
   * @returns 동적 모듈
   *
   * @example
   * ```typescript
   * NswagUiModule.forRootAsync({
   *   imports: [ConfigModule],
   *   useFactory: (configService: ConfigService) => ({
   *     path: '/docs',
   *     specUrls: [{ url: '/api-docs/openapi.json', name: 'API Docs' }],
   *     engine: 'swagger-ui',
   *     basicAuth: {
   *       enabled: configService.get('DOCS_AUTH_ENABLED'),
   *       credentials: {
   *         username: configService.get('DOCS_USERNAME'),
   *         password: configService.get('DOCS_PASSWORD'),
   *       }
   *     }
   *   }),
   *   inject: [ConfigService],
   * })
   * ```
   */
  static forRootAsync(asyncOptions: {
    imports?: unknown[];
    useFactory: (...args: unknown[]) => NswagUiModuleOptions | Promise<NswagUiModuleOptions>;
    inject?: unknown[];
  }): DynamicModule {
    const optionsProvider = {
      provide: NSWAG_UI_OPTIONS,
      useFactory: asyncOptions.useFactory,
      inject: asyncOptions.inject || [],
    };

    const uiHandlerFactory = {
      provide: 'NSWAG_UI_HANDLER',
      useFactory: (options: NswagUiModuleOptions) => {
        const html = generateUiHtml(options);
        return {
          getHtml: () => html,
          path: options.path,
          contentType: 'text/html',
          validateAuth: (authHeader: string | undefined) =>
            validateBasicAuth(authHeader, options.basicAuth),
        };
      },
      inject: [NSWAG_UI_OPTIONS],
    };

    return {
      module: NswagUiModule,
      imports: asyncOptions.imports || [],
      providers: [optionsProvider, uiHandlerFactory],
      exports: [NSWAG_UI_OPTIONS, 'NSWAG_UI_HANDLER'],
      global: true,
    };
  }
}

// ========== 헬퍼 함수 ==========

/**
 * 옵션에 따른 UI HTML 생성
 */
function generateUiHtml(options: NswagUiModuleOptions): string {
  if (options.engine === 'redoc') {
    // Redoc의 경우 첫 번째 specUrl 사용
    const specUrl = options.specUrls[0]?.url ?? '';
    const redocOptions: RedocOptions = {
      specUrl,
      basicAuth: options.basicAuth,
      customCss: options.customization?.customCss,
      customCssUrl: options.customization?.customCssUrl,
      customJs: options.customization?.customJs,
      customFavicon: options.customization?.customFavicon,
      customSiteTitle: options.customization?.customSiteTitle,
      options: options.engineOptions as RedocRawOptions,
    };
    return generateRedocHtml(redocOptions);
  }

  // Swagger UI
  const swaggerOptions: SwaggerUiOptions = {
    specUrls: options.specUrls,
    primaryName: options.primaryName,
    basicAuth: options.basicAuth,
    customCss: options.customization?.customCss,
    customCssUrl: options.customization?.customCssUrl,
    customJs: options.customization?.customJs,
    customFavicon: options.customization?.customFavicon,
    customSiteTitle: options.customization?.customSiteTitle,
    configObject: options.engineOptions as SwaggerUIConfigObject,
  };
  return generateSwaggerUIHtml(swaggerOptions);
}

// ========== 핸들러 팩토리 (기존 호환) ==========

/**
 * NestJS Swagger UI 핸들러 팩토리
 *
 * @param options - Swagger UI 옵션
 * @returns 컨트롤러 핸들러 및 경로 정보
 *
 * @example
 * ```typescript
 * import { Controller, Get, Header, Req, Res, HttpStatus } from '@nestjs/common';
 * import { createSwaggerUIHandlers } from '@aspect/nswag-ui/nestjs';
 *
 * const swaggerHandlers = createSwaggerUIHandlers({
 *   specUrl: '/api-docs.json',
 *   basicAuth: {
 *     enabled: true,
 *     credentials: { username: 'admin', password: 'secret' }
 *   }
 * });
 *
 * @Controller()
 * export class DocsController {
 *   @Get(swaggerHandlers.path)
 *   getSwaggerUI(@Req() req: Request, @Res() res: Response) {
 *     if (!swaggerHandlers.validateAuth(req.headers.authorization)) {
 *       res.setHeader('WWW-Authenticate', 'Basic realm="API Documentation"');
 *       return res.status(HttpStatus.UNAUTHORIZED).send('Unauthorized');
 *     }
 *     res.setHeader('Content-Type', swaggerHandlers.contentType);
 *     return res.send(swaggerHandlers.getSwaggerUI());
 *   }
 * }
 * ```
 */
export function createSwaggerUIHandlers(options: SwaggerUiOptions & { path?: string }) {
  const html = generateSwaggerUIHtml(options);

  return {
    /**
     * Swagger UI HTML 반환 핸들러
     */
    getSwaggerUI() {
      return html;
    },

    /**
     * 경로 정보
     */
    path: options.path ?? '/docs',

    /**
     * Content-Type
     */
    contentType: 'text/html',

    /**
     * Basic Auth 검증
     */
    validateAuth(authHeader: string | undefined): boolean {
      return validateBasicAuth(authHeader, options.basicAuth);
    },
  };
}

/**
 * NestJS Redoc 핸들러 팩토리
 *
 * @param options - Redoc 옵션
 * @returns 컨트롤러 핸들러 및 경로 정보
 */
export function createRedocHandlers(options: RedocOptions & { path?: string }) {
  const html = generateRedocHtml(options);

  return {
    /**
     * Redoc HTML 반환 핸들러
     */
    getRedoc() {
      return html;
    },

    /**
     * 경로 정보
     */
    path: options.path ?? '/redoc',

    /**
     * Content-Type
     */
    contentType: 'text/html',

    /**
     * Basic Auth 검증
     */
    validateAuth(authHeader: string | undefined): boolean {
      return validateBasicAuth(authHeader, options.basicAuth);
    },
  };
}

// ========== 레거시 호환 함수 ==========

/**
 * NestJS UI 모듈 팩토리 (레거시)
 * @deprecated NswagUiModule.forRoot()를 사용하세요
 */
export function createNswagUIModule(options: {
  swagger?: SwaggerUiOptions & { path?: string };
  redoc?: RedocOptions & { path?: string };
}) {
  return {
    module: class NswagUIModuleLegacy {},
    providers: [
      {
        provide: 'SWAGGER_UI_HANDLERS',
        useValue: options.swagger ? createSwaggerUIHandlers(options.swagger) : null,
      },
      {
        provide: 'REDOC_HANDLERS',
        useValue: options.redoc ? createRedocHandlers(options.redoc) : null,
      },
    ],
    exports: ['SWAGGER_UI_HANDLERS', 'REDOC_HANDLERS'],
  };
}
