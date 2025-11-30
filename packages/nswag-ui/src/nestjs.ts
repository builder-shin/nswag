/**
 * NestJS module
 * Integrate Swagger UI or Redoc into NestJS app
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

// ========== NestJS Type Definitions (used without dependencies) ==========

type Constructor<T = object> = new (...args: unknown[]) => T;

interface DynamicModule {
  module: Constructor;
  providers?: unknown[];
  exports?: unknown[];
  controllers?: Constructor[];
  imports?: unknown[];
  global?: boolean;
}

// ========== Token Constants ==========

/**
 * NswagUI configuration injection token
 */
export const NSWAG_UI_OPTIONS = 'NSWAG_UI_OPTIONS';

// ========== NswagUiModule Class ==========

/**
 * NswagUI NestJS module
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
   * Initialize module with static configuration
   *
   * @param options - UI configuration options
   * @returns Dynamic module
   */
  static forRoot(options: NswagUiModuleOptions): DynamicModule {
    // Generate HTML
    const html = generateUiHtml(options);

    // Create handler factory
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

    // Options provider
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
   * Initialize module with async configuration
   *
   * @param options - Async configuration options
   * @returns Dynamic module
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

// ========== Helper Functions ==========

/**
 * Generate UI HTML based on options
 */
function generateUiHtml(options: NswagUiModuleOptions): string {
  if (options.engine === 'redoc') {
    // Use first specUrl for Redoc
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

// ========== Handler Factories (for existing compatibility) ==========

/**
 * NestJS Swagger UI handler factory
 *
 * @param options - Swagger UI options
 * @returns Controller handler and path information
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
     * Return Swagger UI HTML handler
     */
    getSwaggerUI() {
      return html;
    },

    /**
     * Path information
     */
    path: options.path ?? '/docs',

    /**
     * Content-Type
     */
    contentType: 'text/html',

    /**
     * Basic Auth verification
     */
    validateAuth(authHeader: string | undefined): boolean {
      return validateBasicAuth(authHeader, options.basicAuth);
    },
  };
}

/**
 * NestJS Redoc handler factory
 *
 * @param options - Redoc options
 * @returns Controller handler and path information
 */
export function createRedocHandlers(options: RedocOptions & { path?: string }) {
  const html = generateRedocHtml(options);

  return {
    /**
     * Return Redoc HTML handler
     */
    getRedoc() {
      return html;
    },

    /**
     * Path information
     */
    path: options.path ?? '/redoc',

    /**
     * Content-Type
     */
    contentType: 'text/html',

    /**
     * Basic Auth verification
     */
    validateAuth(authHeader: string | undefined): boolean {
      return validateBasicAuth(authHeader, options.basicAuth);
    },
  };
}

// ========== Legacy Compatible Functions ==========

/**
 * NestJS UI module factory (legacy)
 * @deprecated Use NswagUiModule.forRoot() instead
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
