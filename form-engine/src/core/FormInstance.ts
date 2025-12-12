import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import { isJourneyDefinition } from '@form-engine/form/typeguards/structures'
import { FormValidator } from '@form-engine/core/validation/FormValidator'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'
import FormCompilationFactory, { CompiledForm } from '@form-engine/core/ast/compilation/FormCompilationFactory'

/**
 * Contains the compiled form and original configuration.
 */
export default class FormInstance {
  private readonly compiledForm: CompiledForm

  private readonly rawConfiguration: JourneyDefinition

  private constructor(formConfiguration: JourneyDefinition, dependencies: FormInstanceDependencies) {
    this.rawConfiguration = formConfiguration

    const compiler = new FormCompilationFactory(dependencies)

    this.compiledForm = compiler.compile(formConfiguration)
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
    return this.compiledForm
  }

  getConfiguration(): JourneyDefinition {
    return this.rawConfiguration
  }

  getFormCode(): string {
    const journeyNode = this.compiledForm[0].artefact.nodeRegistry.findByType<JourneyASTNode>(ASTNodeType.JOURNEY).at(0)

    if (!journeyNode) {
      throw new Error('No journey node found in compiled form')
    }

    return journeyNode.properties.code
  }

  getFormTitle(): string {
    return this.rawConfiguration.title
  }
}
