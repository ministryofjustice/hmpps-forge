import ForgeInternalError from '../../../../../errors/ForgeInternalError'
import ArrayExpressionToken from './ArrayExpressionToken'
import CallExpressionToken from './CallExpressionToken'
import FunctionExpressionToken from './FunctionExpressionToken'
import IdentifierName from './IdentifierName'
import ObjectExpressionToken from './ObjectExpressionToken'
import PositionedCodeToken from './PositionedCodeToken'
import { SourcePosition } from '../SourcePosition.type'

export type CodeItem =
  | string
  | ArrayExpressionToken
  | CallExpressionToken
  | FunctionExpressionToken
  | ObjectExpressionToken
  | PositionedCodeToken

export type SafeCode = CodeFragment | IdentifierName

export type CodeInterpolation = SafeCode | string | number | boolean | null | undefined

export interface ObjectCodeProperty {
  readonly key: string
  readonly value: SafeCode
}

/**
 * A fragment of trusted JavaScript source.
 *
 * Use `code` to compose fragments: interpolated CodeFragment values remain executable,
 * while ordinary JavaScript values are emitted as literals.
 */
export class CodeFragment {
  private constructor(private readonly codeItems: readonly CodeItem[]) {
    this.codeItems = Object.freeze([...codeItems])
  }

  static trusted(source: string): CodeFragment {
    return new CodeFragment([source])
  }

  static compose(strings: TemplateStringsArray, values: readonly CodeInterpolation[]): CodeFragment {
    const items: CodeItem[] = []

    strings.forEach((part, index) => {
      items.push(part)

      if (index >= values.length) {
        return
      }

      items.push(...CodeFragment.fromInterpolation(values[index]).items)
    })

    return new CodeFragment(items)
  }

  static literal(value: unknown): CodeFragment {
    if (value === undefined) {
      return CodeFragment.trusted('undefined')
    }

    const serialised = JSON.stringify(value)

    if (serialised === undefined) {
      throw new ForgeInternalError(`CodeFragment: value of type "${typeof value}" cannot be emitted as a literal`)
    }

    return CodeFragment.trusted(serialised.replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029'))
  }

  static join(values: readonly SafeCode[], separator: CodeFragment): CodeFragment {
    const items: CodeItem[] = []

    values.forEach((value, index) => {
      if (index > 0) {
        items.push(...separator.items)
      }

      items.push(...CodeFragment.fromSafeCode(value).items)
    })

    return new CodeFragment(items)
  }

  static positioned(value: CodeFragment, positions: readonly SourcePosition[]): CodeFragment {
    return positions.length === 0 ? value : new CodeFragment([new PositionedCodeToken(value, positions)])
  }

  static functionExpression(token: FunctionExpressionToken): CodeFragment {
    return new CodeFragment([token])
  }

  static call(target: SafeCode, args: readonly SafeCode[]): CodeFragment {
    return new CodeFragment([
      new CallExpressionToken(
        CodeFragment.fromSafeCode(target),
        args.map(arg => CodeFragment.fromSafeCode(arg)),
      ),
    ])
  }

  static array(values: readonly SafeCode[]): CodeFragment {
    return new CodeFragment([new ArrayExpressionToken(values.map(value => CodeFragment.fromSafeCode(value)))])
  }

  static object(properties: readonly ObjectCodeProperty[]): CodeFragment {
    return new CodeFragment([
      new ObjectExpressionToken(
        properties.map(property => ({
          key: CodeFragment.objectKey(property.key),
          value: CodeFragment.fromSafeCode(property.value),
        })),
      ),
    ])
  }

  /**
   * Emits a deeply static value as a structured literal: plain objects and
   * arrays become expression tokens (so the renderer can format them across
   * lines), everything else is serialised by `literal`. Matches
   * `JSON.stringify` semantics for unserialisable values: object entries are
   * dropped, array items become `null`.
   */
  static structuredLiteral(value: unknown): CodeFragment {
    if (Array.isArray(value)) {
      return CodeFragment.array(
        value.map(item => (isSerialisable(item) ? CodeFragment.structuredLiteral(item) : CodeFragment.literal(null))),
      )
    }

    if (isPlainObject(value)) {
      return new CodeFragment([
        new ObjectExpressionToken(
          Object.entries(value)
            .filter(([, entryValue]) => isSerialisable(entryValue))
            .map(([key, entryValue]) => ({
              key: CodeFragment.objectKey(key),
              value: CodeFragment.structuredLiteral(entryValue),
            })),
        ),
      ])
    }

    return CodeFragment.literal(value)
  }

  private static objectKey(key: string): CodeFragment {
    return isIdentifier(key) ? CodeFragment.trusted(key) : CodeFragment.literal(key)
  }

  get items(): readonly CodeItem[] {
    return this.codeItems
  }

  get isEmpty(): boolean {
    return this.codeItems.length === 0
  }

  /**
   * True when the fragment contains a structured call or function-expression
   * token. A fragment without either is a plain read (property chains,
   * literals, arithmetic) that cannot invoke authored code.
   */
  get containsInvocation(): boolean {
    return this.codeItems.some(item => {
      if (typeof item === 'string') {
        return false
      }

      if (item instanceof PositionedCodeToken) {
        return item.value.containsInvocation
      }

      if (item instanceof ArrayExpressionToken) {
        return item.values.some(value => value.containsInvocation)
      }

      if (item instanceof ObjectExpressionToken) {
        return item.properties.some(property => property.value.containsInvocation)
      }

      return true
    })
  }

  toString(): string {
    return (
      this.codeItems
        .map(item => {
          if (typeof item === 'string') {
            return item
          }

          if (item instanceof PositionedCodeToken) {
            return item.value.toString()
          }

          if (item instanceof ArrayExpressionToken) {
            return `[${item.values.map(value => value.toString()).join(', ')}]`
          }

          if (item instanceof CallExpressionToken) {
            return `${item.target.toString()}(${item.args.map(arg => arg.toString()).join(', ')})`
          }

          if (item instanceof ObjectExpressionToken) {
            const properties = item.properties.map(
              property => `${property.key.toString()}: ${property.value.toString()}`,
            )

            return properties.length === 0 ? '{}' : `{ ${properties.join(', ')} }`
          }

          throw new ForgeInternalError(
            'CodeFragment: structured function expressions must be rendered by SourceRenderer',
          )
        })
        .join('')
    )
  }

  private static fromInterpolation(value: CodeInterpolation): CodeFragment {
    if (value instanceof CodeFragment || value instanceof IdentifierName) {
      return CodeFragment.fromSafeCode(value)
    }

    return CodeFragment.literal(value)
  }

  private static fromSafeCode(value: SafeCode): CodeFragment {
    return value instanceof CodeFragment ? value : CodeFragment.trusted(value.value)
  }
}

export const nil = CodeFragment.trusted('')

/**
 * Safely composes JavaScript source. Only CodeFragment and IdentifierName values are executable;
 * every other interpolation is encoded as a JavaScript literal.
 */
export const code = (strings: TemplateStringsArray, ...values: CodeInterpolation[]): CodeFragment =>
  CodeFragment.compose(strings, values)

export const literal = (value: unknown): CodeFragment => CodeFragment.literal(value)

export const callCode = (target: SafeCode, args: readonly SafeCode[]): CodeFragment => CodeFragment.call(target, args)

export const joinCode = (values: readonly SafeCode[], separator: CodeFragment = code`, `): CodeFragment =>
  CodeFragment.join(values, separator)

export const propertyCode = (property: string): CodeFragment => {
  if (isIdentifier(property)) {
    return CodeFragment.trusted(`.${property}`)
  }

  return code`[${property}]`
}

export const optionalPropertyCode = (property: string): CodeFragment => {
  if (isIdentifier(property)) {
    return CodeFragment.trusted(`?.${property}`)
  }

  return code`?.[${property}]`
}

export const positionedCode = (value: CodeFragment, positions: readonly SourcePosition[]): CodeFragment =>
  CodeFragment.positioned(value, positions)

export const arrayCode = (values: readonly SafeCode[]): CodeFragment => CodeFragment.array(values)

export const objectCode = (properties: readonly ObjectCodeProperty[]): CodeFragment => CodeFragment.object(properties)

export const structuredLiteralCode = (value: unknown): CodeFragment => CodeFragment.structuredLiteral(value)

const isIdentifier = (value: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') {
    return false
  }

  const prototype = Object.getPrototypeOf(value) as unknown

  return prototype === Object.prototype || prototype === null
}

const isSerialisable = (value: unknown): boolean =>
  value !== undefined && typeof value !== 'function' && typeof value !== 'symbol'
