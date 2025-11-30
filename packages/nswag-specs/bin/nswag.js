#!/usr/bin/env node

/**
 * nswag CLI entry point
 * OpenAPI spec generation and documentation tool
 */

import { main } from '../dist/cli/index.js';

main().catch((error) => {
  console.error('Error occurred:', error);
  process.exit(1);
});
