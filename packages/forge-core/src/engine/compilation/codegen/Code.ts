import ForgeInternalError from '../../errors/ForgeInternalError'
import ArrayExpressionToken from './ArrayExpressionToken'
import CallExpressionToken from './CallExpressionToken'
import FunctionExpressionToken from './FunctionExpressionToken'
import Name from './Name'
import ObjectExpressionToken from './ObjectExpressionToken'
import PositionedCodeToken from './PositionedCodeToken'
import { SourcePosition } from './SourcePosition.type'

export type CodeItem =
  | string
  | ArrayExpressionToken
  | CallExpressionToken
  | FunctionExpressionToken
  | ObjectExpressionToken
  | PositionedCodeToken

export type SafeCode = Code | Name

export type CodeInterpolation = SafeCode | string | number | boolean | null | undefined

export interface ObjectCodeProperty {
  readonly key: string
  readonly value: SafeCode
}

/**
 * A fragment of trusted JavaScript source.
 *
 * Use `code` to compose fragments: interpolated Code values remain executable,
 * while ordinary JavaScript values are emitted as literals.
 */
export class Code {
  private constructor(private readonly codeItems: readonly CodeItem[]) {
    this.codeItems = Object.freeze([...codeItems])
  }

  static trusted(source: string): Code {
    return new Code([source])
  }

  static compose(strings: TemplateStringsArray, values: readonly CodeInterpolation[]): Code {
    const items: CodeItem[] = []

    strings.forEach((part, index) => {
      items.push(part)

      if (index >= values.length) {
        return
      }

      items.push(...Code.fromInterpolation(values[index]).items)
    })

    return new Code(items)
  }

  static literal(value: unknown): Code {
    if (value === undefined) {
      return Code.trusted('undefined')
    }

    const serialised = JSON.stringify(value)

    if (serialised === undefined) {
      throw new ForgeInternalError(`Code: value of type "${typeof value}" cannot be emitted as a literal`)
    }

    return Code.trusted(serialised.replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029'))
  }

  static join(values: readonly SafeCode[], separator: Code): Code {
    const items: CodeItem[] = []

    values.forEach((value, index) => {
      if (index > 0) {
        items.push(...separator.items)
      }

      items.push(...Code.fromSafeCode(value).items)
    })

    return new Code(items)
  }

  static positioned(value: Code, positions: readonly SourcePosition[]): Code {
    return positions.length === 0 ? value : new Code([new PositionedCodeToken(value, positions)])
  }

  static functionExpression(token: FunctionExpressionToken): Code {
    return new Code([token])
  }

  static call(target: SafeCode, args: readonly SafeCode[]): Code {
    return new Code([
      new CallExpressionToken(
        Code.fromSafeCode(target),
        args.map(arg => Code.fromSafeCode(arg)),
      ),
    ])
  }

  static array(values: readonly SafeCode[]): Code {
    return new Code([new ArrayExpressionToken(values.map(value => Code.fromSafeCode(value)))])
  }

  static object(properties: readonly ObjectCodeProperty[]): Code {
    return new Code([
      new ObjectExpressionToken(
        properties.map(property => ({
          key: Code.literal(property.key),
          value: Code.fromSafeCode(property.value),
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

          throw new ForgeInternalError('Code: structured function expressions must be rendered by SourceRenderer')
        })
        .join('')
    )
  }

  private static fromInterpolation(value: CodeInterpolation): Code {
    if (value instanceof Code || value instanceof Name) {
      return Code.fromSafeCode(value)
    }

    return Code.literal(value)
  }

  private static fromSafeCode(value: SafeCode): Code {
    return value instanceof Code ? value : Code.trusted(value.value)
  }
}

export const nil = Code.trusted('')

/**
 * Safely composes JavaScript source. Only Code and Name values are executable;
 * every other interpolation is encoded as a JavaScript literal.
 */
export const code = (strings: TemplateStringsArray, ...values: CodeInterpolation[]): Code =>
  Code.compose(strings, values)

export const literal = (value: unknown): Code => Code.literal(value)

export const callCode = (target: SafeCode, args: readonly SafeCode[]): Code => Code.call(target, args)

export const joinCode = (values: readonly SafeCode[], separator: Code = code`, `): Code => Code.join(values, separator)

export const propertyCode = (property: string): Code => {
  if (isIdentifier(property)) {
    return Code.trusted(`.${property}`)
  }

  return code`[${property}]`
}

export const positionedCode = (value: Code, positions: readonly SourcePosition[]): Code =>
  Code.positioned(value, positions)

export const arrayCode = (values: readonly SafeCode[]): Code => Code.array(values)

export const objectCode = (properties: readonly ObjectCodeProperty[]): Code => Code.object(properties)

const isIdentifier = (value: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)
