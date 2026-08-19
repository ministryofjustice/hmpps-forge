import type { WorkContextContract, WorkHandler } from '../../chassis/contracts/work/work.type'
import { createWorkTask } from '../../chassis/work/workTask'
import type CompilationState from '../../chassis/compilation/pipeline/CompilationState'
import ASTSemanticValidator from './ASTSemanticValidator'

export const COMPILATION_SEMANTIC_ANALYSIS_WORK_HANDLER: WorkHandler<'compilation.semantic-analysis', undefined> = {
  kind: 'compilation.semantic-analysis',

  begin(ctx: WorkContextContract<CompilationState, undefined>) {
    const state = ctx.state
    const validator = new ASTSemanticValidator({
      nodeIndex: state.ast.nodeIndex,
      templateNodeIndex: state.ast.templateNodeIndex,
      functionRegistry: state.dependencies.functionRegistry,
      componentRegistry: state.dependencies.componentRegistry,
    })

    validator.validate()

    return { output: undefined }
  },
}

export function createCompilationSemanticAnalysisTask() {
  return createWorkTask('semantic-analysis', COMPILATION_SEMANTIC_ANALYSIS_WORK_HANDLER, undefined)
}
