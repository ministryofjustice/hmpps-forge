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
export function createCompiledFunction<TFunction extends GeneratedFunction>(
  parameterNames: string[],
  source: string,
  usesAwait: boolean,
): TFunction {
  const constructor = usesAwait ? AsyncFunctionConstructor : Function

  return new constructor(...parameterNames, source) as TFunction
}
