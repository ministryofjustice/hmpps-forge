import type { WorkContextContract, WorkHandler } from '../../../contracts/work/work.type'
import { createWorkTask } from '../../../work/workTask'
import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import { ASTNodeType } from '../../../contracts/ast/enums'
import type CompilationState from '../../../compilation/pipeline/CompilationState'
import RouteIndexBuilder from './RouteIndexBuilder'

export const COMPILATION_ROUTES_WORK_HANDLER: WorkHandler<'compilation.routes', undefined> = {
  kind: 'compilation.routes',

  begin(ctx: WorkContextContract<CompilationState, undefined>) {
    const state = ctx.state
    const routeIndexBuilder = new RouteIndexBuilder()

    const stepNodes = state.ast.nodeRegistry.findByType<StepASTNode>(ASTNodeType.STEP)
    const journeyNodes = state.ast.nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY)

    state.recordRouteIndexes({
      stepRouteIndex: routeIndexBuilder.buildStepRouteIndex(stepNodes),
      journeyRouteIndex: routeIndexBuilder.buildJourneyRouteIndex(journeyNodes),
    })

    return { output: undefined }
  },
}

export function createCompilationRoutesTask() {
  return createWorkTask('routes', COMPILATION_ROUTES_WORK_HANDLER, undefined)
}
