/**
 * validate 서브커맨드
 * OpenAPI 스펙 파일 검증
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';
import { loadConfig } from '../../config/index.js';
import { logger, type ParsedArgs, colorize } from '../utils.js';

/**
 * OpenAPI 3.0 스키마 정의 (간소화 버전)
 */
const OPENAPI_SCHEMA = {
  type: 'object',
  required: ['openapi', 'info', 'paths'],
  properties: {
    openapi: {
      type: 'string',
      pattern: '^3\\.',
    },
    info: {
      type: 'object',
      required: ['title', 'version'],
      properties: {
        title: { type: 'string' },
        version: { type: 'string' },
        description: { type: 'string' },
      },
    },
    paths: {
      type: 'object',
      additionalProperties: {
        type: 'object',
      },
    },
    components: {
      type: 'object',
    },
    servers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['url'],
      },
    },
    tags: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name'],
      },
    },
  },
};

/**
 * validate 커맨드 실행
 */
export async function runValidate(args: ParsedArgs): Promise<void> {
  logger.title('OpenAPI 스펙 검증');

  // 스펙 파일 경로 결정
  let specPath = args.args[0];

  if (!specPath) {
    // 설정에서 기본 경로 가져오기
    const configPath = args.flags.config as string | undefined || args.flags.c as string | undefined;
    const config = await loadConfig(configPath);
    specPath = resolve(
      process.cwd(),
      config.outputDir,
      `${config.outputFileName}.${config.outputFormat}`
    );
  } else {
    specPath = resolve(process.cwd(), specPath);
  }

  // 파일 존재 확인
  if (!existsSync(specPath)) {
    logger.error(`스펙 파일을 찾을 수 없습니다: ${specPath}`);
    process.exit(1);
  }

  logger.info(`검증 대상: ${specPath}`);
  logger.newline();

  // 스펙 파일 로드
  let spec: unknown;
  try {
    spec = loadSpecFile(specPath);
  } catch (error) {
    logger.error(`스펙 파일 파싱 실패: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  // 검증 수행
  const result = validateSpec(spec);

  // 결과 출력
  if (result.valid) {
    logger.success('스펙 검증 성공!');
    printSpecSummary(spec as Record<string, unknown>);
  } else {
    logger.error('스펙 검증 실패');
    logger.newline();

    for (const error of result.errors) {
      logger.error(`  ${error.path}: ${error.message}`);
    }

    process.exit(1);
  }
}

/**
 * 스펙 파일 로드
 */
function loadSpecFile(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf-8');
  const ext = extname(filePath).toLowerCase();

  if (ext === '.yaml' || ext === '.yml') {
    return parseYaml(content);
  }

  return JSON.parse(content);
}

/**
 * 스펙 검증
 */
interface ValidationError {
  path: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

function validateSpec(spec: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // 기본 구조 검증
  // ESM에서 AJV 인스턴스 생성 (default export 처리)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AjvModule = Ajv as any;
  const AjvClass = AjvModule.default ?? AjvModule;
  const ajv = new AjvClass({ allErrors: true });
  const validate = ajv.compile(OPENAPI_SCHEMA);
  const valid = validate(spec);

  if (!valid && validate.errors) {
    for (const error of validate.errors) {
      errors.push({
        path: error.instancePath || '/',
        message: error.message || 'Unknown error',
      });
    }
  }

  // 추가 검증 (커스텀 규칙)
  if (typeof spec === 'object' && spec !== null) {
    const specObj = spec as Record<string, unknown>;

    // paths 검증
    if (specObj.paths && typeof specObj.paths === 'object') {
      const paths = specObj.paths as Record<string, unknown>;

      for (const [pathKey, pathItem] of Object.entries(paths)) {
        // 경로 형식 검증
        if (!pathKey.startsWith('/')) {
          errors.push({
            path: `/paths/${pathKey}`,
            message: '경로는 /로 시작해야 합니다',
          });
        }

        // 메서드 검증
        if (pathItem && typeof pathItem === 'object') {
          const item = pathItem as Record<string, unknown>;
          const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];

          for (const key of Object.keys(item)) {
            if (!validMethods.includes(key) && key !== 'parameters' && key !== 'summary' && key !== 'description') {
              // 유효하지 않은 메서드는 무시 (경고만)
            }
          }

          // 각 메서드의 responses 검증
          for (const method of validMethods) {
            if (item[method]) {
              const operation = item[method] as Record<string, unknown>;
              if (!operation.responses) {
                errors.push({
                  path: `/paths/${pathKey}/${method}`,
                  message: 'responses 필드는 필수입니다',
                });
              }
            }
          }
        }
      }
    }

    // components/schemas 참조 검증
    if (specObj.components && typeof specObj.components === 'object') {
      const components = specObj.components as Record<string, unknown>;

      if (components.schemas && typeof components.schemas === 'object') {
        // 스키마 정의 검증은 여기서 수행
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 스펙 요약 출력
 */
function printSpecSummary(spec: Record<string, unknown>): void {
  logger.newline();
  logger.info('스펙 요약:');

  // 정보
  if (spec.info && typeof spec.info === 'object') {
    const info = spec.info as Record<string, unknown>;
    logger.info(`  제목: ${info.title}`);
    logger.info(`  버전: ${info.version}`);
  }

  // 경로 수
  if (spec.paths && typeof spec.paths === 'object') {
    const paths = spec.paths as Record<string, unknown>;
    const pathCount = Object.keys(paths).length;

    // 메서드 수 계산
    let operationCount = 0;
    const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];

    for (const pathItem of Object.values(paths)) {
      if (pathItem && typeof pathItem === 'object') {
        for (const method of methods) {
          if ((pathItem as Record<string, unknown>)[method]) {
            operationCount++;
          }
        }
      }
    }

    logger.info(`  경로: ${colorize(String(pathCount), 'cyan')}개`);
    logger.info(`  작업: ${colorize(String(operationCount), 'cyan')}개`);
  }

  // 태그 수
  if (spec.tags && Array.isArray(spec.tags)) {
    logger.info(`  태그: ${colorize(String(spec.tags.length), 'cyan')}개`);
  }

  // 스키마 수
  if (spec.components && typeof spec.components === 'object') {
    const components = spec.components as Record<string, unknown>;
    if (components.schemas && typeof components.schemas === 'object') {
      const schemaCount = Object.keys(components.schemas as object).length;
      logger.info(`  스키마: ${colorize(String(schemaCount), 'cyan')}개`);
    }
  }

  logger.newline();
}
