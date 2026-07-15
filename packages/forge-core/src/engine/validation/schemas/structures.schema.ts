import { z } from 'zod'
import {
  BlockType,
  ExpressionType,
  FunctionType,
  HookType,
  IteratorType,
  OutcomeType,
  PredicateType,
  StructureType,
} from '../../../authoring/types/enums'
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
export const ViewConfigSchema = z.object({
  template: z.string().optional(),
  locals: z.record(z.string(), z.unknown()).optional(),
})

const staticDataDynamicMarkers = new Set<string>([
  ...Object.values(ExpressionType),
  ...Object.values(FunctionType),
  ...Object.values(HookType),
  ...Object.values(IteratorType),
  ...Object.values(OutcomeType),
  ...Object.values(PredicateType),
])

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

      const type = (value as { type?: unknown }).type

      if (typeof type !== 'string' || !staticDataDynamicMarkers.has(type)) {
        return
      }

      ctx.addIssue({
        code: 'custom',
        message: 'Forge expressions are not supported in static data',
      })
    }),
)

const StaticDataSchema = z.record(z.string(), StaticDataValueSchema)

// TODO: Probably should add the remaining resolvable schemas, such as ResolvableNumber/Array/Object.
/**
 * @see {@link ResolvableString}
 */
export const ResolvableStringSchema = z.union([
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
export const ResolvableBooleanSchema = z.union([
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
export const RouteMetadataSchema = z.record(z.string(), ResolvableValueSchema.optional())

/**
 * @see {@link ValidationExpr}
 */
export const ValidationExprSchema = z.looseObject({
  type: z.literal(ExpressionType.VALIDATION),
  condition: PredicateExprSchema,
  message: ResolvableStringSchema,
  submissionOnly: z.boolean().optional(),
  groups: z.array(z.string().trim().min(1)).optional(),
  details: z.record(z.string(), z.any()).optional(),
})

const ValidWhenItemSchema = z.discriminatedUnion('type', [ValidationExprSchema, IterateExprSchema])
const ValidWhenSchema = z.preprocess(value => {
  if (
    value !== null &&
    value !== undefined &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === ExpressionType.ITERATE
  ) {
    return [value]
  }

  return value
}, z.array(ValidWhenItemSchema))

/**
 * @see {@link BlockDefinition}
 */
export const BlockSchema: z.ZodType<any> = z.lazy(() => {
  const baseBlock = z.looseObject({
    type: z.literal(StructureType.BLOCK),
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
    multiple: z.boolean().optional(),
  })

  const fieldBlock = baseBlock.extend({
    blockType: z.literal(BlockType.FIELD),
    ...fieldBlockProps.shape,
  })

  const basicBlock = baseBlock.extend({
    blockType: z.literal(BlockType.BASIC),
  })

  return z.discriminatedUnion('blockType', [fieldBlock, basicBlock])
})

/**
 * @see {@link AccessHook}
 *
 * Access hooks handle access control, data loading, and outcomes.
 * All properties except `type` are optional.
 */
export const AccessHookSchema = z.object({
  type: z.literal(HookType.ACCESS),
  when: PredicateExprSchema.optional(),
  effects: z.array(EffectFunctionExprSchema).optional(),
  next: z.array(HookOutcomeSchema).optional(),
})

/**
 * @see {@link SubmitHook}
 */
export const SubmitHookSchema = z.object({
  type: z.literal(HookType.SUBMIT),
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
  type: z.literal(ExpressionType.TIE_BREAKER),
  priority: z.number(),
  when: PredicateExprSchema.optional(),
})

const StepReachabilitySchema = z
  .object({
    entryWhen: z.union([z.literal(true), PredicateExprSchema]).optional(),
    tieBreakers: z.array(TieBreakerSchema).optional(),
  })
  .optional()

const StepEntryValidationSchema = z.object({
  groups: z.array(z.string().trim().min(1)).min(1),
  when: z.union([z.literal(true), PredicateExprSchema]),
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
export const StepSchema = z.looseObject({
  type: z.literal(StructureType.STEP),
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
    type: z.literal(StructureType.JOURNEY),
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
