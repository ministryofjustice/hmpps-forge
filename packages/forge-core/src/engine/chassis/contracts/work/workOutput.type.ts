import type { ReachabilityEvaluationResult } from '../../../concerns/reachability/contracts/generatedReachabilityEvaluation.type'
import type {
  CompiledAccessHookResult,
  CompiledSubmitHookResult,
} from '../../../concerns/hooks/contracts/hookLifecycle.type'
import type { DomainValidationFailure, StepValidationFailure } from '../runtime/evaluationState.type'
import type { StepValidityResult } from '../../../concerns/validation/contracts/stepValidityResult.type'
import type { ValidationView } from '../../../concerns/validation/contracts/validationView.type'
import type { RenderBlock } from '../../../../framework/types/rendering.type'
import type {
  AnswerPreparationFieldResult,
  AnswerPreparationResult,
} from '../../../concerns/answer-preparation/contracts/AnswerPreparationWork.type'
import type { HookStageResult } from '../../../concerns/hooks/contracts/HookStage.type'
import type { PhaseWorkOutput, RequestPipelineResult } from '../runtime/requestPipelineOutput.type'
import type { ResolveBlocksOutput } from '../../../concerns/resolve/contracts/resolveBlocksOutput.type'

/**
 * Single source of truth mapping every work `kind` to the output its work handler
 * produces. Work handlers annotate their kind (`WorkHandler<'request.pipeline', …>`), so a
 * record's `complete`/`begin` output is checked against the registry (producer side)
 * and the typed child-output accessors return the precise type for a given kind
 * (consumer side). One entry per work handler; reading one sibling predicts the rest.
 */
type WorkOutputByKind = {
  readonly 'request.pipeline': RequestPipelineResult
  readonly 'request.context-preparation': PhaseWorkOutput
  readonly 'request.access': PhaseWorkOutput
  readonly 'request.answer-preparation': PhaseWorkOutput
  readonly 'request.validities': PhaseWorkOutput
  readonly 'request.reachability': PhaseWorkOutput
  readonly 'request.answer-cleardown': PhaseWorkOutput
  readonly 'request.entry-validation': PhaseWorkOutput
  readonly 'request.submit': PhaseWorkOutput
  readonly 'request.route-tree': PhaseWorkOutput
  readonly 'request.resolve': PhaseWorkOutput
  readonly 'request.render': PhaseWorkOutput
  readonly 'render.render-blocks': unknown
  readonly 'render.render-blocks.block': unknown
  readonly 'render.assemble-page': unknown
  readonly 'access.lifecycle': CompiledAccessHookResult
  readonly 'access.hook': CompiledAccessHookResult
  readonly 'access.hook.when': HookStageResult<CompiledAccessHookResult>
  readonly 'access.hook.next': HookStageResult<CompiledAccessHookResult>
  readonly 'submit.lifecycle': CompiledSubmitHookResult
  readonly 'submit.hook': CompiledSubmitHookResult
  readonly 'submit.predicate': HookStageResult<CompiledSubmitHookResult>
  readonly 'submit.branch': HookStageResult<CompiledSubmitHookResult>
  readonly 'hook.effect': HookStageResult<never>
  readonly 'reachability.evaluation': ReachabilityEvaluationResult
  readonly 'answer.preparation': AnswerPreparationResult
  readonly 'answer.preparation.field': AnswerPreparationFieldResult
  readonly 'validation.current-step': ValidationView
  readonly 'validation.step': StepValidityResult
  readonly 'validation.field': readonly StepValidationFailure[]
  readonly 'validation.domain': readonly DomainValidationFailure[]
  readonly 'resolve.blocks': ResolveBlocksOutput
  readonly 'resolve.block': RenderBlock
  readonly 'compilation.pipeline': undefined
  readonly 'compilation.dsl-validation': undefined
  readonly 'compilation.ast': undefined
  readonly 'compilation.semantic-analysis': undefined
  readonly 'compilation.analysis': undefined
  readonly 'compilation.lowering': undefined
  readonly 'compilation.routes': undefined
  readonly 'codegen.package-functions': undefined
  readonly 'codegen.journey': undefined
  readonly 'codegen.step': undefined
}

export type WorkKind = keyof WorkOutputByKind

/**
 * The output a work `kind` produces: the registry entry for a known kind, or
 * `unknown` for any other string. The work primitives are generic over
 * `K extends string` so the executor can run kinds outside the registry, while a
 * known literal kind still resolves to its exact output type.
 */
export type WorkOutputOf<K extends string> = K extends WorkKind ? WorkOutputByKind[K] : unknown
