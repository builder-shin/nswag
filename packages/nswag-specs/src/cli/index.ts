/**
 * CLI 메인 진입점
 */

import { parseArgs, printHelp, printVersion, handleError, logger } from './utils.js';
import { runInit } from './commands/init.js';
import { runGenerate } from './commands/generate.js';
import { runValidate } from './commands/validate.js';
import { runDiff } from './commands/diff.js';
import { runUiCustom, runUiCopyAssets } from './commands/ui.js';
import { runMockStart } from './commands/mock.js';

/**
 * CLI 메인 함수
 */
export async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // 도움말 플래그 체크
  if (args.flags.help || args.flags.h) {
    printHelp();
    return;
  }

  // 버전 플래그 체크
  if (args.flags.version || args.flags.v) {
    await printVersion();
    return;
  }

  try {
    // 명령어 라우팅
    switch (args.command) {
      case 'init':
        await runInit(args);
        break;

      case 'generate':
        await runGenerate(args);
        break;

      case 'validate':
        await runValidate(args);
        break;

      case 'diff':
        await runDiff(args);
        break;

      case 'ui':
        // 네임스페이스 명령어 처리
        switch (args.subCommand) {
          case 'custom':
            await runUiCustom(args);
            break;
          case 'copy-assets':
            await runUiCopyAssets(args);
            break;
          default:
            logger.error(`알 수 없는 ui 서브커맨드: ${args.subCommand}`);
            logger.info('사용 가능한 명령어: ui:custom, ui:copy-assets');
            process.exit(1);
        }
        break;

      case 'mock':
        // 네임스페이스 명령어 처리
        switch (args.subCommand) {
          case 'start':
            await runMockStart(args);
            break;
          default:
            logger.error(`알 수 없는 mock 서브커맨드: ${args.subCommand}`);
            logger.info('사용 가능한 명령어: mock:start');
            process.exit(1);
        }
        break;

      default:
        // 기본 명령어는 generate
        if (!args.command || args.command === 'nswag') {
          args.command = 'generate';
          await runGenerate(args);
        } else {
          logger.error(`알 수 없는 명령어: ${args.command}`);
          printHelp();
          process.exit(1);
        }
    }
  } catch (error) {
    handleError(error);
  }
}

// CLI export
export { parseArgs, printHelp, printVersion, logger } from './utils.js';
export { runInit } from './commands/init.js';
export { runGenerate } from './commands/generate.js';
export { runValidate } from './commands/validate.js';
export { runDiff } from './commands/diff.js';
export { runUiCustom, runUiCopyAssets } from './commands/ui.js';
export { runMockStart } from './commands/mock.js';
