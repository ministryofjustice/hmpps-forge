import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { FormInstanceDependencies, NodeId } from '@form-engine/core/types/engine.type'
import { isJourneyDefinition } from '@form-engine/form/typeguards/structures'
import { FormValidator } from '@form-engine/core/validation/FormValidator'
import FormCompilationFactory, {
  CompiledForm,
  CompiledStep,
  CompilationArtefact,
  SharedCompiledForm,
  StepIndex,
} from '@form-engine/core/compilation/FormCompilationFactory'

/**
 * Contains compiled form metadata and original configuration.
 */
export default class FormInstance {
  private readonly compiler: FormCompilationFactory

  private readonly sharedCompilation: SharedCompiledForm

  private readonly stepCache = new Map<NodeId, CompiledStep>()

  private readonly rawConfiguration: JourneyDefinition

  private constructor(formConfiguration: JourneyDefinition, dependencies: FormInstanceDependencies) {
    this.rawConfiguration = formConfiguration
    this.compiler = new FormCompilationFactory(dependencies)
    this.sharedCompilation = this.compiler.compileShared(formConfiguration)
  }

  static createFromConfiguration(configuration: any, dependencies: FormInstanceDependencies) {
    let configurationAsObject

    if (isJourneyDefinition(configuration)) {
      FormValidator.validateJSON(configuration)
      configurationAsObject = configuration
    } else {
      configurationAsObject = JSON.parse(configuration)
    }

    FormValidator.validateSchema(configurationAsObject)

    return new FormInstance(configurationAsObject, dependencies)
  }

  getCompiledForm(): CompiledForm {
    return [...this.sharedCompilation.stepIndex.keys()].map(stepId => this.getOrCompileStep(stepId))
  }

  async getCompiledStep(stepId: NodeId): Promise<CompiledStep> {
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

  getFormCode(): string {
    const journeyNode = this.sharedCompilation.rootNode

    if (!journeyNode) {
      throw new Error('No journey node found in compiled form')
    }

    return journeyNode.properties.code
  }

  getFormTitle(): string {
    return this.rawConfiguration.title
  }

  private getOrCompileStep(stepId: NodeId): CompiledStep {
    const cachedStep = this.stepCache.get(stepId)

    if (cachedStep) {
      return cachedStep
    }

    const compiledStep = this.compiler.compileStep(this.sharedCompilation, stepId)
    this.stepCache.set(stepId, compiledStep)

    return compiledStep
  }
}
