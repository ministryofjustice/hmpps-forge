import { z } from 'zod'
import { BlockType, StructureType, ExpressionType, HookType } from '../../../authoring/types/enums'
import { ReferenceExprSchema, PipelineExprSchema, IterateExprSchema } from './expressions.schema'
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

// TODO: Probably should add other resolvable schemas, such as ResolvableBoolean.
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
 * @see {@link ValidationExpr}
 */
export const ValidationExprSchema = z.looseObject({
  type: z.literal(ExpressionType.VALIDATION),
  condition: PredicateExprSchema,
  message: z.string().trim().min(1, { message: 'Validation message must not be empty' }),
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
    visibleWhen: z.union([z.boolean(), PredicateExprSchema]).optional(),
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
    sanitize: z.boolean().optional(),
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
    resumeWhen: z.union([z.literal(true), PredicateExprSchema]).optional(),
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
  title: z.string(),
  view: ViewConfigSchema.optional(),
  reachability: StepReachabilitySchema,
  backlink: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
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
    title: z.string(),
    description: z.string().optional(),
    view: ViewConfigSchema.optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    reachability: JourneyReachabilitySchema,
  }),
)
