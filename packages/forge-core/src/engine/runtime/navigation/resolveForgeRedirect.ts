import { resolvePathParams } from '../../../framework/path/routePath'
import type { StepRequest } from '../../../framework/types/request.type'
import type { ForgeRedirectResult } from '../orchestrator/types'
import { resolveRedirectTarget } from './redirectTarget'

export function resolveForgeRedirect(target: string, request: StepRequest): ForgeRedirectResult {
  const withParams = resolvePathParams(target, request.getParams())
  const resolved = resolveRedirectTarget(withParams, request.location)

  return { type: 'redirect', url: resolved.value }
}
