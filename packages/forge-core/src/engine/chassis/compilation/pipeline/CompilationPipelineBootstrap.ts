import type { JourneyDefinition } from '../../../../authoring/types/structures.type'
import type { FunctionDefinitionLookup } from '../../../../authoring/types/functions.type'
import type { WorkTask } from '../../contracts/work/work.type'
import CompilationState from './CompilationState'
import { createCompilationPipelineTask } from './CompilationPipelineWorkHandler'
import { createCompilationDslValidationTask } from '../../../concerns/dsl-validation/CompilationDslValidationWorkHandler'
import { createCompilationAstTask } from '../ast/CompilationAstWorkHandler'
import { createCompilationSemanticAnalysisTask } from '../../../concerns/semantic-analysis/CompilationSemanticAnalysisWorkHandler'
import { createCompilationAnalysisTask } from '../analysis/CompilationAnalysisWorkHandler'
import { createCompilationLoweringTask } from '../lowering/CompilationLoweringWorkHandler'
import { createCompilationRoutesTask } from '../../../concerns/route/analysis/CompilationRoutesWorkHandler'

export interface CompilationPipelineConfig {
  readonly journeyDefinition: JourneyDefinition<unknown>
  readonly functionRegistry: FunctionDefinitionLookup
}

/**
 * The single source of compilation phase order. The phase tasks carry no props
 * because all data flows through the shared `CompilationState`.
 */
export default class CompilationPipelineBootstrap {
  constructor(private readonly config: CompilationPipelineConfig) {}

  buildPipelineElement(): WorkTask {
    return createCompilationPipelineTask({
      phases: this.buildPhases(),
    })
  }

  buildExecutionContext(): CompilationState {
    const { journeyDefinition, functionRegistry } = this.config

    return new CompilationState(journeyDefinition, { functionRegistry })
  }

  private buildPhases(): readonly WorkTask[] {
    return [
      createCompilationDslValidationTask(),
      createCompilationAstTask(),
      createCompilationSemanticAnalysisTask(),
      createCompilationAnalysisTask(),
      createCompilationLoweringTask(),
      createCompilationRoutesTask(),
    ]
  }
}
