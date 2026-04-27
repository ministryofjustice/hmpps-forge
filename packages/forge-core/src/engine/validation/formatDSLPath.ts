import { BlockType, ExpressionType, FunctionType, IteratorType, StructureType } from '../../authoring/types/enums'

type DSLPathSegment = string | number

type DSLRecord = Record<string, unknown>

const FUNCTION_TYPE_VALUES: ReadonlySet<string> = new Set(Object.values(FunctionType))

interface PathFormatState {
  readonly current: unknown
  readonly index: number
  readonly segments: readonly string[]
}

const isRecord = (value: unknown): value is DSLRecord => {
  return typeof value === 'object' && value !== undefined && value !== null && !Array.isArray(value)
}

const isArrayIndex = (value: unknown): value is number => {
  return typeof value === 'number'
}

const getStringProperty = (value: unknown, property: string): string | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const propertyValue = value[property]

  return typeof propertyValue === 'string' && propertyValue.trim() !== '' ? propertyValue : undefined
}

const trimPath = (path: string): string => {
  const trimmed = path.replace(/^\/+|\/+$/g, '')

  return trimmed === '' ? path : trimmed
}

const formatJourneySegment = (value: unknown): string | undefined => {
  const code = getStringProperty(value, 'code')
  const path = getStringProperty(value, 'path')
  const title = getStringProperty(value, 'title')

  return code ?? (path ? trimPath(path) : undefined) ?? title
}

const formatStepSegment = (value: unknown): string | undefined => {
  const code = getStringProperty(value, 'code')
  const path = getStringProperty(value, 'path')
  const title = getStringProperty(value, 'title')

  return code ?? (path ? trimPath(path) : undefined) ?? title
}

const formatFunctionType = (functionType: string): string => {
  const suffix = functionType.split('.').at(-1)

  return suffix?.toLowerCase() ?? functionType
}

const formatFunctionContext = (value: unknown): string | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const type = getStringProperty(value, 'type')
  const name = getStringProperty(value, 'name')

  if (!type || !name || !FUNCTION_TYPE_VALUES.has(type)) {
    return undefined
  }

  return `${formatFunctionType(type)} - ${name}`
}

const formatBlockContext = (value: unknown): string | undefined => {
  if (!isRecord(value) || value.type !== StructureType.BLOCK) {
    return undefined
  }

  const variant = getStringProperty(value, 'variant')

  if (!variant) {
    return undefined
  }

  const code = value.blockType === BlockType.FIELD ? getStringProperty(value, 'code') : undefined

  return code ? `${variant} - ${code}` : variant
}

const formatArraySegment = (key: string, index: number, value: unknown): string => {
  if (key === 'steps') {
    return formatStepSegment(value) ?? `${key}[${index}]`
  }

  if (key === 'children') {
    return formatJourneySegment(value) ?? `${key}[${index}]`
  }

  const base = `${key}[${index}]`
  const context = key === 'blocks' ? formatBlockContext(value) : formatFunctionContext(value)

  return context ? `${base} (${context})` : base
}

const formatPropertySegments = (key: string, current: unknown, value: unknown): readonly string[] => {
  if (key === 'condition' && formatFunctionContext(value)) {
    return []
  }

  if (isRecord(current) && current.type === ExpressionType.ITERATE && key === 'input') {
    return ['source']
  }

  if (isRecord(current) && current.type === ExpressionType.ITERATE && key === 'iterator') {
    return ['source', 'iterator']
  }

  if (isRecord(current) && current.type === IteratorType.MAP && key === 'yield') {
    return ['template']
  }

  return [key]
}

const getNextValue = (current: unknown, key: string): unknown => {
  if (!isRecord(current)) {
    return undefined
  }

  return current[key]
}

const formatPathSegments = (path: readonly DSLPathSegment[], state: PathFormatState): readonly string[] => {
  if (state.index >= path.length) {
    return state.segments
  }

  const pathPart = path[state.index]

  if (isArrayIndex(pathPart)) {
    const nextValue = Array.isArray(state.current) ? state.current[pathPart] : undefined
    const nextSegments = [...state.segments, `[${pathPart}]`]

    return formatPathSegments(path, { current: nextValue, index: state.index + 1, segments: nextSegments })
  }

  const nextPathPart = path[state.index + 1]
  const propertyValue = getNextValue(state.current, pathPart)

  if (isArrayIndex(nextPathPart)) {
    const arrayValue = Array.isArray(propertyValue) ? propertyValue[nextPathPart] : undefined
    const nextSegments = [...state.segments, formatArraySegment(pathPart, nextPathPart, arrayValue)]

    return formatPathSegments(path, { current: arrayValue, index: state.index + 2, segments: nextSegments })
  }

  const propertySegments = formatPropertySegments(pathPart, state.current, propertyValue)
  const nextSegments = [...state.segments, ...propertySegments]

  return formatPathSegments(path, { current: propertyValue, index: state.index + 1, segments: nextSegments })
}

export const formatDSLPath = (root: unknown, path: readonly DSLPathSegment[]): string => {
  const rootSegment = formatJourneySegment(root) ?? 'root'
  const segments = formatPathSegments(path, { current: root, index: 0, segments: [rootSegment] })

  return segments.join(' > ')
}
