import { z } from 'zod'
import { FunctionCallType } from '../../../../authoring/types/enums'

/**
 * Simple ResolvableValue for function arguments
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
  type: z.literal(FunctionCallType.CONDITION),
  name: z.string().trim().min(1),
  arguments: z.array(FunctionArgumentSchema),
})

/**
 * @see {@link TransformerFunctionExpr}
 */
export const TransformerFunctionExprSchema = z.object({
  type: z.literal(FunctionCallType.TRANSFORMER),
  name: z.string().trim().min(1),
  arguments: z.array(FunctionArgumentSchema),
})

/**
 * @see {@link EffectFunctionExpr}
 */
export const EffectFunctionExprSchema = z.object({
  type: z.literal(FunctionCallType.EFFECT),
  name: z.string().trim().min(1),
  arguments: z.array(FunctionArgumentSchema),
})

/**
 * @see {@link GeneratorFunctionExpr}
 */
export const GeneratorFunctionExprSchema = z.object({
  type: z.literal(FunctionCallType.GENERATOR),
  name: z.string().trim().min(1),
  arguments: z.array(FunctionArgumentSchema),
})

/**
 * @see {@link FunctionExpr}
 */
export const FunctionExprSchema = z.union([
  ConditionFunctionExprSchema,
  TransformerFunctionExprSchema,
  EffectFunctionExprSchema,
  GeneratorFunctionExprSchema,
])
