import { ComponentCallType, ExpressionType, IteratorType, PredicateType } from '../taxonomy'
import type { DSLPathSegment } from './sourceLocation.type'

type DSLRecord = Record<string, unknown>

interface PathFormatState {
  readonly current: unknown
  readonly index: number
  readonly segments: readonly string[]
}

export default class DSLPathFormatter {
  format(root: unknown, path: readonly DSLPathSegment[]): string {
    const rootSegment = this.formatJourneySegment(root) ?? 'root'
    const segments = this.formatPathSegments(path, { current: root, index: 0, segments: [rootSegment] })

    return segments.join(' > ')
  }

  private formatPathSegments(path: readonly DSLPathSegment[], state: PathFormatState): readonly string[] {
    if (state.index >= path.length) {
      return state.segments
    }

    const pathPart = path[state.index]

    if (this.isArrayIndex(pathPart)) {
      const nextValue = Array.isArray(state.current) ? state.current[pathPart] : undefined
      const nextSegments = [...state.segments, `[${pathPart}]`]

      return this.formatPathSegments(path, { current: nextValue, index: state.index + 1, segments: nextSegments })
    }

    const nextPathPart = path[state.index + 1]
    const propertyValue = this.getNextValue(state.current, pathPart)

    if (this.isArrayIndex(nextPathPart)) {
      const arrayValue = Array.isArray(propertyValue) ? propertyValue[nextPathPart] : undefined
      const nextSegments = [...state.segments, this.formatArraySegment(pathPart, nextPathPart, arrayValue)]

      return this.formatPathSegments(path, { current: arrayValue, index: state.index + 2, segments: nextSegments })
    }

    const propertySegments = this.formatPropertySegments(pathPart, state.current, propertyValue)
    const nextSegments = [...state.segments, ...propertySegments]

    return this.formatPathSegments(path, { current: propertyValue, index: state.index + 1, segments: nextSegments })
  }

  private formatArraySegment(key: string, index: number, value: unknown): string {
    if (key === 'steps') {
      return this.formatStepSegment(value) ?? `${key}[${index}]`
    }

    if (key === 'children') {
      return this.formatJourneySegment(value) ?? `${key}[${index}]`
    }

    const base = `${key}[${index}]`
    const context = key === 'blocks' ? this.formatBlockContext(value) : this.formatFunctionContext(value)

    return context ? `${base} (${context})` : base
  }

  private formatPropertySegments(key: string, current: unknown, value: unknown): readonly string[] {
    if (key === 'condition' && this.isPredicateTest(current) && this.formatFunctionContext(value)) {
      return []
    }

    if (this.isRecord(current) && current._forge === ExpressionType.ITERATE && key === 'input') {
      return ['source']
    }

    if (this.isRecord(current) && current._forge === ExpressionType.ITERATE && key === 'iterator') {
      return ['source', 'iterator']
    }

    if (this.isRecord(current) && current._forge === IteratorType.MAP && key === 'yield') {
      return ['template']
    }

    return [key]
  }

  private formatJourneySegment(value: unknown): string | undefined {
    const code = this.getStringProperty(value, 'code')
    const path = this.getStringProperty(value, 'path')
    const title = this.getStringProperty(value, 'title')

    return code ?? (path ? this.trimPath(path) : undefined) ?? title
  }

  private formatStepSegment(value: unknown): string | undefined {
    const code = this.getStringProperty(value, 'code')
    const path = this.getStringProperty(value, 'path')
    const title = this.getStringProperty(value, 'title')

    return code ?? (path ? this.trimPath(path) : undefined) ?? title
  }

  private formatFunctionContext(value: unknown): string | undefined {
    if (!this.isRecord(value)) {
      return undefined
    }

    const type = this.getStringProperty(value, '_forge')
    const name = this.getStringProperty(value, 'name')

    if (!type || !name || !type.startsWith('function.call.')) {
      return undefined
    }

    return `${this.formatFunctionType(type)} - ${name}`
  }

  private isPredicateTest(value: unknown): boolean {
    return this.isRecord(value) && value._forge === PredicateType.TEST
  }

  private formatBlockContext(value: unknown): string | undefined {
    if (!this.isRecord(value) || typeof value._forge !== 'string' || !value._forge.startsWith('component.call.')) {
      return undefined
    }

    const variant = this.getStringProperty(value, 'variant')

    if (!variant) {
      return undefined
    }

    const code = value._forge === ComponentCallType.FIELD ? this.getStringProperty(value, 'code') : undefined

    return code ? `${variant} - ${code}` : variant
  }

  private formatFunctionType(functionType: string): string {
    const suffix = functionType.split('.').at(-1)

    return suffix?.toLowerCase() ?? functionType
  }

  private getNextValue(current: unknown, key: string): unknown {
    if (!this.isRecord(current)) {
      return undefined
    }

    return current[key]
  }

  private getStringProperty(value: unknown, property: string): string | undefined {
    if (!this.isRecord(value)) {
      return undefined
    }

    const propertyValue = value[property]

    return typeof propertyValue === 'string' && propertyValue.trim() !== '' ? propertyValue : undefined
  }

  private trimPath(path: string): string {
    const trimmed = path.replace(/^\/+|\/+$/g, '')

    return trimmed === '' ? path : trimmed
  }

  private isRecord(value: unknown): value is DSLRecord {
    return typeof value === 'object' && value !== undefined && value !== null && !Array.isArray(value)
  }

  private isArrayIndex(value: unknown): value is number {
    return typeof value === 'number'
  }
}
