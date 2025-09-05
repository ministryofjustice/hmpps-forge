import { z } from 'zod'
import { FunctionType } from '@form-engine/form/types/enums'

/**
 * Simple ValueExpr for function arguments
 * This is a simplified version used only in function schemas
 */
const FunctionArgumentSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(FunctionArgumentSchema),
    z.record(z.string(), z.any()),
  ]),
)

/**
 * @see {@link ConditionFunctionExpr}
 */
export const ConditionFunctionExprSchema = z.object({
  type: z.literal(FunctionType.CONDITION),
  name: z.string(),
  arguments: z.array(FunctionArgumentSchema),
})

/**
 * @see {@link TransformerFunctionExpr}
 */
export const TransformerFunctionExprSchema = z.object({
  type: z.literal(FunctionType.TRANSFORMER),
  name: z.string(),
  arguments: z.array(FunctionArgumentSchema),
})

/**
 * @see {@link EffectFunctionExpr}
 */
export const EffectFunctionExprSchema = z.object({
  type: z.literal(FunctionType.EFFECT),
  name: z.string(),
  arguments: z.array(FunctionArgumentSchema),
})

/**
 * @see {@link FunctionExpr}
 */
export const FunctionExprSchema = z.union([
  ConditionFunctionExprSchema,
  TransformerFunctionExprSchema,
  EffectFunctionExprSchema,
])
