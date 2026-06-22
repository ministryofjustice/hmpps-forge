import type { HttpMethod } from '@ministryofjustice/hmpps-forge/core/framework'

import type { NextRouteContext } from './forgeRequest'

export default interface NextReactAdapterInput {
  readonly method: HttpMethod
  readonly request: Request
  readonly context?: NextRouteContext
  readonly state: Record<string, unknown>
}
