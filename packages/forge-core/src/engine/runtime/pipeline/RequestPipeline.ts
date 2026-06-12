import createHttpError from 'http-errors'
import { resolveForgeRedirect } from '../navigation/resolveForgeRedirect'
import { recordContextSnapshot } from './trace/contextSnapshot'
import type { ForgeResult, PipelineState, RequestPhase, TerminalPhase } from './types'

export default class RequestPipeline<TOut = undefined> {
  constructor(
    private readonly phases: RequestPhase[],
    private readonly terminal: TerminalPhase<TOut>,
  ) {}

  /**
   * Runs the pipeline phases in order, then the terminal. When the state
   * carries a trace recorder, every phase and the terminal are bracketed with
   * begin/end records — the per-unit decisions inside each phase are recorded
   * by the phase walks themselves — and the full context state is snapshotted
   * before the first phase runs (`initial`) and at the end of every phase and
   * the terminal (point = the phase name), halted phases included. The
   * orchestrator, as the recorder's owner, finishes and emits the trace —
   * including when this method throws.
   */
  async execute(state: PipelineState): Promise<ForgeResult<TOut>> {
    if (this.phases.length === 0) {
      state.trace?.beginPhase(this.terminal.name)
      recordContextSnapshot(state, 'initial')

      const result = await this.terminal.execute(state)

      recordContextSnapshot(state, this.terminal.name)
      state.trace?.endPhase(result.type)

      return result
    }

    for (const [index, phase] of this.phases.entries()) {
      state.trace?.beginPhase(phase.name)

      if (index === 0) {
        recordContextSnapshot(state, 'initial')
      }

      const outcome = await phase.execute(state)

      recordContextSnapshot(state, phase.name)
      state.trace?.endPhase(outcome.action)

      if (outcome.action === 'halt-redirect') {
        return resolveForgeRedirect(outcome.target, state.request)
      }

      if (outcome.action === 'halt-error') {
        throw createHttpError(outcome.status, outcome.message)
      }
    }

    state.trace?.beginPhase(this.terminal.name)

    const result = await this.terminal.execute(state)

    recordContextSnapshot(state, this.terminal.name)
    state.trace?.endPhase(result.type)

    return result
  }
}
