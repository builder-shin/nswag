/**
 * CLI main entry point
 */

import { parseArgs, printHelp, printVersion, handleError, logger } from './utils.js';
import { runInit } from './commands/init.js';
import { runGenerate } from './commands/generate.js';
import { runValidate } from './commands/validate.js';
import { runDiff } from './commands/diff.js';
import { runUiCustom, runUiCopyAssets } from './commands/ui.js';
import { runMockStart } from './commands/mock.js';

/**
 * CLI main function
 */
export async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  // Check help flag
  if (args.flags.help || args.flags.h) {
    printHelp();
    return;
  }

  // Check version flag
  if (args.flags.version || args.flags.v) {
    await printVersion();
    return;
  }

  try {
    // Command routing
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
        // Handle namespaced command
        switch (args.subCommand) {
          case 'custom':
            await runUiCustom(args);
            break;
          case 'copy-assets':
            await runUiCopyAssets(args);
            break;
          default:
            logger.error(`Unknown ui subcommand: ${args.subCommand}`);
            logger.info('Available commands: ui:custom, ui:copy-assets');
            process.exit(1);
        }
        break;

      case 'mock':
        // Handle namespaced command
        switch (args.subCommand) {
          case 'start':
            await runMockStart(args);
            break;
          default:
            logger.error(`Unknown mock subcommand: ${args.subCommand}`);
            logger.info('Available commands: mock:start');
            process.exit(1);
        }
        break;

      default:
        // Default command is generate
        if (!args.command || args.command === 'nswag') {
          args.command = 'generate';
          await runGenerate(args);
        } else {
          logger.error(`Unknown command: ${args.command}`);
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
