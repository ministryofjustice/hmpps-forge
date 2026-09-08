import { z } from 'zod'
import { ExpressionType, IteratorType } from '../../../../shared/taxonomy'
import { TransformerFunctionExprSchema, GeneratorFunctionExprSchema } from './base.schema'

/**
 * @see {@link ResolvableValue}
 */
export const ResolvableValueSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    ReferenceExprSchema,
    TransformerFunctionExprSchema,
    GeneratorFunctionExprSchema,
    PipelineExprSchema,
    IterateExprSchema,
    NullishExprSchema,
    z.array(ResolvableValueSchema),
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(z.string(), z.any()),
  ]),
)

/**
 * @see {@link ReferenceExpr}
 */
export const ReferenceExprSchema = z.looseObject({
  _forge: z.literal(ExpressionType.REFERENCE),
  path: z.array(z.string()),
})

/**
 * @see {@link PipelineExpr}
 */
export const PipelineExprSchema = z.looseObject({
  _forge: z.literal(ExpressionType.PIPELINE),
  input: ResolvableValueSchema,
  steps: z.array(TransformerFunctionExprSchema),
})

/**
 * @see {@link MapIteratorConfig}
 */
const MapIteratorConfigSchema = z.looseObject({
  _forge: z.literal(IteratorType.MAP),
  yield: z.any(),
})

/**
 * @see {@link FilterIteratorConfig}
 */
const FilterIteratorConfigSchema = z.looseObject({
  _forge: z.literal(IteratorType.FILTER),
  predicate: z.any(),
})

/**
 * @see {@link FindIteratorConfig}
 */
const FindIteratorConfigSchema = z.looseObject({
  _forge: z.literal(IteratorType.FIND),
  predicate: z.any(),
})

export const SomeIteratorConfigSchema = z.looseObject({
  _forge: z.literal(IteratorType.SOME),
  predicate: z.unknown(),
})

export const EveryIteratorConfigSchema = z.looseObject({
  _forge: z.literal(IteratorType.EVERY),
  predicate: z.unknown(),
})

const CountIteratorConfigSchema = z.looseObject({
  _forge: z.literal(IteratorType.COUNT),
  predicate: z.unknown(),
})

/**
 * @see {@link IteratorConfig}
 */
const IteratorConfigSchema = z.discriminatedUnion('_forge', [
  MapIteratorConfigSchema,
  FilterIteratorConfigSchema,
  FindIteratorConfigSchema,
  SomeIteratorConfigSchema,
  EveryIteratorConfigSchema,
  CountIteratorConfigSchema,
])

/**
 * @see {@link IterateExpr}
 */
export const IterateExprSchema = z.looseObject({
  _forge: z.literal(ExpressionType.ITERATE),
  input: ResolvableValueSchema,
  iterator: IteratorConfigSchema,
})

/** @see {@link NullishExpr} */
export const NullishExprSchema = z.looseObject({
  _forge: z.literal(ExpressionType.NULLISH),
  input: ResolvableValueSchema.optional(),
  fallback: ResolvableValueSchema.optional(),
})
