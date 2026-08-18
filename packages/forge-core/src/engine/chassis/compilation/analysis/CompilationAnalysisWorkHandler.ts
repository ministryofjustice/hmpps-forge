import type { WorkContextContract, WorkHandler } from '../../contracts/work/work.type'
import { createWorkTask } from '../../work/workTask'
import type { StepASTNode } from '../../contracts/ast/structures.type'
import { ASTNodeType } from '../../contracts/ast/enums'
import type CompilationState from '../pipeline/CompilationState'
import CompilationModelBuilder from './CompilationModelBuilder'

export const COMPILATION_ANALYSIS_WORK_HANDLER: WorkHandler<'compilation.analysis', undefined> = {
  kind: 'compilation.analysis',

  begin(ctx: WorkContextContract<CompilationState, undefined>) {
    const state = ctx.state
    const stepNodes = state.ast.nodeIndex.findByType<StepASTNode>(ASTNodeType.STEP)
    const stepIndex = new Map(stepNodes.map(stepNode => [stepNode.id, stepNode]))

    const modelBuilder = new CompilationModelBuilder(state.ast.nodeIndex, {
      componentRegistry: state.dependencies.componentRegistry,
      functionRegistry: state.dependencies.functionRegistry,
    })

    state.recordModel(modelBuilder.build(stepIndex))

    return { output: undefined }
  },
}

export function createCompilationAnalysisTask() {
  return createWorkTask('analysis', COMPILATION_ANALYSIS_WORK_HANDLER, undefined)
}
