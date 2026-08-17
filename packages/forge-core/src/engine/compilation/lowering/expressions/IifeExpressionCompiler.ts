import { Code, code, joinCode } from '../../codegen/Code'
import CodeGenerator from '../../codegen/CodeGenerator'
import Name from '../../codegen/Name'

/**
 * Describes how to wrap generated statements in an immediately invoked
 * function expression.
 *
 * Expression compilers use this when they need local statements, guards, or
 * temporary variables but the surrounding compiler still needs a single
 * JavaScript expression string.
 */
interface IifeExpressionOptions {
  /** JavaScript expressions passed to the IIFE invocation. */
  readonly args?: readonly Code[]

  /** Wrap the invocation in await for generated async expression contexts. */
  readonly awaitResult?: boolean | (() => boolean)

  /** Emits the function body with the normal generated-source statement emitter. */
  readonly compileBody: (generator: CodeGenerator, parameters: readonly Name[]) => void

  /** Generator that owns names used by the embedded function expression. */
  readonly generator: CodeGenerator

  /** Generate an async function expression so the body can await nested expressions. */
  readonly isAsync?: boolean | (() => boolean)

  /** Stable debugger-facing function name. */
  readonly name?: string

  /** Parameter names made available to the emitted function body. */
  readonly params?: readonly string[]
}

/**
 * Compiles a statement-shaped body into an expression-shaped IIFE.
 *
 * @param options - IIFE shape and body emitter callback.
 * @returns JavaScript source that can be embedded anywhere an expression is valid.
 */
export function compileIifeExpression(options: IifeExpressionOptions): Code {
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
