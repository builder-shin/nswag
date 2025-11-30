/**
 * Deep Merge Utility
 * Phase 5: Schema and security feature support
 */

type DeepMergeValue = Record<string, unknown> | unknown[] | unknown;

/**
 * Array merge strategy
 */
export type ArrayMergeStrategy = 'replace' | 'concat' | 'unique';

/**
 * Deep merge options
 */
export interface DeepMergeOptions {
  /** Array merge strategy (default: 'replace') */
  arrayMerge?: ArrayMergeStrategy;
  /** Custom merge function */
  customMerge?: (key: string, target: unknown, source: unknown) => unknown | undefined;
}

/**
 * Deep merge two objects
 *
 * @param target - Target object
 * @param source - Source object
 * @param options - Merge options
 * @returns Merged object
 *
 * @example
 * // Basic merge
 * deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 } })
 * // => { a: 1, b: { c: 2, d: 3 } }
 *
 * @example
 * // Array concat merge
 * deepMerge({ arr: [1, 2] }, { arr: [3, 4] }, { arrayMerge: 'concat' })
 * // => { arr: [1, 2, 3, 4] }
 *
 * @example
 * // Array unique merge
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

    // Apply custom merge function first
    if (customMerge) {
      const customResult = customMerge(key, targetValue, sourceValue);
      if (customResult !== undefined) {
        result[key] = customResult;
        continue;
      }
    }

    // Array merge
    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      result[key] = mergeArrays(targetValue, sourceValue, arrayMerge);
    }
    // Object merge
    else if (isObject(targetValue) && isObject(sourceValue)) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
        options
      );
    }
    // Value replacement
    else if (sourceValue !== undefined) {
      result[key] = sourceValue;
    }
  }

  return result as T;
}

/**
 * Array merge function
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
 * Check if value is object (excluding arrays)
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep merge multiple objects
 *
 * @param objects - Objects to merge
 * @param options - Merge options
 * @returns Merged object
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
