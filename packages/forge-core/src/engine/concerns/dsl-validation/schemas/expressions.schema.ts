import { z } from 'zod'
import { ExpressionType, IteratorType } from '../../../../authoring/types/enums'
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
    NullishExprSchema,
    IterateExprSchema,
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
  type: z.literal(ExpressionType.REFERENCE),
  path: z.array(z.string()),
})

/** Validates a lazy fallback expression. */
export const NullishExprSchema = z.looseObject({
  type: z.literal(ExpressionType.NULLISH),
  input: ResolvableValueSchema,
  fallback: ResolvableValueSchema.optional(),
})

/**
 * @see {@link PipelineExpr}
 */
export const PipelineExprSchema = z.looseObject({
  type: z.literal(ExpressionType.PIPELINE),
  input: ResolvableValueSchema,
  steps: z.array(TransformerFunctionExprSchema),
})

/**
 * @see {@link MapIteratorConfig}
 */
const MapIteratorConfigSchema = z.looseObject({
  type: z.literal(IteratorType.MAP),
  yield: z.any(),
})

/**
 * @see {@link FilterIteratorConfig}
 */
const FilterIteratorConfigSchema = z.looseObject({
  type: z.literal(IteratorType.FILTER),
  predicate: z.any(),
})

/**
 * @see {@link FindIteratorConfig}
 */
const FindIteratorConfigSchema = z.looseObject({
  type: z.literal(IteratorType.FIND),
  predicate: z.any(),
})

const SomeIteratorConfigSchema = z.looseObject({
  type: z.literal(IteratorType.SOME),
  predicate: z.unknown(),
})

const EveryIteratorConfigSchema = z.looseObject({
  type: z.literal(IteratorType.EVERY),
  predicate: z.unknown(),
})

const CountIteratorConfigSchema = z.looseObject({
  type: z.literal(IteratorType.COUNT),
  predicate: z.unknown(),
})

/**
 * @see {@link IteratorConfig}
 */
const IteratorConfigSchema = z.union([
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
  type: z.literal(ExpressionType.ITERATE),
  input: ResolvableValueSchema,
  iterator: IteratorConfigSchema,
})
