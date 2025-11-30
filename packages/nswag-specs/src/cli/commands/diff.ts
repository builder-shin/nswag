/**
 * diff subcommand
 * OpenAPI spec comparison and breaking change detection
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import { loadConfig } from '../../config/index.js';
import { logger, type ParsedArgs, colorize } from '../utils.js';

/**
 * Change type
 */
type ChangeType = 'breaking' | 'non-breaking' | 'info';

/**
 * Change item interface
 */
interface Change {
  type: ChangeType;
  path: string;
  message: string;
  details?: string;
}

/**
 * Execute diff command
 */
export async function runDiff(args: ParsedArgs): Promise<void> {
  logger.title('OpenAPI Spec Comparison');

  const basePath = args.flags.base as string;
  const headPath = args.flags.head as string;

  if (!basePath) {
    logger.error('--base option is required');
    logger.info('Usage: npx nswag diff --base ./openapi/v1/openapi.json');
    process.exit(1);
  }

  // Load base file
  const baseSpec = loadSpecFile(resolve(process.cwd(), basePath));

  // Determine head file (use default config path if not specified)
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
      logger.error(`Comparison target file not found: ${defaultHeadPath}`);
      logger.info('Specify comparison file with --head option');
      process.exit(1);
    }

    headSpec = loadSpecFile(defaultHeadPath);
    logger.info(`Comparing: ${basePath} ↔ ${config.outputDir}/${config.outputFileName}.${config.outputFormat}`);
  }

  logger.newline();

  // Perform comparison
  const changes = compareSpecs(baseSpec, headSpec);

  // Print results
  printChanges(changes);

  // Exit with code 1 if there are breaking changes
  const hasBreakingChanges = changes.some((c) => c.type === 'breaking');
  if (hasBreakingChanges) {
    logger.newline();
    logger.error('Breaking changes detected!');
    process.exit(1);
  }
}

/**
 * Load spec file
 */
function loadSpecFile(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) {
    logger.error(`File not found: ${filePath}`);
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
 * Compare specs
 */
function compareSpecs(base: Record<string, unknown>, head: Record<string, unknown>): Change[] {
  const changes: Change[] = [];

  // Compare info
  compareInfo(base.info as Record<string, unknown>, head.info as Record<string, unknown>, changes);

  // Compare paths
  comparePaths(base.paths as Record<string, unknown>, head.paths as Record<string, unknown>, changes);

  // Compare components
  compareComponents(
    base.components as Record<string, unknown>,
    head.components as Record<string, unknown>,
    changes
  );

  return changes;
}

/**
 * Compare info section
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
      message: 'Title changed',
      details: `"${base.title}" → "${head.title}"`,
    });
  }

  if (base.version !== head.version) {
    changes.push({
      type: 'info',
      path: '/info/version',
      message: 'Version changed',
      details: `"${base.version}" → "${head.version}"`,
    });
  }
}

/**
 * Compare paths section
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

  // Removed paths (Breaking)
  for (const path of basePaths) {
    if (!headPaths.has(path)) {
      changes.push({
        type: 'breaking',
        path: `/paths${path}`,
        message: 'Path removed',
      });
    }
  }

  // Added paths (Non-breaking)
  for (const path of headPaths) {
    if (!basePaths.has(path)) {
      changes.push({
        type: 'non-breaking',
        path: `/paths${path}`,
        message: 'Path added',
      });
    }
  }

  // Compare common paths
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
 * Compare single path item
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
      // Method removed (Breaking)
      changes.push({
        type: 'breaking',
        path: `/paths${path}/${method}`,
        message: `${method.toUpperCase()} method removed`,
      });
    } else if (!baseOp && headOp) {
      // Method added (Non-breaking)
      changes.push({
        type: 'non-breaking',
        path: `/paths${path}/${method}`,
        message: `${method.toUpperCase()} method added`,
      });
    } else if (baseOp && headOp) {
      // Compare method
      compareOperation(path, method, baseOp, headOp, changes);
    }
  }
}

/**
 * Compare operation
 */
function compareOperation(
  path: string,
  method: string,
  base: Record<string, unknown>,
  head: Record<string, unknown>,
  changes: Change[]
): void {
  const basePath = `/paths${path}/${method}`;

  // Compare parameters
  const baseParams = (base.parameters || []) as Array<Record<string, unknown>>;
  const headParams = (head.parameters || []) as Array<Record<string, unknown>>;

  // Check for required parameter additions (Breaking)
  for (const headParam of headParams) {
    const matchingBase = baseParams.find(
      (bp) => bp.name === headParam.name && bp.in === headParam.in
    );

    if (!matchingBase && headParam.required) {
      changes.push({
        type: 'breaking',
        path: `${basePath}/parameters`,
        message: `Required parameter added: ${headParam.name} (${headParam.in})`,
      });
    }
  }

  // Check for parameter removals (Breaking - if required parameter removed)
  for (const baseParam of baseParams) {
    const matchingHead = headParams.find(
      (hp) => hp.name === baseParam.name && hp.in === baseParam.in
    );

    if (!matchingHead) {
      changes.push({
        type: baseParam.required ? 'breaking' : 'non-breaking',
        path: `${basePath}/parameters`,
        message: `Parameter removed: ${baseParam.name} (${baseParam.in})`,
      });
    }
  }

  // Compare requestBody
  const baseBody = base.requestBody as Record<string, unknown> | undefined;
  const headBody = head.requestBody as Record<string, unknown> | undefined;

  if (!baseBody && headBody && headBody.required) {
    changes.push({
      type: 'breaking',
      path: `${basePath}/requestBody`,
      message: 'Required request body added',
    });
  } else if (baseBody && !headBody) {
    changes.push({
      type: 'non-breaking',
      path: `${basePath}/requestBody`,
      message: 'Request body removed',
    });
  }

  // Compare responses
  const baseResponses = (base.responses || {}) as Record<string, unknown>;
  const headResponses = (head.responses || {}) as Record<string, unknown>;

  // Check for response code removals
  for (const code of Object.keys(baseResponses)) {
    if (!(code in headResponses)) {
      changes.push({
        type: 'info',
        path: `${basePath}/responses/${code}`,
        message: `Response code removed: ${code}`,
      });
    }
  }

  // Check for response code additions
  for (const code of Object.keys(headResponses)) {
    if (!(code in baseResponses)) {
      changes.push({
        type: 'non-breaking',
        path: `${basePath}/responses/${code}`,
        message: `Response code added: ${code}`,
      });
    }
  }
}

/**
 * Compare components section
 */
function compareComponents(
  base: Record<string, unknown> | undefined,
  head: Record<string, unknown> | undefined,
  changes: Change[]
): void {
  if (!base && !head) return;
  if (!base) base = {};
  if (!head) head = {};

  // Compare schemas
  const baseSchemas = (base.schemas || {}) as Record<string, unknown>;
  const headSchemas = (head.schemas || {}) as Record<string, unknown>;

  // Removed schemas (Breaking - if in use)
  for (const name of Object.keys(baseSchemas)) {
    if (!(name in headSchemas)) {
      changes.push({
        type: 'breaking',
        path: `/components/schemas/${name}`,
        message: `Schema removed: ${name}`,
      });
    }
  }

  // Added schemas (Non-breaking)
  for (const name of Object.keys(headSchemas)) {
    if (!(name in baseSchemas)) {
      changes.push({
        type: 'non-breaking',
        path: `/components/schemas/${name}`,
        message: `Schema added: ${name}`,
      });
    }
  }
}

/**
 * Print changes
 */
function printChanges(changes: Change[]): void {
  const breakingChanges = changes.filter((c) => c.type === 'breaking');
  const nonBreakingChanges = changes.filter((c) => c.type === 'non-breaking');
  const infoChanges = changes.filter((c) => c.type === 'info');

  if (changes.length === 0) {
    logger.success('No changes');
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
    logger.info(colorize(`Info Changes (${infoChanges.length}):`, 'blue'));
    for (const change of infoChanges) {
      console.log(`  ${colorize('ℹ', 'blue')} ${change.path}`);
      console.log(`    ${change.message}`);
      if (change.details) {
        console.log(`    ${colorize(change.details, 'dim')}`);
      }
    }
    logger.newline();
  }

  // Summary
  logger.info('Summary:');
  logger.info(`  Breaking: ${colorize(String(breakingChanges.length), 'red')}`);
  logger.info(`  Non-breaking: ${colorize(String(nonBreakingChanges.length), 'green')}`);
  logger.info(`  Info: ${colorize(String(infoChanges.length), 'blue')}`);
}
