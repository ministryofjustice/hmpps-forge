import { NodeId } from '../../types/ast.type'
import ThunkEvaluationContext from '../../compilation/thunks/ThunkEvaluationContext'
import RuntimeArtifacts from '../types/RuntimeArtifacts'

/**
 * Projects step validation results onto context.global.validation.
 *
 * This is the only writer of context.global.validation.
 */
export default class ValidationStateProjector {
  project(stepId: NodeId, artifacts: RuntimeArtifacts, context: ThunkEvaluationContext): void {
    const result = artifacts.getStepValidity()

    if (!result) {
      throw new Error('ValidationStateProjector requires a stored validity result')
    }

    context.global.validation = {
      stepId,
      validated: true,
      isValid: result.isValid,
      fieldFailures: result.fieldFailures,
      domainFailures: result.domainFailures,
    }
  }
}
