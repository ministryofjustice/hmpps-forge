import { FunctionEvaluator } from '../types/functions.type'
import { GeneratorBuilder } from '../builders/GeneratorBuilder'
import type { EffectFunctionContext } from '../../engine/nodes/expressions/effect/EffectFunctionContext'
import {
  ConditionFunctionExpr,
  EffectFunctionExpr,
  TransformerFunctionExpr,
  ValueExpr,
} from '../types/expressions.type'

export type NoDeps = Record<string, never>

export type FunctionShapeMap = Record<string, FunctionEvaluator<unknown>>
type PublicFunctionArguments<TFunction> = TFunction extends (...args: infer TArgs) => unknown ? TArgs : never

type FunctionGroup<T, TExpr> = {
  [K in keyof T]: (...args: never[]) => TExpr
}

export type ConditionFunctionGroup<T> = FunctionGroup<T, ConditionFunctionExpr<ValueExpr[]>>
export type TransformerFunctionGroup<T> = FunctionGroup<T, TransformerFunctionExpr<ValueExpr[]>>
export type EffectFunctionGroup<T> = FunctionGroup<T, EffectFunctionExpr<ValueExpr[]>>
export type GeneratorFunctionGroup<T> = FunctionGroup<T, unknown>

export type FunctionImplementations<TShapes extends FunctionShapeMap, TDeps = NoDeps> = {
  [K in keyof TShapes]: (deps: TDeps) => TShapes[K]
}

type RuntimeContext = {
  condition: [value: unknown]
  transformer: [value: unknown]
  effect: [context: EffectFunctionContext]
  generator: []
}

type RuntimeReturn = {
  condition: boolean | Promise<boolean>
  transformer: ValueExpr | Promise<ValueExpr>
  effect: void | Promise<void>
  generator: ValueExpr | Promise<ValueExpr>
}

type ImplementationShapes<
  TKind extends keyof RuntimeContext,
  TFunctions extends Record<string, (...args: never[]) => unknown>,
> = {
  [K in keyof TFunctions]: (
    ...args: [...RuntimeContext[TKind], ...PublicFunctionArguments<TFunctions[K]>]
  ) => RuntimeReturn[TKind]
}

export type ConditionImplementations<
  TConditions extends ConditionFunctionGroup<TConditions>,
  TDeps = NoDeps,
> = FunctionImplementations<ImplementationShapes<'condition', TConditions>, TDeps>

export type TransformerImplementations<
  TTransformers extends TransformerFunctionGroup<TTransformers>,
  TDeps = NoDeps,
> = FunctionImplementations<ImplementationShapes<'transformer', TTransformers>, TDeps>

export type EffectImplementations<
  TEffects extends EffectFunctionGroup<TEffects>,
  TDeps = NoDeps,
> = FunctionImplementations<ImplementationShapes<'effect', TEffects>, TDeps>

export type GeneratorImplementations<
  TGenerators extends GeneratorFunctionGroup<TGenerators>,
  TDeps = NoDeps,
> = FunctionImplementations<ImplementationShapes<'generator', TGenerators>, TDeps>

type ReferenceArguments<TFunction extends FunctionEvaluator<unknown>> =
  Parameters<TFunction> extends [unknown, ...infer TRest] ? TRest : []

type ValueArguments<TFunction extends FunctionEvaluator<unknown>> =
  ReferenceArguments<TFunction> extends ValueExpr[] ? ReferenceArguments<TFunction> : never

type GeneratorArguments<TFunction extends FunctionEvaluator<unknown>> =
  Parameters<TFunction> extends ValueExpr[] ? Parameters<TFunction> : never

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
