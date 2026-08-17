import { CodeFragment, code, joinCode } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import IdentifierName from '../codegen/fragments/IdentifierName'

/**
 * Describes how to wrap generated statements in an immediately invoked
 * function expression (IIFE).
 *
 * Expression compilers use this when they need local variables, guards, or
 * multi-line logic but the surrounding code requires a single JavaScript
 * expression rather than a block of statements.
 */
interface IifeExpressionOptions {
  /** JavaScript expressions passed to the IIFE invocation. */
  readonly args?: readonly CodeFragment[]

  /** Wrap the IIFE call in `await` when the generated body is async. */
  readonly awaitResult?: boolean | (() => boolean)

  /** Callback that emits the function body using the provided `CodeGenerator`. */
  readonly compileBody: (generator: CodeGenerator, parameters: readonly IdentifierName[]) => void

  /** The `CodeGenerator` that manages variable names for the IIFE. */
  readonly generator: CodeGenerator

  /** Generate an async function expression so the body can await nested expressions. */
  readonly isAsync?: boolean | (() => boolean)

  /** Stable debugger-facing function name. */
  readonly name?: string

  /** Parameter names made available to the emitted function body. */
  readonly params?: readonly string[]
}

/**
 * Wraps a block of statements in an IIFE so it can be used where a single
 * JavaScript expression is needed.
 *
 * @param options - IIFE shape and body callback.
 * @returns JavaScript source that can be embedded anywhere an expression is valid.
 */
export function compileIifeExpression(options: IifeExpressionOptions): CodeFragment {
  const params = options.params ?? []
  const args = options.args ?? []
  const functionExpression = options.generator.functionExpression(
    options.name ?? 'evaluate_expression',
    params,
    (functionGenerator, parameters) => options.compileBody(functionGenerator, parameters),
    { async: () => resolveOption(options.isAsync) },
  )
  const invocationExpr = code`(${functionExpression})(${joinCode(args)})`

  if (resolveOption(options.awaitResult)) {
    return code`(await ${invocationExpr})`
  }

  return invocationExpr
}

const resolveOption = (option: boolean | (() => boolean) | undefined): boolean =>
  typeof option === 'function' ? option() : option === true
