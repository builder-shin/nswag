/**
 * diff 서브커맨드
 * OpenAPI 스펙 비교 및 Breaking Change 감지
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import { loadConfig } from '../../config/index.js';
import { logger, type ParsedArgs, colorize } from '../utils.js';

/**
 * 변경 유형
 */
type ChangeType = 'breaking' | 'non-breaking' | 'info';

/**
 * 변경 항목 인터페이스
 */
interface Change {
  type: ChangeType;
  path: string;
  message: string;
  details?: string;
}

/**
 * diff 커맨드 실행
 */
export async function runDiff(args: ParsedArgs): Promise<void> {
  logger.title('OpenAPI 스펙 비교');

  const basePath = args.flags.base as string;
  const headPath = args.flags.head as string;

  if (!basePath) {
    logger.error('--base 옵션이 필요합니다');
    logger.info('사용법: npx nswag diff --base ./openapi/v1/openapi.json');
    process.exit(1);
  }

  // base 파일 로드
  const baseSpec = loadSpecFile(resolve(process.cwd(), basePath));

  // head 파일 결정 (지정되지 않으면 현재 설정의 기본 경로)
  let headSpec: Record<string, unknown>;

  if (headPath) {
    headSpec = loadSpecFile(resolve(process.cwd(), headPath));
  } else {
    const configPath = args.flags.config as string | undefined || args.flags.c as string | undefined;
    const config = await loadConfig(configPath);
    const defaultHeadPath = resolve(
      process.cwd(),
      config.outputDir,
      `${config.outputFileName}.${config.outputFormat}`
    );

    if (!existsSync(defaultHeadPath)) {
      logger.error(`비교 대상 파일을 찾을 수 없습니다: ${defaultHeadPath}`);
      logger.info('--head 옵션으로 비교할 파일을 지정하세요');
      process.exit(1);
    }

    headSpec = loadSpecFile(defaultHeadPath);
    logger.info(`비교: ${basePath} ↔ ${config.outputDir}/${config.outputFileName}.${config.outputFormat}`);
  }

  logger.newline();

  // 비교 수행
  const changes = compareSpecs(baseSpec, headSpec);

  // 결과 출력
  printChanges(changes);

  // Breaking Change가 있으면 종료 코드 1
  const hasBreakingChanges = changes.some((c) => c.type === 'breaking');
  if (hasBreakingChanges) {
    logger.newline();
    logger.error('Breaking Change가 발견되었습니다!');
    process.exit(1);
  }
}

/**
 * 스펙 파일 로드
 */
function loadSpecFile(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) {
    logger.error(`파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }

  const content = readFileSync(filePath, 'utf-8');
  const ext = extname(filePath).toLowerCase();

  if (ext === '.yaml' || ext === '.yml') {
    return parseYaml(content) as Record<string, unknown>;
  }

  return JSON.parse(content);
}

/**
 * 스펙 비교
 */
function compareSpecs(base: Record<string, unknown>, head: Record<string, unknown>): Change[] {
  const changes: Change[] = [];

  // info 비교
  compareInfo(base.info as Record<string, unknown>, head.info as Record<string, unknown>, changes);

  // paths 비교
  comparePaths(base.paths as Record<string, unknown>, head.paths as Record<string, unknown>, changes);

  // components 비교
  compareComponents(
    base.components as Record<string, unknown>,
    head.components as Record<string, unknown>,
    changes
  );

  return changes;
}

/**
 * info 섹션 비교
 */
function compareInfo(
  base: Record<string, unknown> | undefined,
  head: Record<string, unknown> | undefined,
  changes: Change[]
): void {
  if (!base || !head) return;

  if (base.title !== head.title) {
    changes.push({
      type: 'info',
      path: '/info/title',
      message: '제목 변경됨',
      details: `"${base.title}" → "${head.title}"`,
    });
  }

  if (base.version !== head.version) {
    changes.push({
      type: 'info',
      path: '/info/version',
      message: '버전 변경됨',
      details: `"${base.version}" → "${head.version}"`,
    });
  }
}

/**
 * paths 섹션 비교
 */
function comparePaths(
  base: Record<string, unknown> | undefined,
  head: Record<string, unknown> | undefined,
  changes: Change[]
): void {
  if (!base) base = {};
  if (!head) head = {};

  const basePaths = new Set(Object.keys(base));
  const headPaths = new Set(Object.keys(head));

  // 삭제된 경로 (Breaking)
  for (const path of basePaths) {
    if (!headPaths.has(path)) {
      changes.push({
        type: 'breaking',
        path: `/paths${path}`,
        message: '경로 삭제됨',
      });
    }
  }

  // 추가된 경로 (Non-breaking)
  for (const path of headPaths) {
    if (!basePaths.has(path)) {
      changes.push({
        type: 'non-breaking',
        path: `/paths${path}`,
        message: '경로 추가됨',
      });
    }
  }

  // 공통 경로 비교
  for (const path of basePaths) {
    if (headPaths.has(path)) {
      comparePathItem(
        path,
        base[path] as Record<string, unknown>,
        head[path] as Record<string, unknown>,
        changes
      );
    }
  }
}

/**
 * 단일 경로 항목 비교
 */
function comparePathItem(
  path: string,
  base: Record<string, unknown>,
  head: Record<string, unknown>,
  changes: Change[]
): void {
  const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];

  for (const method of methods) {
    const baseOp = base[method] as Record<string, unknown> | undefined;
    const headOp = head[method] as Record<string, unknown> | undefined;

    if (baseOp && !headOp) {
      // 메서드 삭제됨 (Breaking)
      changes.push({
        type: 'breaking',
        path: `/paths${path}/${method}`,
        message: `${method.toUpperCase()} 메서드 삭제됨`,
      });
    } else if (!baseOp && headOp) {
      // 메서드 추가됨 (Non-breaking)
      changes.push({
        type: 'non-breaking',
        path: `/paths${path}/${method}`,
        message: `${method.toUpperCase()} 메서드 추가됨`,
      });
    } else if (baseOp && headOp) {
      // 메서드 비교
      compareOperation(path, method, baseOp, headOp, changes);
    }
  }
}

/**
 * 작업(Operation) 비교
 */
function compareOperation(
  path: string,
  method: string,
  base: Record<string, unknown>,
  head: Record<string, unknown>,
  changes: Change[]
): void {
  const basePath = `/paths${path}/${method}`;

  // 파라미터 비교
  const baseParams = (base.parameters || []) as Array<Record<string, unknown>>;
  const headParams = (head.parameters || []) as Array<Record<string, unknown>>;

  // 필수 파라미터 추가 체크 (Breaking)
  for (const headParam of headParams) {
    const matchingBase = baseParams.find(
      (bp) => bp.name === headParam.name && bp.in === headParam.in
    );

    if (!matchingBase && headParam.required) {
      changes.push({
        type: 'breaking',
        path: `${basePath}/parameters`,
        message: `필수 파라미터 추가됨: ${headParam.name} (${headParam.in})`,
      });
    }
  }

  // 파라미터 삭제 체크 (Breaking - 필수가 삭제된 경우)
  for (const baseParam of baseParams) {
    const matchingHead = headParams.find(
      (hp) => hp.name === baseParam.name && hp.in === baseParam.in
    );

    if (!matchingHead) {
      changes.push({
        type: baseParam.required ? 'breaking' : 'non-breaking',
        path: `${basePath}/parameters`,
        message: `파라미터 삭제됨: ${baseParam.name} (${baseParam.in})`,
      });
    }
  }

  // requestBody 비교
  const baseBody = base.requestBody as Record<string, unknown> | undefined;
  const headBody = head.requestBody as Record<string, unknown> | undefined;

  if (!baseBody && headBody && headBody.required) {
    changes.push({
      type: 'breaking',
      path: `${basePath}/requestBody`,
      message: '필수 요청 본문 추가됨',
    });
  } else if (baseBody && !headBody) {
    changes.push({
      type: 'non-breaking',
      path: `${basePath}/requestBody`,
      message: '요청 본문 제거됨',
    });
  }

  // responses 비교
  const baseResponses = (base.responses || {}) as Record<string, unknown>;
  const headResponses = (head.responses || {}) as Record<string, unknown>;

  // 응답 코드 삭제 체크
  for (const code of Object.keys(baseResponses)) {
    if (!(code in headResponses)) {
      changes.push({
        type: 'info',
        path: `${basePath}/responses/${code}`,
        message: `응답 코드 삭제됨: ${code}`,
      });
    }
  }

  // 응답 코드 추가 체크
  for (const code of Object.keys(headResponses)) {
    if (!(code in baseResponses)) {
      changes.push({
        type: 'non-breaking',
        path: `${basePath}/responses/${code}`,
        message: `응답 코드 추가됨: ${code}`,
      });
    }
  }
}

/**
 * components 섹션 비교
 */
function compareComponents(
  base: Record<string, unknown> | undefined,
  head: Record<string, unknown> | undefined,
  changes: Change[]
): void {
  if (!base && !head) return;
  if (!base) base = {};
  if (!head) head = {};

  // schemas 비교
  const baseSchemas = (base.schemas || {}) as Record<string, unknown>;
  const headSchemas = (head.schemas || {}) as Record<string, unknown>;

  // 삭제된 스키마 (Breaking - 사용 중인 경우)
  for (const name of Object.keys(baseSchemas)) {
    if (!(name in headSchemas)) {
      changes.push({
        type: 'breaking',
        path: `/components/schemas/${name}`,
        message: `스키마 삭제됨: ${name}`,
      });
    }
  }

  // 추가된 스키마 (Non-breaking)
  for (const name of Object.keys(headSchemas)) {
    if (!(name in baseSchemas)) {
      changes.push({
        type: 'non-breaking',
        path: `/components/schemas/${name}`,
        message: `스키마 추가됨: ${name}`,
      });
    }
  }
}

/**
 * 변경 사항 출력
 */
function printChanges(changes: Change[]): void {
  const breakingChanges = changes.filter((c) => c.type === 'breaking');
  const nonBreakingChanges = changes.filter((c) => c.type === 'non-breaking');
  const infoChanges = changes.filter((c) => c.type === 'info');

  if (changes.length === 0) {
    logger.success('변경 사항 없음');
    return;
  }

  // Breaking Changes
  if (breakingChanges.length > 0) {
    logger.info(colorize(`Breaking Changes (${breakingChanges.length}):`, 'red'));
    for (const change of breakingChanges) {
      console.log(`  ${colorize('✗', 'red')} ${change.path}`);
      console.log(`    ${change.message}`);
      if (change.details) {
        console.log(`    ${colorize(change.details, 'dim')}`);
      }
    }
    logger.newline();
  }

  // Non-breaking Changes
  if (nonBreakingChanges.length > 0) {
    logger.info(colorize(`Non-breaking Changes (${nonBreakingChanges.length}):`, 'green'));
    for (const change of nonBreakingChanges) {
      console.log(`  ${colorize('+', 'green')} ${change.path}`);
      console.log(`    ${change.message}`);
      if (change.details) {
        console.log(`    ${colorize(change.details, 'dim')}`);
      }
    }
    logger.newline();
  }

  // Info Changes
  if (infoChanges.length > 0) {
    logger.info(colorize(`정보 변경 (${infoChanges.length}):`, 'blue'));
    for (const change of infoChanges) {
      console.log(`  ${colorize('ℹ', 'blue')} ${change.path}`);
      console.log(`    ${change.message}`);
      if (change.details) {
        console.log(`    ${colorize(change.details, 'dim')}`);
      }
    }
    logger.newline();
  }

  // 요약
  logger.info('요약:');
  logger.info(`  Breaking: ${colorize(String(breakingChanges.length), 'red')}`);
  logger.info(`  Non-breaking: ${colorize(String(nonBreakingChanges.length), 'green')}`);
  logger.info(`  Info: ${colorize(String(infoChanges.length), 'blue')}`);
}
