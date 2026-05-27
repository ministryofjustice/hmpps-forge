import createHttpError from 'http-errors'
import { resolvePathParams } from '../../../framework/path/routePath'
import { resolveRedirectTarget } from '../navigation/redirectTarget'
import type { StepRequest } from '../../../framework/types/request.type'
import type { ForgeInstrumentation } from '../../../instrumentation/ForgeInstrumentation'
import type { ForgeResult, PipelineState, RequestPhase, TerminalPhase } from './types'

export default class RequestOrchestrator {
  constructor(
    private readonly phases: RequestPhase[],
    private readonly terminal: TerminalPhase,
    private readonly instrumentation: ForgeInstrumentation,
  ) {}

  async execute(state: PipelineState): Promise<ForgeResult> {
    for (const phase of this.phases) {
      const outcome = await this.instrumentation.spanAsync(phase.name, () => phase.execute(state))

      if (outcome.action === 'halt-redirect') {
        this.instrumentation.getCurrentSpan()?.setAttributes({
          'forge.outcome.type': 'redirected',
          'forge.redirect.target': outcome.target,
          'forge.redirect.reason': outcome.reason,
        })

        return this.resolveRedirect(outcome.target, state.request)
      }

      if (outcome.action === 'halt-error') {
        throw createHttpError(outcome.status, outcome.message)
      }
    }

    const result = await this.instrumentation.spanAsync(this.terminal.name, () => this.terminal.execute(state))

    this.instrumentation.getCurrentSpan()?.setAttribute('forge.outcome.type', 'rendered')

    return result
  }

  private resolveRedirect(target: string, request: StepRequest): ForgeResult {
    const withParams = resolvePathParams(target, request.getParams())
    const resolved = resolveRedirectTarget(withParams, request.location)

    return { type: 'redirect', url: resolved.value }
  }
}
