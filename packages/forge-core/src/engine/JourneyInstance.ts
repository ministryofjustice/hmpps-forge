import type { JourneyDefinition } from '../authoring/types/structures.type'
import { JourneyInstanceDependencies, NodeId } from './types/engine.type'
import { isJourneyDefinition } from '../authoring/typeguards/structures'
import { DSLValidator } from './validation/DSLValidator'
import CompilationFactory, {
  CompiledForm,
  CompiledStep,
  CompilationArtefact,
  SharedCompiledForm,
  StepIndex,
} from './compilation/CompilationFactory'

/**
 * Contains compiled journey metadata and original configuration.
 */
export default class JourneyInstance {
  private readonly compiler: CompilationFactory

  private readonly sharedCompilation: SharedCompiledForm

  private readonly stepCache = new Map<NodeId, CompiledStep>()

  private readonly rawConfiguration: JourneyDefinition

  private constructor(formConfiguration: JourneyDefinition, dependencies: JourneyInstanceDependencies) {
    this.rawConfiguration = formConfiguration
    this.compiler = new CompilationFactory(dependencies)
    this.sharedCompilation = this.compiler.compileShared(formConfiguration)
  }

  static createFromConfiguration(configuration: any, dependencies: JourneyInstanceDependencies) {
    let configurationAsObject

    if (isJourneyDefinition(configuration)) {
      DSLValidator.validateJSON(configuration)
      configurationAsObject = configuration
    } else {
      configurationAsObject = JSON.parse(configuration)
    }

    DSLValidator.validateSchema(configurationAsObject)
    DSLValidator.validateFunctions(configurationAsObject, dependencies.functionRegistry)
    DSLValidator.validateComponents(configurationAsObject, dependencies.componentRegistry)

    return new JourneyInstance(configurationAsObject, dependencies)
  }

  compileAllSteps(): void {
    this.sharedCompilation.stepIndex.forEach((_, stepId) => {
      this.getOrCompileStep(stepId)
    })
  }

  getCompiledForm(): CompiledForm {
    return [...this.sharedCompilation.stepIndex.keys()].map(stepId => this.getOrCompileStep(stepId))
  }

  getCompiledStep(stepId: NodeId): CompiledStep {
    return this.getOrCompileStep(stepId)
  }

  getStepIndex(): StepIndex {
    return new Map(this.sharedCompilation.stepIndex)
  }

  getSharedCompilationArtefact(): CompilationArtefact {
    return this.sharedCompilation.sharedDependencies
  }

  getConfiguration(): JourneyDefinition {
    return this.rawConfiguration
  }

  getJourneyCode(): string {
    const journeyNode = this.sharedCompilation.rootNode

    if (!journeyNode) {
      throw new Error('No journey node found in compiled journey')
    }

    return journeyNode.properties.code
  }

  getJourneyTitle(): string {
    return this.rawConfiguration.title
  }

  private getOrCompileStep(stepId: NodeId): CompiledStep {
    const cachedStep = this.stepCache.get(stepId)

    if (cachedStep) {
      return cachedStep
    }

    const partial = this.compiler.compileStep(this.sharedCompilation, stepId)
    const reachabilityPlan = this.sharedCompilation.reachabilityPlans.get(stepId)!

    const compiledStep: CompiledStep = { ...partial, reachabilityPlan }

    this.stepCache.set(stepId, compiledStep)

    return compiledStep
  }
}
