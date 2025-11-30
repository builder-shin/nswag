/**
 * 깊은 병합 유틸리티
 * Phase 5: 스키마 및 보안 기능 지원
 */

type DeepMergeValue = Record<string, unknown> | unknown[] | unknown;

/**
 * 배열 병합 전략
 */
export type ArrayMergeStrategy = 'replace' | 'concat' | 'unique';

/**
 * 깊은 병합 옵션
 */
export interface DeepMergeOptions {
  /** 배열 병합 전략 (기본: 'replace') */
  arrayMerge?: ArrayMergeStrategy;
  /** 커스텀 병합 함수 */
  customMerge?: (key: string, target: unknown, source: unknown) => unknown | undefined;
}

/**
 * 두 객체를 깊게 병합
 *
 * @param target - 대상 객체
 * @param source - 소스 객체
 * @param options - 병합 옵션
 * @returns 병합된 객체
 *
 * @example
 * // 기본 병합
 * deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 } })
 * // => { a: 1, b: { c: 2, d: 3 } }
 *
 * @example
 * // 배열 concat 병합
 * deepMerge({ arr: [1, 2] }, { arr: [3, 4] }, { arrayMerge: 'concat' })
 * // => { arr: [1, 2, 3, 4] }
 *
 * @example
 * // 배열 unique 병합
 * deepMerge({ arr: [1, 2] }, { arr: [2, 3] }, { arrayMerge: 'unique' })
 * // => { arr: [1, 2, 3] }
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
  options: DeepMergeOptions = {}
): T {
  const { arrayMerge = 'replace', customMerge } = options;
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const targetValue = target[key] as DeepMergeValue;
    const sourceValue = source[key] as DeepMergeValue;

    // 커스텀 병합 함수 우선 적용
    if (customMerge) {
      const customResult = customMerge(key, targetValue, sourceValue);
      if (customResult !== undefined) {
        result[key] = customResult;
        continue;
      }
    }

    // 배열 병합
    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      result[key] = mergeArrays(targetValue, sourceValue, arrayMerge);
    }
    // 객체 병합
    else if (isObject(targetValue) && isObject(sourceValue)) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
        options
      );
    }
    // 값 교체
    else if (sourceValue !== undefined) {
      result[key] = sourceValue;
    }
  }

  return result as T;
}

/**
 * 배열 병합 함수
 */
function mergeArrays(
  target: unknown[],
  source: unknown[],
  strategy: ArrayMergeStrategy
): unknown[] {
  switch (strategy) {
    case 'concat':
      return [...target, ...source];
    case 'unique':
      return [...new Set([...target, ...source])];
    case 'replace':
    default:
      return [...source];
  }
}

/**
 * 객체인지 확인 (배열 제외)
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 여러 객체를 깊게 병합
 *
 * @param objects - 병합할 객체들
 * @param options - 병합 옵션
 * @returns 병합된 객체
 *
 * @example
 * deepMergeAll([{ a: 1 }, { b: 2 }, { c: 3 }])
 * // => { a: 1, b: 2, c: 3 }
 */
export function deepMergeAll<T extends Record<string, unknown>>(
  objects: Partial<T>[],
  options: DeepMergeOptions = {}
): T {
  if (objects.length === 0) {
    return {} as T;
  }

  return objects.reduce(
    (acc, obj) => deepMerge(acc as T, obj, options),
    {} as Partial<T>
  ) as T;
}
