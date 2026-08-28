import { z } from 'zod'
import { ComponentCallType, ExpressionType, HookType, PolicyType, StructureType } from '../../../../shared/taxonomy'
import { ReferenceExprSchema, PipelineExprSchema, IterateExprSchema, ResolvableValueSchema } from './expressions.schema'
import { PredicateExprSchema, ConditionalExprSchema, MatchExprSchema, HookOutcomeSchema } from './predicates.schema'
import {
  TransformerFunctionExprSchema,
  GeneratorFunctionExprSchema,
  FunctionExprSchema,
  EffectFunctionExprSchema,
} from './base.schema'

/**
 * @see {@link ViewConfig}
 */
const ViewConfigSchema = z.object({
  template: z.string().optional(),
  locals: z.record(z.string(), z.unknown()).optional(),
})

const StaticDataValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(StaticDataValueSchema),
      z.record(z.string(), StaticDataValueSchema),
    ])
    .superRefine((value, ctx) => {
      if (value === null || Array.isArray(value) || typeof value !== 'object') {
        return
      }

      if (!('_forge' in value)) {
        return
      }

      ctx.addIssue({
        code: 'custom',
        message: 'Forge expressions are not supported in static data',
      })
    }),
)

const StaticDataSchema = z.record(z.string(), StaticDataValueSchema)

// TODO: Probably should add resolvable schemas for the remaining value shapes, such as numbers, arrays, and objects.
/**
 * @see {@link ResolvableString}
 */
const ResolvableStringSchema = z.union([
  z.string(),
  ReferenceExprSchema,
  GeneratorFunctionExprSchema,
  PipelineExprSchema,
  ConditionalExprSchema,
  MatchExprSchema,
])

/**
 * @see {@link ResolvableBoolean}
 */
const ResolvableBooleanSchema = z.union([
  z.boolean(),
  PredicateExprSchema,
  ReferenceExprSchema,
  GeneratorFunctionExprSchema,
  PipelineExprSchema,
  ConditionalExprSchema,
  MatchExprSchema,
])

/**
 * @see {@link RouteMetadata}
 */
const RouteMetadataSchema = z.record(z.string(), ResolvableValueSchema.optional())

/**
 * @see {@link ValidationExpr}
 */
const ValidationExecutionSchema = {
  _forge: z.literal(PolicyType.VALIDATION_RULE),
  submissionOnly: z.boolean().optional(),
  groups: z.array(z.string().trim().min(1)).optional(),
}

const ValidationExprSchema = z
  .looseObject({
    ...ValidationExecutionSchema,
    condition: PredicateExprSchema.optional(),
    message: ResolvableStringSchema.optional(),
    details: z.record(z.string(), z.any()).optional(),
    function: GeneratorFunctionExprSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const hasFunction = value.function !== undefined
    const hasConditionProperties =
      value.condition !== undefined || value.message !== undefined || value.details !== undefined

    if (hasFunction && hasConditionProperties) {
      ctx.addIssue({
        code: 'custom',
        path: ['function'],
        message: 'Validation must define either condition and message or function, not both',
      })

      return
    }

    if (hasFunction) {
      return
    }

    if (value.condition === undefined) {
      ctx.addIssue({ code: 'custom', path: ['condition'], message: 'Condition-backed validation requires condition' })
    }

    if (value.message === undefined) {
      ctx.addIssue({ code: 'custom', path: ['message'], message: 'Condition-backed validation requires message' })
    }
  })

const ValidWhenItemSchema = z.discriminatedUnion('_forge', [ValidationExprSchema, IterateExprSchema])
const ValidWhenSchema = z.preprocess(value => {
  if (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as { _forge?: unknown })._forge === ExpressionType.ITERATE
  ) {
    return [value]
  }

  return value
}, z.array(ValidWhenItemSchema))

/**
 * @see {@link BlockDefinition}
 */
const BlockSchema: z.ZodType<any> = z.lazy(() => {
  const baseBlock = z.looseObject({
    variant: z.string(),
    visibleWhen: ResolvableBooleanSchema.optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })

  const fieldBlockProps = z.looseObject({
    code: ResolvableStringSchema,
    defaultValue: z.union([ResolvableStringSchema, z.array(ResolvableStringSchema), FunctionExprSchema]).optional(),
    formatters: z.array(TransformerFunctionExprSchema).optional(),
    parsers: z.array(TransformerFunctionExprSchema).optional(),
    errors: z
      .array(
        z.object({
          message: z.string().trim().min(1, { message: 'Validation message must not be empty' }),
          details: z.record(z.string(), z.any()).optional(),
        }),
      )
      .optional(),
    validWhen: ValidWhenSchema.optional(),
    dependentWhen: PredicateExprSchema.optional(),
  })

  const fieldBlock = baseBlock.extend({
    _forge: z.literal(ComponentCallType.FIELD),
    ...fieldBlockProps.shape,
  })

  const basicBlock = baseBlock.extend({
    _forge: z.literal(ComponentCallType.BASIC),
  })

  return z.discriminatedUnion('_forge', [fieldBlock, basicBlock])
})

/**
 * @see {@link AccessHook}
 *
 * Access hooks handle access control, data loading, and outcomes.
 * All properties except `_forge` are optional.
 */
const AccessHookSchema = z.object({
  _forge: z.literal(HookType.ACCESS),
  when: PredicateExprSchema.optional(),
  effects: z.array(EffectFunctionExprSchema).optional(),
  next: z.array(HookOutcomeSchema).optional(),
})

/**
 * @see {@link SubmitHook}
 */
const SubmitHookSchema = z.object({
  _forge: z.literal(HookType.SUBMIT),
  when: PredicateExprSchema.optional(),
  guards: PredicateExprSchema.optional(),
  validate: z
    .union([
      z.boolean(),
      z.object({
        groups: z.array(z.string().trim().min(1)).min(1),
      }),
    ])
    .optional(),
  onAlways: z
    .object({
      effects: z.array(EffectFunctionExprSchema).optional(),
      next: z.array(HookOutcomeSchema).optional(),
    })
    .optional(),
  onValid: z
    .object({
      effects: z.array(EffectFunctionExprSchema).optional(),
      next: z.array(HookOutcomeSchema).optional(),
    })
    .optional(),
  onInvalid: z
    .object({
      effects: z.array(EffectFunctionExprSchema).optional(),
      next: z.array(HookOutcomeSchema).optional(),
    })
    .optional(),
})

const TieBreakerSchema = z.looseObject({
  _forge: z.literal(PolicyType.NAVIGATION_TIE_BREAKER),
  priority: z.number(),
  when: PredicateExprSchema.optional(),
})

const StepReachabilitySchema = z
  .object({
    entryWhen: ResolvableBooleanSchema.optional(),
    tieBreakers: z.array(TieBreakerSchema).optional(),
  })
  .optional()

const StepEntryValidationSchema = z.object({
  groups: z.array(z.string().trim().min(1)).min(1),
  when: ResolvableBooleanSchema,
})

const JourneyReachabilitySchema = z
  .object({
    resumeWhen: ResolvableBooleanSchema.optional(),
    unreachableRedirect: z.enum(['entry', 'frontier']).optional(),
    disableReachabilityChecks: z.boolean().optional(),
  })
  .optional()

/**
 * @see {@link StepDefinition}
 */
const StepSchema = z.looseObject({
  _forge: z.literal(StructureType.STEP),
  path: z.string(),
  blocks: z.array(BlockSchema).optional(),
  onAccess: z.array(AccessHookSchema).optional(),
  onSubmission: z.array(SubmitHookSchema).optional(),
  validateOnEntry: z.array(StepEntryValidationSchema).optional(),
  title: ResolvableStringSchema,
  description: ResolvableStringSchema.optional(),
  view: ViewConfigSchema.optional(),
  reachability: StepReachabilitySchema,
  backlink: z.string().optional(),
  metadata: RouteMetadataSchema.optional(),
  data: StaticDataSchema.optional(),
  validWhen: ValidWhenSchema.optional(),
})

/**
 * @see {@link JourneyDefinition}
 */
export const JourneySchema: z.ZodType<any> = z.lazy(() =>
  z.looseObject({
    _forge: z.literal(StructureType.JOURNEY),
    path: z.string(),
    code: z.string(),
    onAccess: z.array(AccessHookSchema).optional(),
    steps: z.array(StepSchema).optional(),
    children: z.array(JourneySchema).optional(),
    title: ResolvableStringSchema,
    description: ResolvableStringSchema.optional(),
    view: ViewConfigSchema.optional(),
    metadata: RouteMetadataSchema.optional(),
    data: StaticDataSchema.optional(),
    reachability: JourneyReachabilitySchema,
  }),
)
