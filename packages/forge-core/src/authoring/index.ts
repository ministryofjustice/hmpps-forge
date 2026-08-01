export * from './builders'
export { Condition, ConditionsRegistry } from './conditions'
export { Generator, GeneratorsRegistry } from './generators'
export { Transformer, TransformersRegistry } from './transformers'

export { BaseFunctionRegistry } from './registries/BaseFunctionRegistry'
export { default as ConditionRegistry } from './registries/ConditionRegistry'
export { default as TransformerRegistry } from './registries/TransformerRegistry'
export { default as GeneratorRegistry } from './registries/GeneratorRegistry'
export { default as EffectRegistry } from './registries/EffectRegistry'
/** @deprecated Use BaseFunctionRegistry.build() instead */
export { createFunctionsRegistry } from './utils/deprecated/createFunctionsRegistry'
/** @deprecated Use ConditionRegistry instead */
export { defineConditionFunctions } from './utils/deprecated/defineConditionFunctions'
/** @deprecated Use EffectRegistry instead */
export { defineEffectFunctions } from './utils/deprecated/defineEffectFunctions'
/** @deprecated Use GeneratorRegistry instead */
export { defineGeneratorFunctions } from './utils/deprecated/defineGeneratorFunctions'
/** @deprecated Use TransformerRegistry instead */
export { defineTransformerFunctions } from './utils/deprecated/defineTransformerFunctions'
/** @deprecated Use ConditionRegistry/TransformerRegistry/EffectRegistry/GeneratorRegistry inline instead */
export { createFunctionScope, type FunctionScope } from './utils/deprecated/createFunctionScope'
export type { FunctionImplementations, FunctionShapeMap } from './utils/deprecated/defineFunction.type'

export { EffectFunctionContext } from '../engine/runtime/evaluation/context/EffectFunctionContext'

export { StructureType, BlockType, FunctionType, ExpressionType, ConditionCombinatorType } from './types/enums'
export { ConditionalExprBuilder } from './builders/ConditionalExprBuilder'
export { GeneratorBuilder } from './builders/GeneratorBuilder'
export { MatchExprBuilder } from './builders/MatchExprBuilder'

export type { ForgePackage } from './types/package.type'
export type { FunctionEvaluator, FunctionRegistryEntry, FunctionRegistryObject } from './types/functions.type'
export type {
  JourneyDefinition,
  JourneyReachability,
  StepReachability,
  StepDefinition,
  TieBreaker,
  TieBreakerProps,
  UnreachableRedirectTarget,
  ValidationExpr,
  ValidationProps,
  ViewConfig,
} from './types/structures.type'
export type {
  AccessHook,
  ConditionalExpr,
  ConditionAndExpr,
  ConditionBranchExpr,
  ConditionCombinatorExpr,
  ConditionFunctionExpr,
  ConditionNotExpr,
  ConditionOrExpr,
  ConditionXorExpr,
  EffectFunctionExpr,
  FunctionExpr,
  GeneratorFunctionExpr,
  IterateExpr,
  MatchExpr,
  PipelineExpr,
  PredicateExpr,
  ReferenceExpr,
  SubmitHook,
  TransformerFunctionExpr,
  ResolvableValue,
} from './types/expressions.type'
