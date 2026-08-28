import { z } from 'zod'
import { FunctionCallType } from '../../../../shared/taxonomy'

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

const functionCallSchema = (tag: FunctionCallType) =>
  z.object({
    _forge: z.literal(tag),
    name: z.string().trim().min(1),
    arguments: z.array(FunctionArgumentSchema),
  })

/**
 * @see {@link ConditionFunctionExpr}
 */
export const ConditionFunctionExprSchema = functionCallSchema(FunctionCallType.CONDITION)

/**
 * @see {@link TransformerFunctionExpr}
 */
export const TransformerFunctionExprSchema = functionCallSchema(FunctionCallType.TRANSFORMER)

/**
 * @see {@link EffectFunctionExpr}
 */
export const EffectFunctionExprSchema = functionCallSchema(FunctionCallType.EFFECT)

/**
 * @see {@link GeneratorFunctionExpr}
 */
export const GeneratorFunctionExprSchema = functionCallSchema(FunctionCallType.GENERATOR)

/**
 * @see {@link FunctionExpr}
 */
export const FunctionExprSchema = z.discriminatedUnion('_forge', [
  ConditionFunctionExprSchema,
  TransformerFunctionExprSchema,
  EffectFunctionExprSchema,
  GeneratorFunctionExprSchema,
])
