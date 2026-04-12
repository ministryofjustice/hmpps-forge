import { z } from 'zod'
import { BlockType, StructureType, ExpressionType, HookType } from '../../../authoring/types/enums'
import { ReferenceExprSchema, FormatExprSchema, PipelineExprSchema } from './expressions.schema'
import { PredicateExprSchema, ConditionalExprSchema, MatchExprSchema, HookOutcomeSchema } from './predicates.schema'
import { TransformerFunctionExprSchema, FunctionExprSchema, EffectFunctionExprSchema } from './base.schema'

/**
 * @see {@link ViewConfig}
 */
export const ViewConfigSchema = z.object({
  template: z.string().optional(),
  locals: z.record(z.string(), z.unknown()).optional(),
})

// TODO: Maybe add other Conditional like ConditionalBoolean etc.
/**
 * @see {@link ConditionalString}
 */
export const ConditionalStringSchema = z.union([
  z.string(),
  ReferenceExprSchema,
  FormatExprSchema,
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
  details: z.record(z.string(), z.any()).optional(),
})

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
    code: ConditionalStringSchema,
    defaultValue: z.union([ConditionalStringSchema, z.array(ConditionalStringSchema), FunctionExprSchema]).optional(),
    formatters: z.array(TransformerFunctionExprSchema).optional(),
    errors: z
      .array(
        z.object({
          message: z.string().trim().min(1, { message: 'Validation message must not be empty' }),
          details: z.record(z.string(), z.any()).optional(),
        }),
      )
      .optional(),
    validWhen: z.array(ValidationExprSchema).optional(),
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
 * @see {@link ActionHook}
 */
export const ActionHookSchema = z.object({
  type: z.literal(HookType.ACTION),
  when: PredicateExprSchema,
  effects: z.array(EffectFunctionExprSchema),
})

/**
 * @see {@link SubmitHook}
 */
export const SubmitHookSchema = z.object({
  type: z.literal(HookType.SUBMIT),
  when: PredicateExprSchema.optional(),
  guards: PredicateExprSchema.optional(),
  validate: z.boolean().optional(),
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

/**
 * @see {@link StepDefinition}
 */
export const StepSchema = z.looseObject({
  type: z.literal(StructureType.STEP),
  path: z.string(),
  blocks: z.array(BlockSchema).optional(),
  onAccess: z.array(AccessHookSchema).optional(),
  onAction: z.array(ActionHookSchema).optional(),
  onSubmission: z.array(SubmitHookSchema).optional(),
  title: z.string(),
  view: ViewConfigSchema.optional(),
  isEntryPoint: z.boolean().optional(),
  backlink: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
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
    entryPath: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  }),
)
