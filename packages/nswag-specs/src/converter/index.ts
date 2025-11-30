/**
 * 스키마 변환기 메인 진입점
 * OpenAPI JSON Schema와 런타임 스키마 검증 라이브러리 간의 양방향 변환
 *
 * 지원 라이브러리:
 * - Zod: 타입 안전한 스키마 검증 라이브러리
 * - Yup: 객체 스키마 검증 라이브러리
 * - TypeBox: JSON Schema 호환 타입 빌더
 *
 * @example
 * ```typescript
 * import { convertSchema, generateSchemaCode } from '@aspect/nswag-specs/converter';
 *
 * // 통합 변환 함수 사용
 * const result = await convertSchema(openApiSchema, 'zod');
 *
 * // 코드 생성
 * const code = generateSchemaCode(openApiSchema, 'zod', { schemaName: 'UserSchema' });
 * ```
 */

// 타입 내보내기
export * from './types.js';

// 유틸리티 내보내기
export {
  WarningCollector,
  resolveRef,
  tryResolveRef,
  processCompositeSchema,
  mergeSchemas,
  FORMAT_VALIDATORS,
  normalizeSchemaName,
  escapeString,
  escapeRegexPattern,
  applyIndent,
  getDefaultOptions,
  isNullable,
  isRequired,
  enumToLiterals,
  getSchemaNameFromRef,
  isPrimitiveType,
  isCompositeType,
  isRefType,
} from './utils.js';

// Zod 변환기 내보내기
export { openApiToZod, zodToOpenApi, generateZodCode } from './zod.js';

// Yup 변환기 내보내기
export { openApiToYup, yupToOpenApi, generateYupCode } from './yup.js';

// TypeBox 변환기 내보내기
export { openApiToTypeBox, typeboxToOpenApi, generateTypeBoxCode } from './typebox.js';

import type { Schema } from '../types/index.js';
import type { ConvertOptions, ConvertResult, TargetLibrary } from './types.js';
import { openApiToZod, generateZodCode } from './zod.js';
import { openApiToYup, generateYupCode } from './yup.js';
import { openApiToTypeBox, generateTypeBoxCode } from './typebox.js';

/**
 * 통합 스키마 변환 함수
 * 대상 라이브러리에 따라 적절한 변환기를 선택하여 스키마를 변환
 *
 * @param schema - OpenAPI 스키마
 * @param target - 대상 라이브러리 ('zod' | 'yup' | 'typebox')
 * @param options - 변환 옵션
 * @returns 변환 결과 (런타임 스키마 및 경고)
 *
 * @example
 * ```typescript
 * // Zod로 변환
 * const zodResult = await convertSchema(openApiSchema, 'zod');
 *
 * // Yup으로 변환
 * const yupResult = await convertSchema(openApiSchema, 'yup');
 *
 * // TypeBox로 변환
 * const typeboxResult = await convertSchema(openApiSchema, 'typebox');
 * ```
 */
export async function convertSchema(
  schema: Schema,
  target: TargetLibrary,
  options: ConvertOptions = {},
): Promise<ConvertResult<unknown>> {
  switch (target) {
    case 'zod':
      return openApiToZod(schema, options);

    case 'yup':
      return openApiToYup(schema, options);

    case 'typebox':
      return openApiToTypeBox(schema, options);

    default:
      throw new Error(`지원하지 않는 대상 라이브러리입니다: ${target}`);
  }
}

/**
 * 통합 코드 생성 함수
 * 대상 라이브러리에 따라 적절한 코드 생성기를 선택하여 TypeScript 코드를 생성
 *
 * @param schema - OpenAPI 스키마
 * @param target - 대상 라이브러리 ('zod' | 'yup' | 'typebox')
 * @param options - 변환 옵션
 * @returns 생성된 TypeScript 코드
 *
 * @example
 * ```typescript
 * // Zod 코드 생성
 * const zodCode = generateSchemaCode(openApiSchema, 'zod', { schemaName: 'UserSchema' });
 *
 * // Yup 코드 생성
 * const yupCode = generateSchemaCode(openApiSchema, 'yup', { schemaName: 'userSchema' });
 *
 * // TypeBox 코드 생성
 * const typeboxCode = generateSchemaCode(openApiSchema, 'typebox', { schemaName: 'UserSchema' });
 * ```
 */
export function generateSchemaCode(
  schema: Schema,
  target: TargetLibrary,
  options: ConvertOptions = {},
): string {
  switch (target) {
    case 'zod':
      return generateZodCode(schema, options);

    case 'yup':
      return generateYupCode(schema, options);

    case 'typebox':
      return generateTypeBoxCode(schema, options);

    default:
      throw new Error(`지원하지 않는 대상 라이브러리입니다: ${target}`);
  }
}

/**
 * 모든 대상 라이브러리에 대해 코드 생성
 * 한 번에 여러 라이브러리용 코드를 생성할 때 유용
 *
 * @param schema - OpenAPI 스키마
 * @param options - 변환 옵션
 * @returns 라이브러리별 생성된 코드
 *
 * @example
 * ```typescript
 * const allCodes = generateAllSchemaCode(openApiSchema, { schemaName: 'UserSchema' });
 * console.log(allCodes.zod);     // Zod 코드
 * console.log(allCodes.yup);     // Yup 코드
 * console.log(allCodes.typebox); // TypeBox 코드
 * ```
 */
export function generateAllSchemaCode(
  schema: Schema,
  options: ConvertOptions = {},
): Record<TargetLibrary, string> {
  return {
    zod: generateZodCode(schema, options),
    yup: generateYupCode(schema, options),
    typebox: generateTypeBoxCode(schema, options),
  };
}

/**
 * 지원되는 대상 라이브러리 목록
 */
export const SUPPORTED_TARGETS: readonly TargetLibrary[] = ['zod', 'yup', 'typebox'] as const;

/**
 * 대상 라이브러리가 유효한지 확인
 *
 * @param target - 확인할 대상
 * @returns 유효 여부
 */
export function isValidTarget(target: unknown): target is TargetLibrary {
  return typeof target === 'string' && SUPPORTED_TARGETS.includes(target as TargetLibrary);
}
