/**
 * 설정 타입 정의
 */

/**
 * 테스트 프레임워크 타입
 */
export type TestFramework = 'jest' | 'vitest' | 'mocha';

/**
 * NswagPlugin 인터페이스
 */
export interface NswagPlugin {
  /** 플러그인 이름 */
  name: string;
  /** 설정 훅 */
  setup?: (config: NswagConfig) => void | Promise<void>;
  /** 생성 전 훅 */
  beforeGenerate?: (spec: unknown) => void | Promise<void>;
  /** 생성 후 훅 */
  afterGenerate?: (spec: unknown, outputPath: string) => void | Promise<void>;
}

/**
 * Nswag 설정 인터페이스
 */
export interface NswagConfig {
  /**
   * 테스트 프레임워크
   * @default 'jest'
   */
  testFramework?: TestFramework;

  /**
   * 테스트 파일 검색 패턴
   * glob 패턴 배열
   * @default ['spec/requests/**\/*_spec.ts']
   */
  testPatterns?: string[];

  /**
   * 테스트 타임아웃 (밀리초)
   * @default 30000
   */
  testTimeout?: number;

  /**
   * Dry-run 모드
   * true면 실제 스펙 파일을 생성하지 않음
   * @default true
   */
  dryRun?: boolean;

  /**
   * 플러그인 배열
   */
  plugins?: NswagPlugin[];

  /**
   * 출력 디렉토리
   * @default './openapi'
   */
  outputDir?: string;

  /**
   * 출력 포맷
   * @default 'json'
   */
  outputFormat?: 'json' | 'yaml';

  /**
   * 스펙 파일명 (확장자 제외)
   * @default 'openapi'
   */
  outputFileName?: string;

  /**
   * OpenAPI 정보
   */
  openapi?: {
    title?: string;
    version?: string;
    description?: string;
  };

  /**
   * 감시 모드 설정
   */
  watch?: {
    /** 감시할 파일 패턴 */
    patterns?: string[];
    /** 무시할 파일 패턴 */
    ignore?: string[];
  };
}

/**
 * 해석된 (resolved) 설정 인터페이스
 * 모든 필수 값이 기본값으로 채워진 상태
 */
export interface ResolvedNswagConfig {
  testFramework: TestFramework;
  testPatterns: string[];
  testTimeout: number;
  dryRun: boolean;
  plugins: NswagPlugin[];
  outputDir: string;
  outputFormat: 'json' | 'yaml';
  outputFileName: string;
  openapi: {
    title: string;
    version: string;
    description: string;
  };
  watch: {
    patterns: string[];
    ignore: string[];
  };
}

/**
 * CLI 환경 변수 설정
 */
export interface EnvironmentConfig {
  /** 테스트 파일 패턴 (PATTERN) */
  pattern?: string;
  /** dry-run 모드 (NSWAG_DRY_RUN) */
  dryRun?: boolean;
  /** 추가 테스트 옵션 (ADDITIONAL_TEST_OPTS) */
  additionalTestOpts?: string;
}
