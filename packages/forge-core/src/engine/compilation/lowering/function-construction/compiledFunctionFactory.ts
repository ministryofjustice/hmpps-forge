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
  /** Inline `data:` source map binding definition-file breakpoints onto the compiled function */
  sourceMapUrl?: string
}

export function createCompiledFunction<TFunction extends GeneratedFunction>(
  parameterNames: string[],
  source: string,
  options: CreateCompiledFunctionOptions,
): TFunction {
  const constructor = options.usesAwait ? AsyncFunctionConstructor : Function
  const namedSource = [
    source,
    ...(options.sourceName === undefined ? [] : [`//# sourceURL=${options.sourceName}`]),
    ...(options.sourceMapUrl === undefined ? [] : [`//# sourceMappingURL=${options.sourceMapUrl}`]),
  ].join('\n')

  return new constructor(...parameterNames, namedSource) as TFunction
}

/**
 * 0-based line where the generated body starts inside the script V8 builds
 * around `new Function` source (`function anonymous(<params>\n) {\n<body>`).
 * Measured, not assumed: `Function.prototype.toString` returns exactly the
 * constructed script source, so the sentinel's line index there is its line
 * in stack traces and source maps. Measured per constructor — sync and async
 * wrappers need not agree.
 */
const wrapperOffsets = new Map<boolean, number | undefined>()

export const measureWrapperOffset = (usesAwait: boolean): number | undefined => {
  if (wrapperOffsets.has(usesAwait)) {
    return wrapperOffsets.get(usesAwait)
  }

  const probeBody = 'return "forge-offset-probe";'
  const constructor = usesAwait ? AsyncFunctionConstructor : Function
  const probeLine = new constructor(probeBody)
    .toString()
    .split('\n')
    .findIndex(line => line === probeBody)
  const offset = probeLine === -1 ? undefined : probeLine

  wrapperOffsets.set(usesAwait, offset)

  return offset
}
