/**
 * init subcommand
 * Create initial configuration and example files
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { logger, type ParsedArgs } from '../utils.js';

/**
 * nswag.config.ts template
 */
const CONFIG_TEMPLATE = `import { defineConfig } from '@builder-shin/nswag-specs';

export default defineConfig({
  // Test framework configuration ('jest' | 'vitest' | 'mocha')
  testFramework: 'jest',

  // Test file search patterns
  testPatterns: [
    'spec/requests/**/*_spec.ts',
    'spec/api/**/*_spec.ts',
    'spec/integration/**/*_spec.ts',
  ],

  // Test timeout (milliseconds)
  testTimeout: 30000,

  // Dry-run mode (if true, actual files won't be generated)
  dryRun: true,

  // Output settings
  outputDir: './openapi',
  outputFormat: 'json', // 'json' | 'yaml'
  outputFileName: 'openapi',

  // OpenAPI info
  openapi: {
    title: 'API Documentation',
    version: '1.0.0',
    description: 'OpenAPI specification document',
  },

  // Plugins
  plugins: [],
});
`;

/**
 * openapi_helper.ts template
 */
const OPENAPI_HELPER_TEMPLATE = `import { configure } from '@builder-shin/nswag-specs';

// Import app instance (modify according to your project)
// import { app } from '../src/app';

/**
 * Configuration for OpenAPI spec testing
 */
configure({
  // App instance (Express, Fastify, Koa, etc.)
  // app: app,

  // Or use baseUrl (for testing external server)
  // baseUrl: 'http://localhost:3000',

  // Default request settings
  requestDefaults: {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: 5000,
  },
});
`;

/**
 * Example spec file template
 */
const EXAMPLE_SPEC_TEMPLATE = `import {
  path,
  get,
  post,
  parameter,
  requestBody,
  response,
  runTest,
  requestParams,
} from '@builder-shin/nswag-specs';
import '../openapi_helper';

// Define path /api/v1/blogs
path('/api/v1/blogs', () => {
  // GET /api/v1/blogs - List blogs
  get('List blogs', {
    operationId: 'listBlogs',
    tags: ['Blogs'],
  }, () => {
    // Define query parameters
    parameter({ name: 'page', in: 'query', schema: { type: 'integer' } });
    parameter({ name: 'limit', in: 'query', schema: { type: 'integer' } });

    // 200 success response
    response(200, 'Blog list', () => {
      requestParams({ page: 1, limit: 10 });

      runTest(async (response, request) => {
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });
  });

  // POST /api/v1/blogs - Create blog
  post('Create blog', {
    operationId: 'createBlog',
    tags: ['Blogs'],
  }, () => {
    // Define request body
    requestBody('application/json', {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['title', 'content'],
    });

    // 201 creation success response
    response(201, 'Blog created successfully', () => {
      runTest(async (response, request) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
      });
    });

    // 400 bad request response
    response(400, 'Bad request', () => {
      runTest(async (response, request) => {
        expect(response.status).toBe(400);
      });
    });
  });
});

// Define path /api/v1/blogs/{id}
path('/api/v1/blogs/{id}', () => {
  // Define path parameter
  parameter({ name: 'id', in: 'path', required: true, schema: { type: 'integer' } });

  // GET /api/v1/blogs/{id} - Get single blog
  get('Get blog details', {
    operationId: 'getBlog',
    tags: ['Blogs'],
  }, () => {
    response(200, 'Blog details', () => {
      requestParams({ id: 1 });

      runTest(async (response, request) => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('title');
      });
    });

    response(404, 'Blog not found', () => {
      requestParams({ id: 99999 });

      runTest(async (response, request) => {
        expect(response.status).toBe(404);
      });
    });
  });
});
`;

/**
 * Run init command
 */
export async function runInit(args: ParsedArgs): Promise<void> {
  const cwd = process.cwd();
  const force = args.flags.force === true || args.flags.f === true;

  logger.title('Initialize nswag project');

  // 1. Create nswag.config.ts
  const configPath = resolve(cwd, 'nswag.config.ts');
  await createFile(configPath, CONFIG_TEMPLATE, 'nswag.config.ts', force);

  // 2. Create spec directory
  const specDir = resolve(cwd, 'spec');
  if (!existsSync(specDir)) {
    mkdirSync(specDir, { recursive: true });
    logger.success('spec directory created');
  }

  // 3. Create spec/openapi_helper.ts
  const helperPath = resolve(specDir, 'openapi_helper.ts');
  await createFile(helperPath, OPENAPI_HELPER_TEMPLATE, 'spec/openapi_helper.ts', force);

  // 4. Create spec/requests directory
  const requestsDir = resolve(specDir, 'requests');
  if (!existsSync(requestsDir)) {
    mkdirSync(requestsDir, { recursive: true });
    logger.success('spec/requests directory created');
  }

  // 5. Create example spec file
  const examplePath = resolve(requestsDir, 'blogs_spec.ts');
  await createFile(examplePath, EXAMPLE_SPEC_TEMPLATE, 'spec/requests/blogs_spec.ts', force);

  // 6. Create openapi output directory
  const openapiDir = resolve(cwd, 'openapi', 'v1');
  if (!existsSync(openapiDir)) {
    mkdirSync(openapiDir, { recursive: true });
    logger.success('openapi/v1 directory created');
  }

  logger.newline();
  logger.success('Initialization completed!');
  logger.newline();
  logger.info('Next steps:');
  logger.info('  1. Configure app instance in spec/openapi_helper.ts');
  logger.info('  2. Write spec tests in spec/requests/ directory');
  logger.info('  3. Run npx nswag generate');
  logger.newline();
}

/**
 * File creation helper
 */
async function createFile(
  filePath: string,
  content: string,
  displayName: string,
  force: boolean
): Promise<void> {
  if (existsSync(filePath) && !force) {
    logger.warn(`${displayName} already exists (use --force to overwrite)`);
    return;
  }

  writeFileSync(filePath, content, 'utf-8');
  logger.success(`${displayName} created`);
}
