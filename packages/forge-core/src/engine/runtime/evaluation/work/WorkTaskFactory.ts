import type { WorkTask } from '../../../contracts/runtime/work.type'
import { createWorkTask } from './workTask'
import type { NodeId } from '../../../contracts/ast/ast.type'
import type { BlockType } from '../../../../authoring/types/enums'
import type { ComponentRegistryEntry } from '../../../../components/types/components.type'
import type { BlockDefinition } from '../../../../components/types/structures.type'
import type { RenderBlock, ForgeRenderer, RenderContext } from '../../../../framework/types/rendering.type'
import type { ComponentRegistry } from '../../../../framework/types/adapter.type'
import type {
  AnswerPreparationWorkProps,
  FieldAnswerPreparationWorkProps,
  FieldAnswerPreparationWorkTask,
} from '../../../contracts/runtime/AnswerPreparationWork.type'
import {
  ANSWER_PREPARATION_WORK_HANDLER,
  ANSWER_PREPARATION_WORK_INSTRUMENTATION,
} from '../phases/answer-preparation/AnswerPreparationWorkHandler'
import {
  FIELD_ANSWER_PREPARATION_WORK_HANDLER,
  FIELD_ANSWER_PREPARATION_WORK_INSTRUMENTATION,
} from '../phases/answer-preparation/FieldAnswerPreparationWorkHandler'
import type {
  DomainValidationWorkProps,
  DomainValidationWorkTask,
  FieldValidationWorkProps,
  FieldValidationWorkTask,
} from '../../../contracts/runtime/ValidationWork.type'
import {
  STEP_VALIDATION_WORK_HANDLER,
  STEP_VALIDATION_WORK_INSTRUMENTATION,
} from '../phases/validation/StepValidationWorkHandler'
import {
  FIELD_VALIDATION_WORK_HANDLER,
  FIELD_VALIDATION_WORK_INSTRUMENTATION,
} from '../phases/validation/FieldValidationWorkHandler'
import {
  DOMAIN_VALIDATION_WORK_HANDLER,
  DOMAIN_VALIDATION_WORK_INSTRUMENTATION,
} from '../phases/validation/DomainValidationWorkHandler'
import {
  RESOLVE_BLOCK_WORK_HANDLER,
  RESOLVE_BLOCK_WORK_INSTRUMENTATION,
  type ResolveBlockWorkTask,
} from '../../../concerns/resolve/runtime/ResolveBlockWorkHandler'
import {
  RESOLVE_BLOCKS_WORK_HANDLER,
  RESOLVE_BLOCKS_WORK_INSTRUMENTATION,
} from '../../../concerns/resolve/runtime/ResolveBlocksWorkHandler'
import { RENDER_BLOCK_WORK_HANDLER, RENDER_BLOCK_WORK_INSTRUMENTATION } from '../phases/render/RenderBlockWorkHandler'
import {
  RENDER_BLOCKS_WORK_HANDLER,
  RENDER_BLOCKS_WORK_INSTRUMENTATION,
} from '../phases/render/RenderBlocksWorkHandler'
import {
  RENDER_ASSEMBLE_PAGE_WORK_HANDLER,
  RENDER_ASSEMBLE_PAGE_WORK_INSTRUMENTATION,
} from '../phases/render/RenderAssemblePageWorkHandler'
import type {
  AccessHookWhenWorkProps,
  AccessHookWorkProps,
  AccessLifecycleWorkTask,
  AccessHookWorkTask,
} from '../../../contracts/runtime/AccessLifecycleWork.type'
import { ACCESS_LIFECYCLE_WORK_HANDLER } from '../phases/hooks/AccessLifecycleWorkHandler'
import { ACCESS_HOOK_WORK_HANDLER, ACCESS_HOOK_WORK_INSTRUMENTATION } from '../phases/hooks/AccessHookWorkHandler'
import { ACCESS_HOOK_WHEN_WORK_HANDLER } from '../phases/hooks/AccessHookWhenWorkHandler'
import type { HookEffectWorkProps } from '../../../contracts/runtime/HookEffectWork.type'
import { HOOK_EFFECT_WORK_HANDLER, HOOK_EFFECT_WORK_INSTRUMENTATION } from '../phases/hooks/HookEffectWorkHandler'
import type {
  SubmitBranchWorkProps,
  SubmitHookPredicateWorkProps,
  SubmitHookWorkProps,
  SubmitValidationWorkProps,
  SubmitLifecycleWorkTask,
  SubmitHookWorkTask,
} from '../../../contracts/runtime/SubmitLifecycleWork.type'
import { SUBMIT_LIFECYCLE_WORK_HANDLER } from '../phases/hooks/SubmitLifecycleWorkHandler'
import { SUBMIT_HOOK_WORK_HANDLER, SUBMIT_HOOK_WORK_INSTRUMENTATION } from '../phases/hooks/SubmitHookWorkHandler'
import {
  SUBMIT_HOOK_PREDICATE_WORK_HANDLER,
  SUBMIT_HOOK_PREDICATE_WORK_INSTRUMENTATION,
} from '../phases/hooks/SubmitHookPredicateWorkHandler'
import { SUBMIT_BRANCH_WORK_HANDLER, SUBMIT_BRANCH_WORK_INSTRUMENTATION } from '../phases/hooks/SubmitBranchWorkHandler'
import {
  SUBMIT_VALIDATION_WORK_HANDLER,
  SUBMIT_VALIDATION_WORK_INSTRUMENTATION,
} from '../phases/hooks/SubmitValidationWorkHandler'
import { REQUEST_ACCESS_WORK_HANDLER, REQUEST_ACCESS_WORK_INSTRUMENTATION } from '../request/RequestAccessWorkHandler'
import {
  REQUEST_CONTEXT_PREPARATION_WORK_HANDLER,
  REQUEST_CONTEXT_PREPARATION_WORK_INSTRUMENTATION,
} from '../request/RequestContextPreparationWorkHandler'
import {
  REQUEST_ANSWER_CLEARDOWN_WORK_HANDLER,
  REQUEST_ANSWER_CLEARDOWN_WORK_INSTRUMENTATION,
} from '../request/RequestAnswerCleardownWorkHandler'
import {
  REQUEST_ANSWER_PREPARATION_WORK_HANDLER,
  REQUEST_ANSWER_PREPARATION_WORK_INSTRUMENTATION,
} from '../request/RequestAnswerPreparationWorkHandler'
import {
  REQUEST_ENTRY_VALIDATION_WORK_HANDLER,
  REQUEST_ENTRY_VALIDATION_WORK_INSTRUMENTATION,
} from '../request/RequestEntryValidationWorkHandler'
import { REQUEST_PIPELINE_WORK_HANDLER } from '../request/RequestPipelineWorkHandler'
import {
  REQUEST_REACHABILITY_WORK_HANDLER,
  REQUEST_REACHABILITY_WORK_INSTRUMENTATION,
} from '../request/RequestReachabilityWorkHandler'
import { REQUEST_RENDER_WORK_HANDLER, REQUEST_RENDER_WORK_INSTRUMENTATION } from '../request/RequestRenderWorkHandler'
import {
  REQUEST_RESOLVE_WORK_HANDLER,
  REQUEST_RESOLVE_WORK_INSTRUMENTATION,
} from '../../../concerns/resolve/runtime/RequestResolveWorkHandler'
import {
  REQUEST_ROUTE_TREE_WORK_HANDLER,
  REQUEST_ROUTE_TREE_WORK_INSTRUMENTATION,
} from '../../../concerns/route/runtime/RequestRouteTreeWorkHandler'
import { REQUEST_SUBMIT_WORK_HANDLER, REQUEST_SUBMIT_WORK_INSTRUMENTATION } from '../request/RequestSubmitWorkHandler'
import {
  REQUEST_VALIDITIES_WORK_HANDLER,
  REQUEST_VALIDITIES_WORK_INSTRUMENTATION,
} from '../request/RequestValiditiesWorkHandler'
import type {
  RequestAccessWorkProps,
  RequestAnswerCleardownWorkProps,
  RequestAnswerPreparationWorkProps,
  RequestContextPreparationWorkProps,
  RequestEntryValidationWorkProps,
  RequestPipelineWorkProps,
  RequestReachabilityWorkProps,
  RequestRenderWorkProps,
  RequestResolveWorkProps,
  RequestRouteTreeWorkProps,
  RequestSubmitWorkProps,
  RequestValiditiesWorkProps,
} from '../../../contracts/runtime/RequestPipelineWork.type'

export default class WorkTaskFactory {
  static answerPreparation(fields: readonly FieldAnswerPreparationWorkTask[]) {
    const props: AnswerPreparationWorkProps = { fields }

    return createWorkTask(
      'answer-preparation',
      ANSWER_PREPARATION_WORK_HANDLER,
      props,
      ANSWER_PREPARATION_WORK_INSTRUMENTATION,
    )
  }

  static fieldAnswerPreparation(key: string, props: FieldAnswerPreparationWorkProps) {
    return createWorkTask(
      key,
      FIELD_ANSWER_PREPARATION_WORK_HANDLER,
      props,
      FIELD_ANSWER_PREPARATION_WORK_INSTRUMENTATION,
    )
  }

  static stepValidation(fields: readonly FieldValidationWorkTask[], domains: readonly DomainValidationWorkTask[]) {
    return createWorkTask(
      'validation-step',
      STEP_VALIDATION_WORK_HANDLER,
      { fields, domains },
      STEP_VALIDATION_WORK_INSTRUMENTATION,
    )
  }

  static fieldValidation(key: string, props: FieldValidationWorkProps) {
    return createWorkTask(key, FIELD_VALIDATION_WORK_HANDLER, props, FIELD_VALIDATION_WORK_INSTRUMENTATION)
  }

  static domainValidation(key: string, props: DomainValidationWorkProps) {
    return createWorkTask(key, DOMAIN_VALIDATION_WORK_HANDLER, props, DOMAIN_VALIDATION_WORK_INSTRUMENTATION)
  }

  static resolveBlock(id: NodeId, variant: string, blockType: BlockType, properties: Record<PropertyKey, unknown>) {
    return createWorkTask(
      String(id),
      RESOLVE_BLOCK_WORK_HANDLER,
      { id, variant, blockType, properties },
      RESOLVE_BLOCK_WORK_INSTRUMENTATION,
    )
  }

  static resolveBlocks(
    blocks: readonly ResolveBlockWorkTask[],
    step: Record<string, unknown>,
    ancestors: readonly Record<string, unknown>[],
  ) {
    return createWorkTask(
      'resolve-blocks',
      RESOLVE_BLOCKS_WORK_HANDLER,
      { blocks, step, ancestors },
      RESOLVE_BLOCKS_WORK_INSTRUMENTATION,
    )
  }

  static renderBlock(
    id: string,
    block: RenderBlock,
    entry: ComponentRegistryEntry<BlockDefinition, unknown>,
    renderer: ForgeRenderer<unknown>,
    componentRegistry: ComponentRegistry,
  ) {
    return createWorkTask(
      id,
      RENDER_BLOCK_WORK_HANDLER,
      { block, entry, renderer, componentRegistry },
      RENDER_BLOCK_WORK_INSTRUMENTATION,
    )
  }

  static renderBlocks(
    blocks: readonly RenderBlock[],
    renderer: ForgeRenderer<unknown>,
    componentRegistry: ComponentRegistry,
  ) {
    return createWorkTask(
      'render-blocks',
      RENDER_BLOCKS_WORK_HANDLER,
      { blocks, renderer, componentRegistry },
      RENDER_BLOCKS_WORK_INSTRUMENTATION,
    )
  }

  static assemblePage(renderContext: RenderContext, renderer: ForgeRenderer<unknown>) {
    return createWorkTask(
      'assemble-page',
      RENDER_ASSEMBLE_PAGE_WORK_HANDLER,
      { renderContext, renderer },
      RENDER_ASSEMBLE_PAGE_WORK_INSTRUMENTATION,
    )
  }

  static accessLifecycle(hooks: readonly AccessHookWorkTask[]): AccessLifecycleWorkTask {
    return createWorkTask('access-lifecycle', ACCESS_LIFECYCLE_WORK_HANDLER, { hooks })
  }

  static accessHook(key: string, props: AccessHookWorkProps) {
    return createWorkTask(key, ACCESS_HOOK_WORK_HANDLER, props, ACCESS_HOOK_WORK_INSTRUMENTATION)
  }

  static accessHookWhen(key: string, props: AccessHookWhenWorkProps) {
    return createWorkTask(key, ACCESS_HOOK_WHEN_WORK_HANDLER, props)
  }

  static hookEffect(key: string, props: HookEffectWorkProps) {
    return createWorkTask(key, HOOK_EFFECT_WORK_HANDLER, props, HOOK_EFFECT_WORK_INSTRUMENTATION)
  }

  static submitLifecycle(hooks: readonly SubmitHookWorkTask[]): SubmitLifecycleWorkTask {
    return createWorkTask('submit-lifecycle', SUBMIT_LIFECYCLE_WORK_HANDLER, { hooks })
  }

  static submitHook(key: string, props: SubmitHookWorkProps) {
    return createWorkTask(key, SUBMIT_HOOK_WORK_HANDLER, props, SUBMIT_HOOK_WORK_INSTRUMENTATION)
  }

  static submitPredicate(key: string, props: SubmitHookPredicateWorkProps) {
    return createWorkTask(key, SUBMIT_HOOK_PREDICATE_WORK_HANDLER, props, SUBMIT_HOOK_PREDICATE_WORK_INSTRUMENTATION)
  }

  static submitBranch(key: string, props: SubmitBranchWorkProps) {
    return createWorkTask(key, SUBMIT_BRANCH_WORK_HANDLER, props, SUBMIT_BRANCH_WORK_INSTRUMENTATION)
  }

  static submitValidation(key: string, groups: readonly string[]) {
    const props: SubmitValidationWorkProps = { groups }

    return createWorkTask(key, SUBMIT_VALIDATION_WORK_HANDLER, props, SUBMIT_VALIDATION_WORK_INSTRUMENTATION)
  }

  static requestPipeline(props: RequestPipelineWorkProps): WorkTask<'request.pipeline', RequestPipelineWorkProps> {
    return createWorkTask('request', REQUEST_PIPELINE_WORK_HANDLER, props)
  }

  static contextPreparation(
    props: RequestContextPreparationWorkProps,
  ): WorkTask<'request.context-preparation', RequestContextPreparationWorkProps> {
    return createWorkTask(
      'context-preparation',
      REQUEST_CONTEXT_PREPARATION_WORK_HANDLER,
      props,
      REQUEST_CONTEXT_PREPARATION_WORK_INSTRUMENTATION,
    )
  }

  static requestAccess(props: RequestAccessWorkProps): WorkTask<'request.access', RequestAccessWorkProps> {
    return createWorkTask('access', REQUEST_ACCESS_WORK_HANDLER, props, REQUEST_ACCESS_WORK_INSTRUMENTATION)
  }

  static requestAnswerPreparation(
    props: RequestAnswerPreparationWorkProps,
  ): WorkTask<'request.answer-preparation', RequestAnswerPreparationWorkProps> {
    return createWorkTask(
      'answer-preparation',
      REQUEST_ANSWER_PREPARATION_WORK_HANDLER,
      props,
      REQUEST_ANSWER_PREPARATION_WORK_INSTRUMENTATION,
    )
  }

  static requestValidities(
    props: RequestValiditiesWorkProps,
  ): WorkTask<'request.validities', RequestValiditiesWorkProps> {
    return createWorkTask('validities', REQUEST_VALIDITIES_WORK_HANDLER, props, REQUEST_VALIDITIES_WORK_INSTRUMENTATION)
  }

  static requestReachability(
    props: RequestReachabilityWorkProps,
  ): WorkTask<'request.reachability', RequestReachabilityWorkProps> {
    return createWorkTask(
      'reachability',
      REQUEST_REACHABILITY_WORK_HANDLER,
      props,
      REQUEST_REACHABILITY_WORK_INSTRUMENTATION,
    )
  }

  static requestAnswerCleardown(
    props: RequestAnswerCleardownWorkProps,
  ): WorkTask<'request.answer-cleardown', RequestAnswerCleardownWorkProps> {
    return createWorkTask(
      'answer-cleardown',
      REQUEST_ANSWER_CLEARDOWN_WORK_HANDLER,
      props,
      REQUEST_ANSWER_CLEARDOWN_WORK_INSTRUMENTATION,
    )
  }

  static requestSubmit(props: RequestSubmitWorkProps): WorkTask<'request.submit', RequestSubmitWorkProps> {
    return createWorkTask('submit', REQUEST_SUBMIT_WORK_HANDLER, props, REQUEST_SUBMIT_WORK_INSTRUMENTATION)
  }

  static requestEntryValidation(
    props: RequestEntryValidationWorkProps,
  ): WorkTask<'request.entry-validation', RequestEntryValidationWorkProps> {
    return createWorkTask(
      'entry-validation',
      REQUEST_ENTRY_VALIDATION_WORK_HANDLER,
      props,
      REQUEST_ENTRY_VALIDATION_WORK_INSTRUMENTATION,
    )
  }

  static requestResolve(props: RequestResolveWorkProps): WorkTask<'request.resolve', RequestResolveWorkProps> {
    return createWorkTask('resolve', REQUEST_RESOLVE_WORK_HANDLER, props, REQUEST_RESOLVE_WORK_INSTRUMENTATION)
  }

  static requestRouteTree(props: RequestRouteTreeWorkProps): WorkTask<'request.route-tree', RequestRouteTreeWorkProps> {
    return createWorkTask('route-tree', REQUEST_ROUTE_TREE_WORK_HANDLER, props, REQUEST_ROUTE_TREE_WORK_INSTRUMENTATION)
  }

  static requestRender(props: RequestRenderWorkProps): WorkTask<'request.render', RequestRenderWorkProps> {
    return createWorkTask('render', REQUEST_RENDER_WORK_HANDLER, props, REQUEST_RENDER_WORK_INSTRUMENTATION)
  }
}
