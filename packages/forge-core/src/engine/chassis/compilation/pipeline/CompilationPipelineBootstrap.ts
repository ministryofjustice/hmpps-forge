import type { JourneyDefinition } from '../../../../authoring/types/structures.type'
import type FunctionRegistry from '../../registries/FunctionRegistry'
import type ComponentRegistry from '../../registries/ComponentRegistry'
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
  readonly journeyDefinition: JourneyDefinition
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
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
    const { journeyDefinition, functionRegistry, componentRegistry } = this.config

    return new CompilationState(journeyDefinition, { functionRegistry, componentRegistry })
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
