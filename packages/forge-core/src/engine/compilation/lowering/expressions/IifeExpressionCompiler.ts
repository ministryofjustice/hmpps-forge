import CodeEmitter from '../../codegen/CodeEmitter'

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
  readonly args?: readonly string[]

  /** Wrap the invocation in await for generated async expression contexts. */
  readonly awaitResult?: boolean

  /** Emits the function body with the normal generated-source statement emitter. */
  readonly compileBody: (emitter: CodeEmitter) => void

  /** Generate an async function expression so the body can await nested expressions. */
  readonly isAsync?: boolean

  /** Parameter names made available to the emitted function body. */
  readonly params?: readonly string[]
}

/**
 * Compiles a statement-shaped body into an expression-shaped IIFE.
 *
 * @param options - IIFE shape and body emitter callback.
 * @returns JavaScript source that can be embedded anywhere an expression is valid.
 */
export function compileIifeExpression(options: IifeExpressionOptions): string {
  const emitter = new CodeEmitter()

  emitter.indent()
  options.compileBody(emitter)

  const functionPrefix = options.isAsync === true ? 'async ' : ''
  const params = options.params ?? []
  const args = options.args ?? []
  const invocationExpr = `(${functionPrefix}function(${params.join(', ')}) {
${emitter.toString()}
})(${args.join(', ')})`

  if (options.awaitResult === true) {
    return `(await ${invocationExpr})`
  }

  return invocationExpr
}
