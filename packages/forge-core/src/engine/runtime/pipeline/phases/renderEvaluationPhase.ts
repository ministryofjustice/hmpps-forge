import type { RenderPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { StoredRouteTree } from '../../../contracts/routing/routeTree.type'
import type { RenderContext } from '../../../../framework/rendering/types'
import { resolvePathParams } from '../../../../framework/path/routePath'
import { resolveBacklinkRouteTemplatePath } from '../../navigation/navigationRedirects'
import { buildCompiledRenderContext } from '../../context/compiledEvaluationContext'
import { evaluateRender } from './evaluateRender'
import RenderContextFactory from '../../rendering/RenderContextFactory'
import type { NavigationEvaluation } from '../../../contracts/navigation/navigationEvaluation.type'
import type { StepRequest } from '../../../../framework/types/request.type'
import type { RequestPhase } from '../types'

/**
 * Builds the render-evaluation phase for a step: it runs the step's compiled
 * RenderPlan to produce blocks plus step/ancestor metadata, hydrates the
 * RenderContext, and stores it on the pipeline state for the render-output
 * terminal.
 *
 * Validation failures from the pipeline state are attached to blocks only when
 * showValidationFailures is set.
 */
export function createRenderEvaluationPhase(
  renderPlan: RenderPlan,
  routeTree: StoredRouteTree,
  currentRouteTemplatePath: string,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'render-evaluation',
    async execute(state) {
      const renderResult = await evaluateRender(
        renderPlan,
        buildCompiledRenderContext(state.context, functionRegistry, state.trace),
        state.trace,
        state.materialisation,
      )
      const step = resolveStepMetadata(
        renderResult.step as RenderContext['step'],
        state.request,
        state.navigationEvaluation,
      )

      state.renderContext = RenderContextFactory.build(
        {
          step,
          ancestors: renderResult.ancestors as RenderContext['ancestors'],
          blocks: renderResult.blocks,
          answers: state.context.global.answers,
          data: state.context.global.data,
          fieldValidationFailures: state.validation?.fieldFailures ?? [],
          domainValidationFailures: state.validation?.domainFailures ?? [],
        },
        {
          routeTree,
          currentStepPath: currentRouteTemplatePath,
          showValidationFailures: state.showValidationFailures,
          params: state.request.getParams(),
        },
      )

      return { action: 'continue' }
    },
  }
}

/**
 * Derives the step's backlink when the render did not already supply one. Falls
 * back to the navigation evaluation's resolved previous step, with its route
 * template params filled from the current request. Returns the step unchanged
 * when it already has a backlink, when there is no navigation evaluation, or
 * when no previous step path can be resolved.
 */
function resolveStepMetadata(
  step: RenderContext['step'],
  request: StepRequest,
  navigationEvaluation: NavigationEvaluation | undefined,
): RenderContext['step'] {
  if (step.backlink !== undefined || !navigationEvaluation) {
    return step
  }

  const backPath = resolveBacklinkRouteTemplatePath(navigationEvaluation)

  if (!backPath) {
    return step
  }

  return {
    ...step,
    backlink: resolvePathParams(backPath, request.getParams()),
  }
}
