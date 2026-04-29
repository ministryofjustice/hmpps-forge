import FunctionRegistry from '../../registries/FunctionRegistry'
import NodeCompilationDispatcher from './NodeCompilationDispatcher'
import { createCompiledFunction, GeneratedFunction } from './compiledFunctionFactory'

interface CompileOptions {
  forceAsync?: boolean
}

/**
 * Resets the expression dispatcher before a compiler builds source.
 *
 * The dispatcher owns request-shape state such as iterator scope frames and
 * async discovery. Keeping this reset path shared makes every compiler use the
 * same hybrid sync/async rules while still letting each compiler own its source
 * layout.
 */
export function buildGeneratedSource(
  expr: NodeCompilationDispatcher,
  functionRegistry: FunctionRegistry | undefined,
  buildSource: () => string,
): string {
  expr.setFunctionRegistry(functionRegistry)
  expr.reset()

  return buildSource()
}

/**
 * Compiles generated source into either Function or AsyncFunction.
 *
 * Most compilers decide async from expression calls discovered by the
 * dispatcher. Hook lifecycles force async because effects are always awaited
 * and their side effects must complete before outcomes are inspected.
 */
export function compileGeneratedFunction<TFunction extends GeneratedFunction>(
  expr: NodeCompilationDispatcher,
  parameterNames: string[],
  functionRegistry: FunctionRegistry | undefined,
  buildSource: () => string,
  options: CompileOptions = {},
): TFunction | undefined {
  const source = buildGeneratedSource(expr, functionRegistry, buildSource)

  try {
    return createCompiledFunction<TFunction>(parameterNames, source, options.forceAsync === true || expr.usesAwait)
  } catch {
    return undefined
  }
}
