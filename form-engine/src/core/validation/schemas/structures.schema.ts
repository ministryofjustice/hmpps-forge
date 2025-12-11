import { z } from 'zod'
import { StructureType, ExpressionType, TransitionType } from '@form-engine/form/types/enums'
import { ReferenceExprSchema, FormatExprSchema, PipelineExprSchema } from './expressions.schema'
import {
  PredicateExprSchema,
  PredicateTestExprSchema,
  ConditionalExprSchema,
  NextExprSchema,
} from './predicates.schema'
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
  })

  const fieldBlockProps = z.looseObject({
    code: ConditionalStringSchema,
    defaultValue: z.union([ConditionalStringSchema, z.array(ConditionalStringSchema), FunctionExprSchema]).optional(),
    formatters: z.array(TransformerFunctionExprSchema).optional(),
    hidden: PredicateTestExprSchema.optional(),
    errors: z
      .array(
        z.object({
          message: z.string().trim().min(1, { message: 'Validation message must not be empty' }),
          details: z.record(z.string(), z.any()).optional(),
        }),
      )
      .optional(),
    validate: z.array(ValidationExprSchema).optional(),
    dependent: PredicateTestExprSchema.optional(),
    multiple: z.boolean().optional(),
  })

  return z.union([
    z.looseObject({
      ...baseBlock.shape,
      ...fieldBlockProps.shape,
    }),
    baseBlock,
  ])
})

/**
 * @see {@link LoadTransition}
 */
export const LoadTransitionSchema = z.object({
  type: z.literal(TransitionType.LOAD),
  effects: z.array(EffectFunctionExprSchema),
})

/**
 * @see {@link AccessTransition}
 */
export const AccessTransitionSchema = z.object({
  type: z.literal(TransitionType.ACCESS),
  guards: PredicateExprSchema.optional(),
  effects: z.array(EffectFunctionExprSchema).optional(),
  redirect: z.array(NextExprSchema).optional(),
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
 * @see {@link SkipValidationTransition}
 */
export const SkipValidationTransitionSchema = z.object({
  type: z.literal(TransitionType.SUBMIT),
  when: PredicateExprSchema.optional(),
  guards: PredicateExprSchema.optional(),
  validate: z.literal(false),
  onAlways: z.object({
    effects: z.array(EffectFunctionExprSchema).optional(),
    next: z.array(NextExprSchema).optional(),
  }),
})

/**
 * @see {@link ValidatingTransition}
 */
export const ValidatingTransitionSchema = z.object({
  type: z.literal(TransitionType.SUBMIT),
  when: PredicateExprSchema.optional(),
  guards: PredicateExprSchema.optional(),
  validate: z.literal(true),
  onAlways: z
    .object({
      effects: z.array(EffectFunctionExprSchema).optional(),
    })
    .optional(),
  onValid: z.object({
    effects: z.array(EffectFunctionExprSchema).optional(),
    next: z.array(NextExprSchema).optional(),
  }),
  onInvalid: z.object({
    effects: z.array(EffectFunctionExprSchema).optional(),
    next: z.array(NextExprSchema).optional(),
  }),
})

/**
 * @see {@link SubmitTransition}
 */
export const SubmitTransitionSchema = z.union([SkipValidationTransitionSchema, ValidatingTransitionSchema])

/**
 * @see {@link StepDefinition}
 */
export const StepSchema = z.looseObject({
  type: z.literal(StructureType.STEP),
  path: z.string(),
  blocks: z.array(BlockSchema).optional(),
  onLoad: z.array(LoadTransitionSchema).optional(),
  onAccess: z.array(AccessTransitionSchema).optional(),
  onAction: z.array(ActionTransitionSchema).optional(),
  onSubmission: z.array(SubmitTransitionSchema).optional(),
  title: z.string(),
  view: ViewConfigSchema.optional(),
  isEntryPoint: z.boolean().optional(),
  backlink: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

/**
 * @see {@link JourneyDefinition}
 */
export const JourneySchema: z.ZodType<any> = z.lazy(() =>
  z.looseObject({
    type: z.literal(StructureType.JOURNEY),
    path: z.string(),
    code: z.string(),
    onLoad: z.array(LoadTransitionSchema).optional(),
    onAccess: z.array(AccessTransitionSchema).optional(),
    steps: z.array(StepSchema).optional(),
    children: z.array(JourneySchema).optional(),
    title: z.string(),
    description: z.string().optional(),
    view: ViewConfigSchema.optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
)
