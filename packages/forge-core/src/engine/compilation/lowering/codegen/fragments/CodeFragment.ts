import ForgeInternalError from '../../../../errors/ForgeInternalError'
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
          key: CodeFragment.literal(property.key),
          value: CodeFragment.fromSafeCode(property.value),
        })),
      ),
    ])
  }

  get items(): readonly CodeItem[] {
    return this.codeItems
  }

  get isEmpty(): boolean {
    return this.codeItems.length === 0
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

export const positionedCode = (value: CodeFragment, positions: readonly SourcePosition[]): CodeFragment =>
  CodeFragment.positioned(value, positions)

export const arrayCode = (values: readonly SafeCode[]): CodeFragment => CodeFragment.array(values)

export const objectCode = (properties: readonly ObjectCodeProperty[]): CodeFragment => CodeFragment.object(properties)

const isIdentifier = (value: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)
