#!/usr/bin/env node

/**
 * nswag CLI 진입점
 * OpenAPI 스펙 생성 및 문서화 도구
 */

import { main } from '../dist/cli/index.js';

main().catch((error) => {
  console.error('오류 발생:', error);
  process.exit(1);
});
