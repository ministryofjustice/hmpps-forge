import type { FunctionEvaluator } from '../authoring/types/functions.type'
import type { ForgePackageRegistration } from '../engine/chassis/contracts/ast/engine.type'
import { isFunctionRegistry } from '../authoring/registries/BaseFunctionRegistry'

export interface TestPackageOptions {
  /** Function evaluators to replace in the package, keyed by function name. */
  overrides?: Record<string, FunctionEvaluator>
}

/**
 * Create a copy of a Forge package with specific function implementations replaced.
 *
 * Overrides replace specific functions by name. Functions not listed
 * in overrides keep their original implementation.
 *
 * @example
 * ```typescript
 * const mockSendEmail = vi.fn()
 * const pkg = createTestPackage(myPackage, {
 *   overrides: { SendEmail: mockSendEmail },
 * })
 *
 * forge.registerPackage(pkg, { api: mockApi })
 *
 * // After a request:
 * expect(mockSendEmail).not.toHaveBeenCalled()
 * ```
 */
export function createTestPackage<TDeps>(
  pkg: ForgePackageRegistration<TDeps>,
  options: TestPackageOptions = {},
): ForgePackageRegistration<TDeps> {
  const { functions } = pkg

  // Overrides replace functions by name, which only applies to the deprecated
  // implementations-map form. Registry-based packages are returned unchanged.
  if (!options.overrides || Array.isArray(functions) || isFunctionRegistry(functions)) {
    return { ...pkg }
  }

  const merged = { ...functions } as Record<string, (deps: TDeps) => FunctionEvaluator>

  Object.entries(options.overrides).forEach(([name, evaluator]) => {
    merged[name] = () => evaluator
  })

  return {
    ...pkg,
    functions: merged,
  }
}
