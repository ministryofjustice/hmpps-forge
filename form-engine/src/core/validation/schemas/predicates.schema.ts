import { z } from 'zod'
import { LogicType, ExpressionType } from '@form-engine/form/types/enums'
import { ValueExprSchema, FormatExprSchema } from './expressions.schema'
import { ConditionFunctionExprSchema } from './base.schema'

/**
 * @see {@link PredicateExpr}
 */
export const PredicateExprSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    PredicateTestExprSchema,
    PredicateAndExprSchema,
    PredicateOrExprSchema,
    PredicateXorExprSchema,
    PredicateNotExprSchema,
  ]),
)

/**
 * @see {@link PredicateTestExpr}
 */
export const PredicateTestExprSchema = z.object({
  type: z.literal(LogicType.TEST),
  subject: ValueExprSchema,
  negate: z.boolean(),
  condition: ConditionFunctionExprSchema,
})

/**
 * @see {@link PredicateAndExpr}
 */
export const PredicateAndExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(LogicType.AND),
  operands: z.array(PredicateExprSchema).min(2),
})

/**
 * @see {@link PredicateOrExpr}
 */
export const PredicateOrExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(LogicType.OR),
  operands: z.array(PredicateExprSchema).min(2),
})

/**
 * @see {@link PredicateXorExpr}
 */
export const PredicateXorExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(LogicType.XOR),
  operands: z.array(PredicateExprSchema).min(2),
})

/**
 * @see {@link PredicateNotExpr}
 */
export const PredicateNotExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(LogicType.NOT),
  operand: PredicateExprSchema,
})

/**
 * @see {@link ConditionalExpr}
 */
export const ConditionalExprSchema = z.lazy(() =>
  z.object({
    type: z.literal(LogicType.CONDITIONAL),
    predicate: PredicateExprSchema,
    thenValue: ValueExprSchema.optional(),
    elseValue: ValueExprSchema.optional(),
  }),
)

/**
 * @see {@link NextExpr}
 */
export const NextExprSchema = z.object({
  type: z.literal(ExpressionType.NEXT),
  when: PredicateExprSchema.optional(),
  goto: z.union([z.string(), FormatExprSchema]),
})
