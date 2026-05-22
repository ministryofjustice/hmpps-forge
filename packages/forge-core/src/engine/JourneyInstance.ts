import type { JourneyDefinition } from '../authoring/types/structures.type'
import { PackageDependencies, NodeId } from './types/engine.type'
import { isJourneyDefinition } from '../authoring/typeguards/structures'
import { DSLValidator } from './validation/DSLValidator'
import CompilationFactory from './compilation/CompilationFactory'
import type {
  CompilationArtefact,
  CompiledForm,
  CompiledStep,
  JourneyIndex,
  SharedCompiledForm,
  StepIndex,
} from './types/compilationArtefacts.type'
import type { JourneyRuntimePlan } from './types/runtimePlans.type'

/**
 * Contains compiled journey metadata and original configuration.
 */
export default class JourneyInstance {
  private readonly compiler: CompilationFactory

  private readonly sharedCompilation: SharedCompiledForm

  private readonly stepCache = new Map<NodeId, CompiledStep>()

  private journeyArtefact?: CompilationArtefact

  private readonly rawConfiguration: JourneyDefinition

  private constructor(formConfiguration: JourneyDefinition, packageDependencies: PackageDependencies) {
    this.rawConfiguration = formConfiguration
    this.compiler = new CompilationFactory(packageDependencies.functionRegistry)
    this.sharedCompilation = this.compiler.compileShared(formConfiguration)
  }

  static createFromConfiguration(configuration: any, packageDependencies: PackageDependencies) {
    let configurationAsObject

    if (isJourneyDefinition(configuration)) {
      DSLValidator.validateJSON(configuration)
      configurationAsObject = configuration
    } else {
      configurationAsObject = JSON.parse(configuration)
    }

    DSLValidator.validateSchema(configurationAsObject)
    DSLValidator.validateTree(
      configurationAsObject,
      packageDependencies.functionRegistry,
      packageDependencies.componentRegistry,
    )

    return new JourneyInstance(configurationAsObject, packageDependencies)
  }

  compileAllRouteArtefacts(): void {
    this.sharedCompilation.stepIndex.forEach((_, stepId) => {
      this.getOrCompileStep(stepId)
    })

    this.getJourneyCompilationArtefact()
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

  getJourneyIndex(): JourneyIndex {
    return new Map(this.sharedCompilation.journeyIndex)
  }

  getJourneyRuntimePlan(journeyId: NodeId): JourneyRuntimePlan | undefined {
    return this.sharedCompilation.journeyRuntimePlans.get(journeyId)
  }

  getSharedCompilationArtefact(): CompilationArtefact {
    return this.sharedCompilation.sharedContext
  }

  getJourneyCompilationArtefact(): CompilationArtefact {
    if (!this.journeyArtefact) {
      this.journeyArtefact = this.compiler.compileJourney(this.sharedCompilation)
    }

    return this.journeyArtefact
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
    const navigationPlan = this.sharedCompilation.navigationPlans.get(stepId)!

    const compiledStep: CompiledStep = { ...partial, navigationPlan }

    this.stepCache.set(stepId, compiledStep)

    return compiledStep
  }
}
