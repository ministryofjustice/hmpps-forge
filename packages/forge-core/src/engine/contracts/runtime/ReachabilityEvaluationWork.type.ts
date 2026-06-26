import type { CompiledReachabilityResult } from '../compiled/compiledFunctions.type'
import type { ReachabilityEvaluationInput } from '../navigation/generatedReachabilityEvaluation.type'
import type { WorkTask } from './work.type'

export interface ReachabilityEvaluationWorkProps {
  readonly input: ReachabilityEvaluationInput
  readonly compiledResult: CompiledReachabilityResult
}

export type ReachabilityEvaluationWorkTask = WorkTask<'reachability.evaluation', ReachabilityEvaluationWorkProps>
