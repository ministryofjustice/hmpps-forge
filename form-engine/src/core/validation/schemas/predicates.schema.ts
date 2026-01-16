import { z } from 'zod'
import { PredicateType, ExpressionType, OutcomeType } from '@form-engine/form/types/enums'
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
  type: z.literal(PredicateType.TEST),
  subject: ValueExprSchema,
  negate: z.boolean(),
  condition: ConditionFunctionExprSchema,
})

/**
 * @see {@link PredicateAndExpr}
 */
export const PredicateAndExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(PredicateType.AND),
  operands: z.array(PredicateExprSchema).min(2),
})

/**
 * @see {@link PredicateOrExpr}
 */
export const PredicateOrExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(PredicateType.OR),
  operands: z.array(PredicateExprSchema).min(2),
})

/**
 * @see {@link PredicateXorExpr}
 */
export const PredicateXorExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(PredicateType.XOR),
  operands: z.array(PredicateExprSchema).min(2),
})

/**
 * @see {@link PredicateNotExpr}
 */
export const PredicateNotExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(PredicateType.NOT),
  operand: PredicateExprSchema,
})

/**
 * @see {@link ConditionalExpr}
 */
export const ConditionalExprSchema = z.lazy(() =>
  z.object({
    type: z.literal(ExpressionType.CONDITIONAL),
    predicate: PredicateExprSchema,
    thenValue: ValueExprSchema.optional(),
    elseValue: ValueExprSchema.optional(),
  }),
)

/**
 * @see {@link NextExpr}
 * @deprecated Use RedirectOutcomeSchema instead
 */
export const NextExprSchema = z.object({
  type: z.literal(ExpressionType.NEXT),
  when: PredicateExprSchema.optional(),
  goto: z.union([z.string(), FormatExprSchema]),
})

/**
 * @see {@link RedirectOutcome}
 */
export const RedirectOutcomeSchema = z.object({
  type: z.literal(OutcomeType.REDIRECT),
  when: PredicateExprSchema.optional(),
  goto: z.union([z.string(), FormatExprSchema, ValueExprSchema]),
})

/**
 * @see {@link ThrowErrorOutcome}
 */
export const ThrowErrorOutcomeSchema = z.object({
  type: z.literal(OutcomeType.THROW_ERROR),
  when: PredicateExprSchema.optional(),
  status: z.number().int().min(100).max(599),
  message: z.union([z.string(), FormatExprSchema, ValueExprSchema]),
})

/**
 * @see {@link TransitionOutcome}
 */
export const TransitionOutcomeSchema = z.discriminatedUnion('type', [RedirectOutcomeSchema, ThrowErrorOutcomeSchema])
