export type GeneratedFunction = (...args: never[]) => unknown

const AsyncFunctionConstructor = Object.getPrototypeOf(async function compiledAsync() {
  return undefined
}).constructor as FunctionConstructor

/**
 * Creates either a normal Function or an AsyncFunction from generated source.
 *
 * The compiler keeps sync functions genuinely sync for the hot path, but any
 * emitted `await` requires the async constructor because `await` is illegal in a
 * normal function body. Runtime callers still await the result so both shapes
 * share the same orchestration path.
 */
interface CreateCompiledFunctionOptions {
  usesAwait: boolean
  /** Named script origin so eval'd frames render as `forge:compiled/...` instead of `<anonymous>` */
  sourceName?: string
}

export function createCompiledFunction<TFunction extends GeneratedFunction>(
  parameterNames: string[],
  source: string,
  options: CreateCompiledFunctionOptions,
): TFunction {
  const constructor = options.usesAwait ? AsyncFunctionConstructor : Function
  const namedSource = options.sourceName === undefined ? source : `${source}\n//# sourceURL=${options.sourceName}`

  return new constructor(...parameterNames, namedSource) as TFunction
}
