import type { TemplateMaterialisationPlan } from '../../../contracts/plans/materialisationArtefacts.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import { buildCompiledBaseContext } from '../../context/compiledEvaluationContext'
import { evaluateTemplateMaterialisation } from './evaluateTemplateMaterialisation'
import type { RequestPhase } from '../types'

export function createTemplateMaterialisationPhase(
  materialisationPlan: TemplateMaterialisationPlan,
  functionRegistry: FunctionRegistry,
): RequestPhase {
  return {
    name: 'template-materialisation',
    async execute(state) {
      state.materialisation = await evaluateTemplateMaterialisation(
        materialisationPlan,
        buildCompiledBaseContext(state.context, functionRegistry, state.trace),
        state.trace,
      )

      return { action: 'continue' }
    },
  }
}
