import { ForgeRuntime } from '@ministryofjustice/hmpps-forge/core'
import type { Forge, TraceObserver } from '@ministryofjustice/hmpps-forge/core'
import { extractPathname } from '@ministryofjustice/hmpps-forge/core/framework'
import type { HttpMethod } from '@ministryofjustice/hmpps-forge/core/framework'

import { FORGE_REACT_ACTION, ReactRenderer, type ReactRendererOptions } from '../renderer/ReactRenderer'
import { type NextForgeSessionStore, type NextRouteContext } from './forgeRequest'
import NextRouteHandlerReactAdapterConfig from './NextRouteHandlerReactAdapterConfig'
import type NextReactAdapterInput from './NextReactAdapterInput.type'

export interface NextForgeHandler {
  GET(request: Request, context?: NextRouteContext): Promise<Response>
  POST(request: Request, context?: NextRouteContext): Promise<Response>
}

export interface NextForgeHandlerOptions extends ReactRendererOptions {
  sessionStore?: NextForgeSessionStore
  traceObserver?: TraceObserver
}

/**
 * Build Next.js route handlers that serve a configured {@link Forge} instance.
 *
 * Builds a Forge runtime bound to a React adapter config. Forge owns request
 * execution, rendering work, response mutation tracing, and commit timing; this
 * factory owns only the Next route-handler transport.
 */
export function createNextForgeHandler(forge: Forge, options: NextForgeHandlerOptions = {}): NextForgeHandler {
  const logger = forge.getLogger()
  const runtime = ForgeRuntime.create(forge)
  const adapterConfig = new NextRouteHandlerReactAdapterConfig(new ReactRenderer(options), {
    sessionStore: options.sessionStore,
  })

  return {
    GET: (request, context) => handleRequest('GET', request, context),
    POST: (request, context) => handleRequest('POST', request, context),
  }

  async function handleRequest(method: HttpMethod, request: Request, context?: NextRouteContext): Promise<Response> {
    const requestPath = extractPathname(request.url)

    logger.debug(`${method} request to Forge route at path ${requestPath}`)

    const input: NextReactAdapterInput = {
      method,
      request,
      context,
      state: {
        [FORGE_REACT_ACTION]: requestPath,
      },
    }

    return runtime.execute(input, adapterConfig, { traceObserver: options.traceObserver })
  }
}
