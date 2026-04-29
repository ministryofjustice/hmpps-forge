import { FunctionEvaluator } from '../types/functions.type'
import { GeneratorBuilder } from '../builders/GeneratorBuilder'
import type { EffectFunctionContext } from '../../engine/nodes/expressions/effect/EffectFunctionContext'
import {
  ConditionFunctionExpr,
  EffectFunctionExpr,
  TransformerFunctionExpr,
  ResolvableValue,
} from '../types/expressions.type'

export type NoDeps = Record<string, never>

export type FunctionShapeMap = Record<string, FunctionEvaluator<unknown>>
type PublicFunctionArguments<TFunction> = TFunction extends (...args: infer TArgs) => unknown ? TArgs : never

type FunctionGroup<T, TExpr> = {
  [K in keyof T]: (...args: PublicFunctionArguments<T[K]>) => TExpr
}

export type ConditionFunctionGroup<T> = FunctionGroup<T, ConditionFunctionExpr<ResolvableValue[]>>
export type TransformerFunctionGroup<T> = FunctionGroup<T, TransformerFunctionExpr<ResolvableValue[]>>
export type EffectFunctionGroup<T> = FunctionGroup<T, EffectFunctionExpr<ResolvableValue[]>>
export type GeneratorFunctionGroup<T> = FunctionGroup<T, unknown>

export type FunctionImplementations<TShapes extends FunctionShapeMap, TDeps = NoDeps> = {
  [K in keyof TShapes]: (deps: TDeps) => TShapes[K]
}

/**
 * A factory entry can be a plain factory function (backward-compatible) or an
 * object that also exposes a synchronous `validate` hook.
 *
 * `validate` runs at author-call time — when `conditions.Name(...)`, `generators.Name(...)`
 * etc. are invoked to build the expression — and receives the same args the
 * author passed. It does not see runtime dependencies or the injected `value` /
 * `context` first parameter, so it can only catch structural problems (bad
 * template syntax, missing required arg, etc.).
 */
export type FunctionFactoryEntry<
  TEvaluator extends FunctionEvaluator<unknown>,
  TDeps,
  TPublicArgs extends readonly unknown[],
> =
  | ((deps: TDeps) => TEvaluator)
  | {
      validate?: (...args: TPublicArgs) => void
      factory: (deps: TDeps) => TEvaluator
    }

type RuntimeContext = {
  condition: [value: unknown]
  transformer: [value: unknown]
  effect: [context: EffectFunctionContext]
  generator: []
}

type RuntimeReturn = {
  condition: boolean | Promise<boolean>
  transformer: ResolvableValue | Promise<ResolvableValue>
  effect: void | Promise<void>
  generator: ResolvableValue | Promise<ResolvableValue>
}

export type ImplementationShapes<
  TKind extends keyof RuntimeContext,
  TFunctions extends Record<string, (...args: never[]) => unknown>,
> = {
  [K in keyof TFunctions]: (
    ...args: [...RuntimeContext[TKind], ...PublicFunctionArguments<TFunctions[K]>]
  ) => RuntimeReturn[TKind]
}

export type ConditionImplementations<TConditions extends ConditionFunctionGroup<TConditions>, TDeps = NoDeps> = {
  [K in keyof TConditions]: FunctionFactoryEntry<
    ImplementationShapes<'condition', TConditions>[K],
    TDeps,
    PublicFunctionArguments<TConditions[K]>
  >
}

export type TransformerImplementations<
  TTransformers extends TransformerFunctionGroup<TTransformers>,
  TDeps = NoDeps,
> = {
  [K in keyof TTransformers]: FunctionFactoryEntry<
    ImplementationShapes<'transformer', TTransformers>[K],
    TDeps,
    PublicFunctionArguments<TTransformers[K]>
  >
}

export type EffectImplementations<TEffects extends EffectFunctionGroup<TEffects>, TDeps = NoDeps> = {
  [K in keyof TEffects]: FunctionFactoryEntry<
    ImplementationShapes<'effect', TEffects>[K],
    TDeps,
    PublicFunctionArguments<TEffects[K]>
  >
}

export type GeneratorImplementations<TGenerators extends GeneratorFunctionGroup<TGenerators>, TDeps = NoDeps> = {
  [K in keyof TGenerators]: FunctionFactoryEntry<
    ImplementationShapes<'generator', TGenerators>[K],
    TDeps,
    PublicFunctionArguments<TGenerators[K]>
  >
}

type ReferenceArguments<TFunction extends FunctionEvaluator<unknown>> =
  Parameters<TFunction> extends [unknown, ...infer TRest] ? TRest : []

type ValueArguments<TFunction extends FunctionEvaluator<unknown>> =
  ReferenceArguments<TFunction> extends ResolvableValue[] ? ReferenceArguments<TFunction> : never

type GeneratorArguments<TFunction extends FunctionEvaluator<unknown>> =
  Parameters<TFunction> extends ResolvableValue[] ? Parameters<TFunction> : never

export type ConditionFunctions<TShapes extends FunctionShapeMap> = {
  [K in keyof TShapes]: (...args: ValueArguments<TShapes[K]>) => ConditionFunctionExpr<ValueArguments<TShapes[K]>>
}

export type TransformerFunctions<TShapes extends FunctionShapeMap> = {
  [K in keyof TShapes]: (...args: ValueArguments<TShapes[K]>) => TransformerFunctionExpr<ValueArguments<TShapes[K]>>
}

export type EffectFunctions<TShapes extends FunctionShapeMap> = {
  [K in keyof TShapes]: (...args: ValueArguments<TShapes[K]>) => EffectFunctionExpr<ValueArguments<TShapes[K]>>
}

export type GeneratorFunctions<TShapes extends FunctionShapeMap> = {
  [K in keyof TShapes]: (...args: GeneratorArguments<TShapes[K]>) => GeneratorBuilder<GeneratorArguments<TShapes[K]>>
}
