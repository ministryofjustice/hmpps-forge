import type { StepAnalysisContext, StepModelAnalyzer } from '../../../compilation/analysis/concernAnalyzers.type'
import { classifyValidationRules, hasConfiguredValue } from '../../../contracts/models/validationRules'
import type { ValidationModel } from '../contracts/validationModel.type'

export default class ValidationAnalyzer implements StepModelAnalyzer<ValidationModel> {
  analyzeStep(context: StepAnalysisContext): ValidationModel {
    const { stepNode, labels } = context
    const validatingFields = context.fields.filter(field => field.validation !== undefined)
    const domainValidWhen = stepNode.properties.validWhen
    const hasDomainValidation = hasConfiguredValue(domainValidWhen)

    return {
      label: labels.labelFrom([stepNode]),
      // Template fields never count towards eager validities — only registered
      // validating fields and a domain validWhen do.
      hasValidation: validatingFields.some(field => field.iteratorPath.length === 0) || hasDomainValidation,
      fields: validatingFields,
      domainRules: hasDomainValidation
        ? classifyValidationRules(domainValidWhen, value => context.classifier.classify(value))
        : undefined,
      entryValidation: stepNode.properties.validateOnEntry ?? [],
    }
  }
}
