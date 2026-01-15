import { z } from 'zod'
import { BlockType, StructureType, ExpressionType, TransitionType } from '@form-engine/form/types/enums'
import { ReferenceExprSchema, FormatExprSchema, PipelineExprSchema } from './expressions.schema'
import { PredicateExprSchema, ConditionalExprSchema, NextExprSchema } from './predicates.schema'
import { TransformerFunctionExprSchema, FunctionExprSchema, EffectFunctionExprSchema } from './base.schema'

/**
 * @see {@link ViewConfig}
 */
export const ViewConfigSchema = z.object({
  template: z.string().optional(),
  locals: z.record(z.string(), z.unknown()).optional(),
  hiddenFromNavigation: z.boolean().optional(),
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
])

/**
 * @see {@link ValidationExpr}
 */
export const ValidationExprSchema = z.looseObject({
  type: z.literal(ExpressionType.VALIDATION),
  when: PredicateExprSchema,
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
    hidden: z.union([z.boolean(), PredicateExprSchema]).optional(),
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
    validate: z.array(ValidationExprSchema).optional(),
    dependent: PredicateExprSchema.optional(),
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
 * @see {@link AccessTransition}
 *
 * Access transitions handle both access control and data loading.
 * All properties except `type` are optional. If `status` is provided, `message` is required.
 */
export const AccessTransitionSchema = z
  .object({
    type: z.literal(TransitionType.ACCESS),
    when: PredicateExprSchema.optional(),
    effects: z.array(EffectFunctionExprSchema).optional(),
    redirect: z.array(NextExprSchema).optional(),
    status: z.number().int().min(100).max(599).optional(),
    message: z.union([z.string(), FormatExprSchema, ConditionalExprSchema]).optional(),
  })
  .refine(data => !(data.status !== undefined && data.message === undefined), {
    message: 'message is required when status is provided',
    path: ['message'],
  })

/**
 * @see {@link ActionTransition}
 */
export const ActionTransitionSchema = z.object({
  type: z.literal(TransitionType.ACTION),
  when: PredicateExprSchema,
  effects: z.array(EffectFunctionExprSchema),
})

/**
 * @see {@link SubmitTransition}
 */
export const SubmitTransitionSchema = z.object({
  type: z.literal(TransitionType.SUBMIT),
  when: PredicateExprSchema.optional(),
  guards: PredicateExprSchema.optional(),
  validate: z.boolean().optional(),
  onAlways: z
    .object({
      effects: z.array(EffectFunctionExprSchema).optional(),
      next: z.array(NextExprSchema).optional(),
    })
    .optional(),
  onValid: z
    .object({
      effects: z.array(EffectFunctionExprSchema).optional(),
      next: z.array(NextExprSchema).optional(),
    })
    .optional(),
  onInvalid: z
    .object({
      effects: z.array(EffectFunctionExprSchema).optional(),
      next: z.array(NextExprSchema).optional(),
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
  onAccess: z.array(AccessTransitionSchema).optional(),
  onAction: z.array(ActionTransitionSchema).optional(),
  onSubmission: z.array(SubmitTransitionSchema).optional(),
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
    onAccess: z.array(AccessTransitionSchema).optional(),
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
