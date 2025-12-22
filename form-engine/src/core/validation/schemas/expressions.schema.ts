import { z } from 'zod'
import { ExpressionType, IteratorType } from '@form-engine/form/types/enums'
import { TransformerFunctionExprSchema, GeneratorFunctionExprSchema } from './base.schema'

/**
 * @see {@link ValueExpr}
 */
export const ValueExprSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    ReferenceExprSchema,
    FormatExprSchema,
    TransformerFunctionExprSchema,
    GeneratorFunctionExprSchema,
    PipelineExprSchema,
    IterateExprSchema,
    z.array(ValueExprSchema),
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
 * @see {@link FormatExpr}
 */
export const FormatExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(ExpressionType.FORMAT),
  template: z.string(),
  arguments: z.array(ValueExprSchema),
})

/**
 * @see {@link PipelineExpr}
 */
export const PipelineExprSchema = z.looseObject({
  type: z.literal(ExpressionType.PIPELINE),
  input: ValueExprSchema,
  steps: z.array(TransformerFunctionExprSchema),
})

/**
 * @see {@link MapIteratorConfig}
 */
export const MapIteratorConfigSchema = z.looseObject({
  type: z.literal(IteratorType.MAP),
  yield: z.any(),
})

/**
 * @see {@link FilterIteratorConfig}
 */
export const FilterIteratorConfigSchema = z.looseObject({
  type: z.literal(IteratorType.FILTER),
  predicate: z.any(),
})

/**
 * @see {@link FindIteratorConfig}
 */
export const FindIteratorConfigSchema = z.looseObject({
  type: z.literal(IteratorType.FIND),
  predicate: z.any(),
})

/**
 * @see {@link IteratorConfig}
 */
export const IteratorConfigSchema = z.union([
  MapIteratorConfigSchema,
  FilterIteratorConfigSchema,
  FindIteratorConfigSchema,
])

/**
 * @see {@link IterateExpr}
 */
export const IterateExprSchema: z.ZodType<any> = z.lazy(() =>
  z.looseObject({
    type: z.literal(ExpressionType.ITERATE),
    input: ValueExprSchema,
    iterator: IteratorConfigSchema,
  }),
)
