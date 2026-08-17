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

/**
 * @see {@link IteratorConfig}
 */
const IteratorConfigSchema = z.union([MapIteratorConfigSchema, FilterIteratorConfigSchema, FindIteratorConfigSchema])

/**
 * @see {@link IterateExpr}
 */
export const IterateExprSchema = z.looseObject({
  type: z.literal(ExpressionType.ITERATE),
  input: ResolvableValueSchema,
  iterator: IteratorConfigSchema,
})
