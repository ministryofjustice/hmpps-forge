import type { ResponseBindings } from '../../../framework/types/responseBindings.type'
import type { RuntimeContext } from './evaluationState.type'

export interface PipelineState {
  readonly context: RuntimeContext
  readonly responseBindings: ResponseBindings
}
