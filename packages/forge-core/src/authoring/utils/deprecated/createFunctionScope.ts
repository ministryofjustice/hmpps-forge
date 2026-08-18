import { GeneratorBuilder } from '../../builders/GeneratorBuilder'
import type { ChainableGenerator } from '../../builders/types'
import { ForgeDeprecations } from '../../../shared/ForgeDeprecations'
import { FunctionType } from '../../types/enums'
import type {
  ConditionFunctionExpr,
  EffectFunctionExpr,
  TransformerFunctionExpr,
  ResolvableValue,
} from '../../types/expressions.type'
import type { FunctionImplementations, FunctionShapeMap, NoDeps } from './defineFunction.type'

type ScopedFunctionFactory<TDeps> = (deps: TDeps) => (...args: never[]) => unknown
type ScopedConditionFactory<TDeps, TValue, TArgs extends ResolvableValue[]> = (
  deps: TDeps,
) => (value: TValue, ...args: TArgs) => boolean | Promise<boolean>
type ScopedTransformerFactory<TDeps, TValue, TArgs extends ResolvableValue[]> = (
  deps: TDeps,
) => (value: TValue, ...args: TArgs) => unknown
type ScopedEffectFactory<TDeps, TContext, TArgs extends ResolvableValue[]> = (
  deps: TDeps,
) => (context: TContext, ...args: TArgs) => void | Promise<void>
type ScopedGeneratorFactory<TDeps, TArgs extends ResolvableValue[]> = (deps: TDeps) => (...args: TArgs) => unknown

/**
 * Package-local collector for inline function definitions.
 *
 * Each method stores the dependency-injected factory in `implementations` and
 * returns the normal Forge expression used by journeys, steps, blocks, and hooks.
 *
 * @deprecated Use ConditionRegistry/TransformerRegistry/EffectRegistry/GeneratorRegistry inline instead.
 */
export interface FunctionScope<TDeps = NoDeps> {
  readonly implementations: FunctionImplementations<FunctionShapeMap, TDeps>

  condition<TValue, TArgs extends ResolvableValue[]>(
    name: string,
    factory: ScopedConditionFactory<TDeps, TValue, TArgs>,
    ...args: TArgs
  ): ConditionFunctionExpr<TArgs>

  transformer<TValue, TArgs extends ResolvableValue[]>(
    name: string,
    factory: ScopedTransformerFactory<TDeps, TValue, TArgs>,
    ...args: TArgs
  ): TransformerFunctionExpr<TArgs>

  effect<TContext, TArgs extends ResolvableValue[]>(
    name: string,
    factory: ScopedEffectFactory<TDeps, TContext, TArgs>,
    ...args: TArgs
  ): EffectFunctionExpr<TArgs>

  generator<TArgs extends ResolvableValue[]>(
    name: string,
    factory: ScopedGeneratorFactory<TDeps, TArgs>,
    ...args: TArgs
  ): ChainableGenerator
}

const ensureNameIsValid = (name: string): void => {
  if (name.length === 0) {
    throw new Error('Function scope names must not be empty')
  }
}

const isSameFactory = <TDeps>(
  existingFactory: ScopedFunctionFactory<TDeps>,
  nextFactory: ScopedFunctionFactory<TDeps>,
): boolean => {
  if (existingFactory === nextFactory) {
    return true
  }

  return existingFactory.toString() === nextFactory.toString()
}

/**
 * Create a package-local function scope for one-off authoring functions.
 *
 * Pass `scope.implementations` into `createForgePackage({ functions })` so the
 * collected factories receive the same runtime dependencies as regular
 * `defineEffectFunctions` and `defineTransformerFunctions` implementations.
 *
 * @deprecated Use ConditionRegistry/TransformerRegistry/EffectRegistry/GeneratorRegistry inline instead.
 */
export function createFunctionScope<TDeps = NoDeps>(): FunctionScope<TDeps> {
  ForgeDeprecations.warn(
    'FORGE_DEP_createFunctionScope',
    'createFunctionScope is deprecated - use ConditionRegistry/TransformerRegistry/EffectRegistry/GeneratorRegistry inline instead.',
  )

  const implementations: FunctionImplementations<FunctionShapeMap, TDeps> = {}

  const register = (name: string, factory: ScopedFunctionFactory<TDeps>): void => {
    ensureNameIsValid(name)

    if (Object.prototype.hasOwnProperty.call(implementations, name)) {
      if (!isSameFactory(implementations[name] as ScopedFunctionFactory<TDeps>, factory)) {
        throw new Error(
          `Function scope already contains a different implementation named "${name}". ` +
            'Reuse a name only for the same inline function, or choose a unique name.',
        )
      }

      return
    }

    implementations[name] = factory
  }

  return {
    implementations,

    condition: <TValue, TArgs extends ResolvableValue[]>(
      name: string,
      factory: ScopedConditionFactory<TDeps, TValue, TArgs>,
      ...args: TArgs
    ): ConditionFunctionExpr<TArgs> => {
      register(name, factory)

      return {
        type: FunctionType.CONDITION,
        name,
        arguments: args,
      }
    },

    transformer: <TValue, TArgs extends ResolvableValue[]>(
      name: string,
      factory: ScopedTransformerFactory<TDeps, TValue, TArgs>,
      ...args: TArgs
    ): TransformerFunctionExpr<TArgs> => {
      register(name, factory)

      return {
        type: FunctionType.TRANSFORMER,
        name,
        arguments: args,
      }
    },

    effect: <TContext, TArgs extends ResolvableValue[]>(
      name: string,
      factory: ScopedEffectFactory<TDeps, TContext, TArgs>,
      ...args: TArgs
    ): EffectFunctionExpr<TArgs> => {
      register(name, factory)

      return {
        type: FunctionType.EFFECT,
        name,
        arguments: args,
      }
    },

    generator: <TArgs extends ResolvableValue[]>(
      name: string,
      factory: ScopedGeneratorFactory<TDeps, TArgs>,
      ...args: TArgs
    ): ChainableGenerator => {
      register(name, factory)

      return GeneratorBuilder.create(name, args)
    },
  }
}
