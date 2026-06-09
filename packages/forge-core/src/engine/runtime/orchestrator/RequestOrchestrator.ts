import createHttpError from 'http-errors'
import { resolvePathParams } from '../../../framework/path/routePath'
import { resolveRedirectTarget } from '../navigation/redirectTarget'
import type { StepRequest } from '../../../framework/types/request.type'
import type { ForgeResult, PipelineState, RequestPhase, TerminalPhase } from './types'

export default class RequestOrchestrator {
  constructor(
    private readonly phases: RequestPhase[],
    private readonly terminal: TerminalPhase,
  ) {}

  /**
   * Runs the pipeline phases in order, then the terminal. When the state
   * carries a trace recorder, every phase and the terminal are bracketed with
   * begin/end records — the per-unit decisions inside each phase are recorded
   * by the phase walks themselves. The recorder's owner (whoever built the
   * state) is responsible for finishing and emitting the trace.
   */
  async execute(state: PipelineState): Promise<ForgeResult> {
    for (const phase of this.phases) {
      state.trace?.beginPhase(phase.name)

      const outcome = await phase.execute(state)

      state.trace?.endPhase(outcome.action)

      if (outcome.action === 'halt-redirect') {
        return this.resolveRedirect(outcome.target, state.request)
      }

      if (outcome.action === 'halt-error') {
        throw createHttpError(outcome.status, outcome.message)
      }
    }

    state.trace?.beginPhase(this.terminal.name)

    const result = await this.terminal.execute(state)

    state.trace?.endPhase(result.type)

    return result
  }

  private resolveRedirect(target: string, request: StepRequest): ForgeResult {
    const withParams = resolvePathParams(target, request.getParams())
    const resolved = resolveRedirectTarget(withParams, request.location)

    return { type: 'redirect', url: resolved.value }
  }
}
