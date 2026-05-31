import { formatDSLPath } from './formatDSLPath'

export type DSLPathSegment = string | number

export interface DSLSourceMetadata {
  readonly dslPath: readonly DSLPathSegment[]
  readonly formattedDslPath: string
}

export type DSLSourceMap = WeakMap<object, DSLSourceMetadata>

const DSL_SOURCE_METADATA: unique symbol = Symbol('DSLSourceMetadata')

type DSLSourceMetadataTarget = {
  readonly [DSL_SOURCE_METADATA]?: DSLSourceMetadata
}

export const createDSLSourceMap = (root: unknown): DSLSourceMap => {
  const sourceMap: DSLSourceMap = new WeakMap()

  collectSourceMetadata(root, [], sourceMap, root)

  return sourceMap
}

export const attachDSLSourceMetadata = (target: object, metadata: DSLSourceMetadata): void => {
  Object.defineProperty(target, DSL_SOURCE_METADATA, {
    configurable: true,
    enumerable: false,
    value: metadata,
  })
}

export const getDSLSourceMetadata = (target: unknown): DSLSourceMetadata | undefined => {
  if (!isDSLSourceMetadataTarget(target)) {
    return undefined
  }

  return target[DSL_SOURCE_METADATA]
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

const isDSLSourceMetadataTarget = (value: unknown): value is DSLSourceMetadataTarget => {
  return isObjectValue(value)
}

const isObjectValue = (value: unknown): value is object => {
  return value !== null && value !== undefined && typeof value === 'object'
}
