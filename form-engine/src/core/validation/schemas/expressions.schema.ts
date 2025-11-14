import { z } from 'zod'
import { ExpressionType } from '@form-engine/form/types/enums'
import { TransformerFunctionExprSchema } from './base.schema'

/**
 * @see {@link ValueExpr}
 */
export const ValueExprSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    ReferenceExprSchema,
    FormatExprSchema,
    TransformerFunctionExprSchema,
    PipelineExprSchema,
    CollectionExprSchema,
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
 * @see {@link CollectionExpr}
 */
export const CollectionExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(ExpressionType.COLLECTION),
  collection: z.union([ReferenceExprSchema, PipelineExprSchema, z.array(z.any())]),
  template: z.array(z.any()),
  fallback: z.array(z.any()).optional(),
})
