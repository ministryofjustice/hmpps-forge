import type { NodeId, TemplateNodeId } from '../ast/ast.type'
import type {
  CompiledMaterialisedFieldAnswerPreparationFunction,
  CompiledMaterialisedFieldValidationFunction,
  CompiledMaterialisedRenderBlockFunction,
  CompiledTemplateMaterialiserFunction,
  EvaluateChildFunction,
} from '../compiled/compiledFunctions.type'
import type {
  AnswerPreparationContext,
  RenderCompilationContext,
  ValidationContext,
} from '../compiled/phaseContexts.type'
import type { RenderBlock } from '../../../framework/rendering/types'
import type { StepValidationFailure } from '../runtime/evaluationState.type'

/**
 * A materialised template node with scope pre-bound into phase closures.
 * Each phase function (render, validate, prepare) is a closure that captured
 * the iterator scope at materialisation time — callers invoke them with just
 * the phase context, no scope threading required.
 */
export interface MaterialisedTemplateNode {
  readonly sourceNodeId: TemplateNodeId
  readonly instanceKey: string
  readonly origin: MaterialisedNodeOrigin
  readonly render?: (
    ctx: RenderCompilationContext,
    evaluateChild?: EvaluateChildFunction,
  ) => RenderBlock | Promise<RenderBlock>
  readonly validate?: (
    ctx: ValidationContext,
    isSubmission: boolean,
    groups: string[],
  ) => StepValidationFailure[] | Promise<StepValidationFailure[]>
  readonly prepare?: (ctx: AnswerPreparationContext) => void | Promise<void>
}

/**
 * Tracks which iterator item produced a materialised node, so the trace and
 * devtools can correlate concrete instances back to their iterator source.
 */
export interface MaterialisedNodeOrigin {
  readonly iteratorNodeId: NodeId
  readonly itemIndex: number
  readonly parentInstanceKey?: string
}

/**
 * Per-template compiled functions from all three phase compilers, keyed by
 * TemplateNodeId. The materialiser wraps each function in a closure that
 * captures the iterator scope, producing a `MaterialisedTemplateNode` with
 * ready-to-call phase functions.
 */
export interface CompiledTemplatePhaseFunctions {
  readonly render?: CompiledMaterialisedRenderBlockFunction
  readonly renderVariant?: string
  readonly validate?: CompiledMaterialisedFieldValidationFunction
  readonly prepare?: CompiledMaterialisedFieldAnswerPreparationFunction
}

/**
 * One compiled materialiser for a MAP iterator root. Expands the iterator's
 * collection and wraps the template phase functions in scope-capturing
 * closures, producing ordered `MaterialisedTemplateNode[]` for the current
 * request context.
 */
export interface CompiledTemplateMaterialisationRoot {
  readonly nodeId: NodeId
  readonly materialise: CompiledTemplateMaterialiserFunction
  readonly templateFunctions: ReadonlyMap<TemplateNodeId, CompiledTemplatePhaseFunctions>
}

/**
 * All materialisation work for one step or journey: one root per MAP iterator
 * that yields field or block template nodes. Steps without iterators get an
 * empty plan, which the evaluator runs through as a no-op.
 */
export interface TemplateMaterialisationPlan {
  readonly roots: readonly CompiledTemplateMaterialisationRoot[]
}
