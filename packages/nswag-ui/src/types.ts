/**
 * @aspect/nswag-ui type definitions
 * Swagger UI and Redoc UI configuration options
 */

/**
 * UI engine type
 */
export type UIEngine = 'swagger-ui' | 'redoc';

/**
 * Spec URL information (multi-spec support)
 */
export interface SpecUrl {
  /** OpenAPI spec URL */
  url: string;
  /** Spec name (displayed in selection dropdown) */
  name: string;
}

/**
 * Basic Auth configuration
 */
export interface BasicAuthConfig {
  /** Whether Basic Auth is enabled */
  enabled: boolean;
  /** Authentication credentials */
  credentials: {
    username: string;
    password: string;
  };
}

/**
 * Swagger UI native configuration options
 * @see https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/
 */
export interface SwaggerUIConfigObject {
  /** Default expansion depth for model section (default: 1, -1 hides all) */
  defaultModelsExpandDepth?: number;
  /** Default expansion depth for individual model (default: 1) */
  defaultModelExpandDepth?: number;
  /** Operation expansion mode: 'list' | 'full' | 'none' */
  docExpansion?: 'list' | 'full' | 'none';
  /** Display API request duration */
  displayRequestDuration?: boolean;
  /** Show filter search box */
  filter?: boolean | string;
  /** Enable deep linking */
  deepLinking?: boolean;
  /** Persist authorization information */
  persistAuthorization?: boolean;
  /** Show extension attributes */
  showExtensions?: boolean;
  /** Show common extension attributes */
  showCommonExtensions?: boolean;
  /** OAuth2 redirect URL */
  oauth2RedirectUrl?: string;
  /** OAuth configuration */
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
  /** Other configuration */
  [key: string]: unknown;
}

/**
 * Swagger UI options
 */
export interface SwaggerUiOptions {
  // === Spec URL ===
  /** Single spec URL */
  specUrl?: string;
  /** Multiple spec URL list */
  specUrls?: SpecUrl[];
  /** Default spec name to select */
  primaryName?: string;

  // === Basic Auth ===
  /** Basic Auth configuration */
  basicAuth?: BasicAuthConfig;

  // === Swagger UI Native Configuration ===
  /** Swagger UI configuration object */
  configObject?: SwaggerUIConfigObject;

  // === Customization ===
  /** Custom HTML template path */
  customHtmlPath?: string;
  /** Inline custom CSS */
  customCss?: string;
  /** External custom CSS URL */
  customCssUrl?: string;
  /** Custom JavaScript code */
  customJs?: string;
  /** Custom favicon URL */
  customFavicon?: string;
  /** Custom page title */
  customSiteTitle?: string;
}

/**
 * Redoc native configuration options
 * @see https://redocly.com/docs/redoc/config
 */
export interface RedocRawOptions {
  /** Theme configuration */
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
  /** Expandable default server variables */
  expandDefaultServerVariables?: boolean;
  /** Show request samples */
  expandResponses?: string;
  /** Open only one */
  maxDisplayedEnumValues?: number;
  /** Hide sidebar */
  hideSidebar?: boolean;
  /** Hide download button */
  hideDownloadButton?: boolean;
  /** Hide hostname */
  hideHostname?: boolean;
  /** Hide loading indicator */
  hideLoading?: boolean;
  /** Hide schema title */
  hideSchemaPattern?: boolean;
  /** Hide single request sample tab */
  hideSingleRequestSampleTab?: boolean;
  /** JSON sample expansion depth */
  jsonSampleExpandLevel?: number | 'all';
  /** Use native scrollbars */
  nativeScrollbars?: boolean;
  /** Remove request body response tab */
  noAutoAuth?: boolean;
  /** Expand path query */
  pathInMiddlePanel?: boolean;
  /** Show required properties first */
  requiredPropsFirst?: boolean;
  /** Scroll Y offset */
  scrollYOffset?: number | string;
  /** Show extensions */
  showExtensions?: boolean | string[];
  /** Sort response samples */
  sortPropsAlphabetically?: boolean;
  /** Other configuration */
  [key: string]: unknown;
}

/**
 * Redoc options
 */
export interface RedocOptions {
  /** Spec URL (required) */
  specUrl: string;

  // === Basic Auth ===
  /** Basic Auth configuration */
  basicAuth?: BasicAuthConfig;

  // === Redoc Native Configuration ===
  /** Redoc configuration object */
  options?: RedocRawOptions;

  // === Customization ===
  /** Inline custom CSS */
  customCss?: string;
  /** External custom CSS URL */
  customCssUrl?: string;
  /** Custom JavaScript code */
  customJs?: string;
  /** Custom favicon URL */
  customFavicon?: string;
  /** Custom page title */
  customSiteTitle?: string;
}

/**
 * NestJS module options
 */
export interface NswagUiModuleOptions {
  /** UI path (default: /docs) */
  path: string;
  /** Spec URL list */
  specUrls: SpecUrl[];
  /** UI engine selection: 'swagger-ui' | 'redoc' */
  engine: UIEngine;
  /** Default spec name to select */
  primaryName?: string;
  /** Basic Auth configuration */
  basicAuth?: BasicAuthConfig;
  /** Customization options */
  customization?: {
    customCss?: string;
    customCssUrl?: string;
    customJs?: string;
    customFavicon?: string;
    customSiteTitle?: string;
  };
  /** Engine-specific additional configuration */
  engineOptions?: SwaggerUIConfigObject | RedocRawOptions;
}

/**
 * Fastify Swagger UI plugin options
 */
export interface FastifySwaggerUiPluginOptions extends SwaggerUiOptions {
  /** Route prefix (default: /docs) */
  prefix?: string;
}

/**
 * Fastify Redoc plugin options
 */
export interface FastifyRedocPluginOptions extends RedocOptions {
  /** Route prefix (default: /redoc) */
  prefix?: string;
}

// ========== Legacy Compatible Types (for backward compatibility) ==========

/**
 * @deprecated Use SwaggerUiOptions instead
 */
export type SwaggerUIOptions = SwaggerUiOptions;

/**
 * UI type (legacy)
 * @deprecated Use UIEngine instead
 */
export type UIType = UIEngine;

/**
 * Redoc theme configuration (legacy)
 * @deprecated Use RedocRawOptions.theme instead
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

// ========== Default Constants ==========

/**
 * Default Swagger UI options
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
 * Default Redoc options
 */
export const DEFAULT_REDOC_OPTIONS = {
  customSiteTitle: 'API Documentation',
  options: {
    expandResponses: '200,201',
    hideDownloadButton: false,
    nativeScrollbars: true,
  },
} as const;
