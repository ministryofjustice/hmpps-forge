import { formatDSLPath } from '../validation/formatDSLPath'

export type DSLPathSegment = string | number

export interface DSLSourceMetadata {
  readonly dslPath: readonly DSLPathSegment[]
  readonly formattedDslPath: string
}

export type DSLSourceMap = WeakMap<object, DSLSourceMetadata>

export const createDSLSourceMap = (root: unknown): DSLSourceMap => {
  const sourceMap: DSLSourceMap = new WeakMap()

  collectSourceMetadata(root, [], sourceMap, root)

  return sourceMap
}

const collectSourceMetadata = (
  value: unknown,
  path: readonly DSLPathSegment[],
  sourceMap: DSLSourceMap,
  root: unknown,
): void => {
  if (!isObjectValue(value)) {
    return
  }

  sourceMap.set(value, {
    dslPath: path,
    formattedDslPath: formatDSLPath(root, path),
  })

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectSourceMetadata(entry, [...path, index], sourceMap, root)
    })

    return
  }

  Object.entries(value).forEach(([key, entry]) => {
    collectSourceMetadata(entry, [...path, key], sourceMap, root)
  })
}

const isObjectValue = (value: unknown): value is object => {
  return value !== null && value !== undefined && typeof value === 'object'
}
