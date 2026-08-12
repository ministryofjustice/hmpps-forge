import { z } from 'zod'
import { PredicateType, ExpressionType, OutcomeType, ConditionCombinatorType } from '../../../../authoring/types/enums'
import { ResolvableValueSchema } from './expressions.schema'
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
const PredicateTestExprSchema = z.object({
  type: z.literal(PredicateType.TEST),
  subject: ResolvableValueSchema,
  negate: z.boolean(),
  condition: ConditionFunctionExprSchema,
})

/**
 * @see {@link PredicateAndExpr}
 */
const PredicateAndExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(PredicateType.AND),
  operands: z.array(PredicateExprSchema).min(2),
})

/**
 * @see {@link PredicateOrExpr}
 */
const PredicateOrExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(PredicateType.OR),
  operands: z.array(PredicateExprSchema).min(2),
})

/**
 * @see {@link PredicateXorExpr}
 */
const PredicateXorExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(PredicateType.XOR),
  operands: z.array(PredicateExprSchema).min(2),
})

/**
 * @see {@link PredicateNotExpr}
 */
const PredicateNotExprSchema: z.ZodType<any> = z.looseObject({
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
    thenValue: ResolvableValueSchema.optional(),
    elseValue: ResolvableValueSchema.optional(),
  }),
)

/**
 * @see {@link ConditionBranchExpr}
 */
const ConditionBranchExprSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    ConditionFunctionExprSchema,
    ConditionAndExprSchema,
    ConditionOrExprSchema,
    ConditionXorExprSchema,
    ConditionNotExprSchema,
  ]),
)

/**
 * @see {@link ConditionAndExpr}
 */
const ConditionAndExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(ConditionCombinatorType.AND),
  operands: z.array(ConditionBranchExprSchema).min(2),
})

/**
 * @see {@link ConditionOrExpr}
 */
const ConditionOrExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(ConditionCombinatorType.OR),
  operands: z.array(ConditionBranchExprSchema).min(2),
})

/**
 * @see {@link ConditionXorExpr}
 */
const ConditionXorExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(ConditionCombinatorType.XOR),
  operands: z.array(ConditionBranchExprSchema).min(2),
})

/**
 * @see {@link ConditionNotExpr}
 */
export const ConditionNotExprSchema: z.ZodType<any> = z.looseObject({
  type: z.literal(ConditionCombinatorType.NOT),
  operand: ConditionBranchExprSchema,
})

/**
 * @see {@link MatchBranch}
 */
export const MatchBranchSchema = z.object({
  condition: ConditionBranchExprSchema,
  value: ResolvableValueSchema,
})

/**
 * @see {@link MatchExpr}
 */
export const MatchExprSchema = z.lazy(() =>
  z.object({
    type: z.literal(ExpressionType.MATCH),
    subject: ResolvableValueSchema,
    branches: z.array(MatchBranchSchema).min(1),
    otherwise: ResolvableValueSchema.optional(),
  }),
)

/**
 * @see {@link RedirectOutcome}
 */
const RedirectOutcomeSchema = z.object({
  type: z.literal(OutcomeType.REDIRECT),
  when: PredicateExprSchema.optional(),
  goto: z.union([z.string(), ResolvableValueSchema]),
})

/**
 * @see {@link ThrowErrorOutcome}
 */
const ThrowErrorOutcomeSchema = z.object({
  type: z.literal(OutcomeType.THROW_ERROR),
  when: PredicateExprSchema.optional(),
  status: z.number().int().min(100).max(599),
  message: z.union([z.string(), ResolvableValueSchema]),
})

/**
 * @see {@link HookOutcome}
 */
export const HookOutcomeSchema = z.discriminatedUnion('type', [RedirectOutcomeSchema, ThrowErrorOutcomeSchema])
