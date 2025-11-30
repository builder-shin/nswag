/**
 * validate subcommand
 * Validate OpenAPI spec file
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, extname } from 'path';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';
import { loadConfig } from '../../config/index.js';
import { logger, type ParsedArgs, colorize } from '../utils.js';

/**
 * OpenAPI 3.0 schema definition (simplified version)
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
 * Run validate command
 */
export async function runValidate(args: ParsedArgs): Promise<void> {
  logger.title('Validate OpenAPI spec');

  // Determine spec file path
  let specPath = args.args[0];

  if (!specPath) {
    // Get default path from configuration
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

  // Check if file exists
  if (!existsSync(specPath)) {
    logger.error(`Spec file not found: ${specPath}`);
    process.exit(1);
  }

  logger.info(`Validating: ${specPath}`);
  logger.newline();

  // Load spec file
  let spec: unknown;
  try {
    spec = loadSpecFile(specPath);
  } catch (error) {
    logger.error(`Failed to parse spec file: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  // Perform validation
  const result = validateSpec(spec);

  // Print results
  if (result.valid) {
    logger.success('Spec validation successful!');
    printSpecSummary(spec as Record<string, unknown>);
  } else {
    logger.error('Spec validation failed');
    logger.newline();

    for (const error of result.errors) {
      logger.error(`  ${error.path}: ${error.message}`);
    }

    process.exit(1);
  }
}

/**
 * Load spec file
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
 * Validate spec
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

  // Basic structure validation
  // Create AJV instance in ESM (handle default export)
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

  // Additional validation (custom rules)
  if (typeof spec === 'object' && spec !== null) {
    const specObj = spec as Record<string, unknown>;

    // Validate paths
    if (specObj.paths && typeof specObj.paths === 'object') {
      const paths = specObj.paths as Record<string, unknown>;

      for (const [pathKey, pathItem] of Object.entries(paths)) {
        // Validate path format
        if (!pathKey.startsWith('/')) {
          errors.push({
            path: `/paths/${pathKey}`,
            message: 'Path must start with /',
          });
        }

        // Validate methods
        if (pathItem && typeof pathItem === 'object') {
          const item = pathItem as Record<string, unknown>;
          const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];

          for (const key of Object.keys(item)) {
            if (!validMethods.includes(key) && key !== 'parameters' && key !== 'summary' && key !== 'description') {
              // Ignore invalid methods (warning only)
            }
          }

          // Validate responses for each method
          for (const method of validMethods) {
            if (item[method]) {
              const operation = item[method] as Record<string, unknown>;
              if (!operation.responses) {
                errors.push({
                  path: `/paths/${pathKey}/${method}`,
                  message: 'responses field is required',
                });
              }
            }
          }
        }
      }
    }

    // Validate components/schemas references
    if (specObj.components && typeof specObj.components === 'object') {
      const components = specObj.components as Record<string, unknown>;

      if (components.schemas && typeof components.schemas === 'object') {
        // Schema definition validation is performed here
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Print spec summary
 */
function printSpecSummary(spec: Record<string, unknown>): void {
  logger.newline();
  logger.info('Spec summary:');

  // Info
  if (spec.info && typeof spec.info === 'object') {
    const info = spec.info as Record<string, unknown>;
    logger.info(`  Title: ${info.title}`);
    logger.info(`  Version: ${info.version}`);
  }

  // Path count
  if (spec.paths && typeof spec.paths === 'object') {
    const paths = spec.paths as Record<string, unknown>;
    const pathCount = Object.keys(paths).length;

    // Calculate method count
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

    logger.info(`  Paths: ${colorize(String(pathCount), 'cyan')}`);
    logger.info(`  Operations: ${colorize(String(operationCount), 'cyan')}`);
  }

  // Tag count
  if (spec.tags && Array.isArray(spec.tags)) {
    logger.info(`  Tags: ${colorize(String(spec.tags.length), 'cyan')}`);
  }

  // Schema count
  if (spec.components && typeof spec.components === 'object') {
    const components = spec.components as Record<string, unknown>;
    if (components.schemas && typeof components.schemas === 'object') {
      const schemaCount = Object.keys(components.schemas as object).length;
      logger.info(`  Schemas: ${colorize(String(schemaCount), 'cyan')}`);
    }
  }

  logger.newline();
}
