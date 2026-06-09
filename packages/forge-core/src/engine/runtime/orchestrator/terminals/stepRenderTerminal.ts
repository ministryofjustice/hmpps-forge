import type { RenderPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type { StoredRouteTree } from '../../../contracts/routing/routeTree.type'
import type { RenderContext } from '../../../../framework/rendering/types'
import { resolvePathParams } from '../../../../framework/path/routePath'
import { resolveBacklinkRouteTemplatePath } from '../../navigation/navigationRedirects'
import { buildCompiledRenderContext } from '../../context/compiledEvaluationContext'
import { evaluateRender } from '../phases/evaluateRender'
import RenderContextFactory from '../../rendering/RenderContextFactory'
import type { NavigationEvaluation } from '../../../contracts/navigation/navigationEvaluation.type'
import type { StepRequest } from '../../../../framework/types/request.type'
import type { TerminalPhase } from '../types'

export function createStepRenderTerminal(
  renderPlan: RenderPlan | undefined,
  path: string,
  routeTree: StoredRouteTree,
  currentRouteTemplatePath: string,
  functionRegistry: FunctionRegistry,
): TerminalPhase {
  return {
    name: 'render',
    async execute(state) {
      if (!renderPlan) {
        throw new Error(`[Forge] Render plan is missing for step "${path}"`)
      }

      const renderResult = await evaluateRender(renderPlan, buildCompiledRenderContext(state.context, functionRegistry))
      const step = resolveStepMetadata(
        renderResult.step as RenderContext['step'],
        state.request,
        state.navigationEvaluation,
      )

      const context = RenderContextFactory.build(
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

      return { type: 'render', context }
    },
  }
}

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
