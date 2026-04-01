import { FunctionEvaluator, FunctionRegistryObject } from '../types/functions.type'
import { GeneratorBuilder } from '../builders/GeneratorBuilder'
import { FunctionType } from '../types/enums'
import type { EffectFunctionContext } from '../../engine/nodes/expressions/effect/EffectFunctionContext'
import {
  ConditionFunctionExpr,
  EffectFunctionExpr,
  TransformerFunctionExpr,
  ValueExpr,
} from '../types/expressions.type'

type NoDeps = Record<string, never>

type FunctionShapeMap = Record<string, FunctionEvaluator<unknown>>
type PublicFunctionArguments<TFunction> = TFunction extends (...args: infer TArgs) => unknown ? TArgs : never
type ConditionFunctionGroup<TConditions> = {
  [K in keyof TConditions]: (...args: never[]) => ConditionFunctionExpr<ValueExpr[]>
}
type TransformerFunctionGroup<TTransformers> = {
  [K in keyof TTransformers]: (...args: never[]) => TransformerFunctionExpr<ValueExpr[]>
}
type EffectFunctionGroup<TEffects> = {
  [K in keyof TEffects]: (...args: never[]) => EffectFunctionExpr<ValueExpr[]>
}
type GeneratorFunctionGroup<TGenerators> = {
  [K in keyof TGenerators]: (...args: never[]) => unknown
}

export type FunctionImplementations<TShapes extends FunctionShapeMap, TDeps = NoDeps> = {
  [K in keyof TShapes]: (deps: TDeps) => TShapes[K]
}

type ConditionImplementationShapes<TConditions extends ConditionFunctionGroup<TConditions>> = {
  [K in keyof TConditions]: (
    value: unknown,
    ...args: PublicFunctionArguments<TConditions[K]>
  ) => boolean | Promise<boolean>
}

type TransformerImplementationShapes<TTransformers extends TransformerFunctionGroup<TTransformers>> = {
  [K in keyof TTransformers]: (
    value: unknown,
    ...args: PublicFunctionArguments<TTransformers[K]>
  ) => ValueExpr | Promise<ValueExpr>
}

type EffectImplementationShapes<TEffects extends EffectFunctionGroup<TEffects>> = {
  [K in keyof TEffects]: (
    context: EffectFunctionContext,
    ...args: PublicFunctionArguments<TEffects[K]>
  ) => void | Promise<void>
}

type GeneratorImplementationShapes<TGenerators extends GeneratorFunctionGroup<TGenerators>> = {
  [K in keyof TGenerators]: (...args: PublicFunctionArguments<TGenerators[K]>) => ValueExpr | Promise<ValueExpr>
}

export type ConditionImplementations<
  TConditions extends ConditionFunctionGroup<TConditions>,
  TDeps = NoDeps,
> = FunctionImplementations<ConditionImplementationShapes<TConditions>, TDeps>

export type TransformerImplementations<
  TTransformers extends TransformerFunctionGroup<TTransformers>,
  TDeps = NoDeps,
> = FunctionImplementations<TransformerImplementationShapes<TTransformers>, TDeps>

export type EffectImplementations<
  TEffects extends EffectFunctionGroup<TEffects>,
  TDeps = NoDeps,
> = FunctionImplementations<EffectImplementationShapes<TEffects>, TDeps>

export type GeneratorImplementations<
  TGenerators extends GeneratorFunctionGroup<TGenerators>,
  TDeps = NoDeps,
> = FunctionImplementations<GeneratorImplementationShapes<TGenerators>, TDeps>

type ReferenceArguments<TFunction extends FunctionEvaluator<unknown>> =
  Parameters<TFunction> extends [unknown, ...infer TRest] ? TRest : []

type ValueArguments<TFunction extends FunctionEvaluator<unknown>> =
  ReferenceArguments<TFunction> extends ValueExpr[] ? ReferenceArguments<TFunction> : never

type GeneratorArguments<TFunction extends FunctionEvaluator<unknown>> =
  Parameters<TFunction> extends ValueExpr[] ? Parameters<TFunction> : never

export interface FunctionReference<TArguments extends unknown[] = unknown[]> {
  name: string
  arguments: TArguments
}

export type FunctionReferences<TShapes extends FunctionShapeMap> = {
  [K in keyof TShapes]: (
    ...args: ReferenceArguments<TShapes[K]>
  ) => FunctionReference<ReferenceArguments<TShapes[K]>> & { name: Extract<K, string> }
}

export interface DefinedFunctionSet<TShapes extends FunctionShapeMap, TDeps = NoDeps> {
  references: FunctionReferences<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
}

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

function isAsyncFunction(fn: FunctionEvaluator<unknown>): boolean {
  return fn.constructor.name === 'AsyncFunction'
}

type TypedFunctionBuilders<
  TShapes extends FunctionShapeMap,
  TExpression extends ConditionFunctionExpr<any> | TransformerFunctionExpr<any> | EffectFunctionExpr<any>,
> = {
  [K in keyof TShapes]: (...args: ValueArguments<TShapes[K]>) => TExpression
}

function createTypedFunctionBuilders<
  TShapes extends FunctionShapeMap,
  TType extends FunctionType.CONDITION | FunctionType.TRANSFORMER | FunctionType.EFFECT,
>(
  references: FunctionReferences<TShapes>,
  functionType: TType,
): TypedFunctionBuilders<
  TShapes,
  TType extends FunctionType.CONDITION
    ? ConditionFunctionExpr<any>
    : TType extends FunctionType.TRANSFORMER
      ? TransformerFunctionExpr<any>
      : EffectFunctionExpr<any>
> {
  const functions = {} as TypedFunctionBuilders<
    TShapes,
    TType extends FunctionType.CONDITION
      ? ConditionFunctionExpr<any>
      : TType extends FunctionType.TRANSFORMER
        ? TransformerFunctionExpr<any>
        : EffectFunctionExpr<any>
  >

  Object.keys(references).forEach(name => {
    const key = name as keyof TShapes & string

    functions[key] = ((...args: ValueArguments<TShapes[typeof key]>) => ({
      type: functionType,
      name,
      arguments: args,
    })) as TypedFunctionBuilders<
      TShapes,
      TType extends FunctionType.CONDITION
        ? ConditionFunctionExpr<any>
        : TType extends FunctionType.TRANSFORMER
          ? TransformerFunctionExpr<any>
          : EffectFunctionExpr<any>
    >[typeof key]
  })

  return functions
}

function createGeneratorFunctionBuilders<TShapes extends FunctionShapeMap, TDeps>(
  implementations: FunctionImplementations<TShapes, TDeps>,
): GeneratorFunctions<TShapes> {
  const generators = {} as GeneratorFunctions<TShapes>

  Object.keys(implementations).forEach(name => {
    const key = name as keyof TShapes & string

    generators[key] = ((...args: GeneratorArguments<TShapes[typeof key]>) => {
      return GeneratorBuilder.create(name, args)
    }) as GeneratorFunctions<TShapes>[typeof key]
  })

  return generators
}

/**
 * Creates a matched pair of:
 * - reference builders that omit the evaluator's first runtime argument
 * - implementation entries ready for registration
 *
 * This is useful when authoring references should only expose configuration
 * arguments while runtime evaluators still receive their full signature.
 */
export function defineFunction<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): DefinedFunctionSet<TShapes, TDeps> {
  const references = {} as FunctionReferences<TShapes>
  const implementations = {} as FunctionImplementations<TShapes, TDeps>

  Object.keys(factories).forEach(name => {
    const key = name as keyof TShapes & string

    references[key] = ((...args: ReferenceArguments<TShapes[typeof key]>) => ({
      name,
      arguments: args,
    })) as FunctionReferences<TShapes>[typeof key]

    implementations[key] = factories[key]
  })

  return { references, implementations }
}

export function createFunctionsRegistry(
  implementations: FunctionImplementations<FunctionShapeMap, NoDeps>,
): FunctionRegistryObject
export function createFunctionsRegistry<TDeps>(
  implementations: FunctionImplementations<FunctionShapeMap, TDeps>,
  deps: TDeps,
): FunctionRegistryObject
export function createFunctionsRegistry<TDeps>(
  implementations: FunctionImplementations<FunctionShapeMap, TDeps>,
  deps?: TDeps,
): FunctionRegistryObject {
  const resolvedDeps = (deps ?? {}) as TDeps
  const registry = {} as FunctionRegistryObject

  Object.keys(implementations).forEach(name => {
    const evaluate = implementations[name](resolvedDeps)

    registry[name] = {
      name,
      evaluate,
      isAsync: isAsyncFunction(evaluate),
    }
  })

  return registry
}

export function defineConditionFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  conditions: ConditionFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
}
export function defineConditionFunctions<TConditions extends ConditionFunctionGroup<TConditions>, TDeps = NoDeps>(
  factories: ConditionImplementations<TConditions, TDeps>,
): {
  conditions: TConditions
  implementations: ConditionImplementations<TConditions, TDeps>
}
export function defineConditionFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  conditions: ConditionFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
} {
  const { references, implementations } = defineFunction<TShapes, TDeps>(factories)
  const conditions = createTypedFunctionBuilders(references, FunctionType.CONDITION) as ConditionFunctions<TShapes>

  return { conditions, implementations }
}

export function defineTransformerFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  transformers: TransformerFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
}
export function defineTransformerFunctions<
  TTransformers extends TransformerFunctionGroup<TTransformers>,
  TDeps = NoDeps,
>(
  factories: TransformerImplementations<TTransformers, TDeps>,
): {
  transformers: TTransformers
  implementations: TransformerImplementations<TTransformers, TDeps>
}
export function defineTransformerFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  transformers: TransformerFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
} {
  const { references, implementations } = defineFunction<TShapes, TDeps>(factories)
  const transformers = createTypedFunctionBuilders(
    references,
    FunctionType.TRANSFORMER,
  ) as TransformerFunctions<TShapes>

  return { transformers, implementations }
}

export function defineEffectFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  effects: EffectFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
}
export function defineEffectFunctions<TEffects extends EffectFunctionGroup<TEffects>, TDeps = NoDeps>(
  factories: EffectImplementations<TEffects, TDeps>,
): {
  effects: TEffects
  implementations: EffectImplementations<TEffects, TDeps>
}
export function defineEffectFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  effects: EffectFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
} {
  const { references, implementations } = defineFunction<TShapes, TDeps>(factories)
  const effects = createTypedFunctionBuilders(references, FunctionType.EFFECT) as EffectFunctions<TShapes>

  return { effects, implementations }
}

export function defineGeneratorFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  generators: GeneratorFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
}
export function defineGeneratorFunctions<TGenerators extends GeneratorFunctionGroup<TGenerators>, TDeps = NoDeps>(
  factories: GeneratorImplementations<TGenerators, TDeps>,
): {
  generators: TGenerators
  implementations: GeneratorImplementations<TGenerators, TDeps>
}
export function defineGeneratorFunctions<TShapes extends FunctionShapeMap, TDeps = NoDeps>(
  factories: FunctionImplementations<TShapes, TDeps>,
): {
  generators: GeneratorFunctions<TShapes>
  implementations: FunctionImplementations<TShapes, TDeps>
} {
  const { implementations } = defineFunction<TShapes, TDeps>(factories)
  const generators = createGeneratorFunctionBuilders(implementations)

  return { generators, implementations }
}
