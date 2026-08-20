import type {
  StepAnalysisContext,
  StepModelAnalyzer,
} from '../../../chassis/compilation/analysis/concernAnalyzers.type'
import { classifyValidationRules, hasConfiguredValue } from '../../../chassis/contracts/models/validationRules'
import type { ValidationModel } from '../contracts/validationModel.type'

export default class ValidationAnalyzer implements StepModelAnalyzer<ValidationModel> {
  analyzeStep(context: StepAnalysisContext): ValidationModel {
    const { stepNode, labels } = context
    const validatingFields = context.fields.filter(field => field.validation !== undefined)
    const domainValidWhen = stepNode.properties.validWhen
    const hasDomainValidation = hasConfiguredValue(domainValidWhen)

    return {
      label: labels.labelFrom([stepNode]),
      // Fields inside iterator templates don't count towards eager validity checks
      // (pre-reachability validation). Only top-level registered fields with
      // validation and a step-level `validWhen` condition count.
      hasValidation: validatingFields.some(field => field.iteratorPath.length === 0) || hasDomainValidation,
      fields: validatingFields,
      domainRules: hasDomainValidation
        ? classifyValidationRules(domainValidWhen, value => context.classifier.classify(value))
        : undefined,
      entryValidation: stepNode.properties.validateOnEntry ?? [],
    }
  }
}
