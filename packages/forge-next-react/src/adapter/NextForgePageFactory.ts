import type { ReactNode } from 'react'
import { notFound, redirect } from 'next/navigation'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import type { ForgeTopology, Logger } from '@ministryofjustice/hmpps-forge/core/framework'
import { extractPathname, NO_OP_RESPONSE_BINDINGS } from '@ministryofjustice/hmpps-forge/core/framework'

import { FORGE_REACT_ACTION, type ReactRenderer } from '../renderer/ReactRenderer'
import type { NextForgeSessionStore } from './types'
import NextRouteResolver from './NextRouteResolver'
import NextSnapshotFactory from './NextSnapshotFactory'
import NextRedirect from './NextRedirect'

/**
 * GET dispatch for the page flow. Server components cannot set response headers
 * or cookies, so engine cookie mutations flow to {@link NO_OP_RESPONSE_BINDINGS}.
 * `redirect()`/`notFound()` throw, so they are never wrapped in a try/catch.
 */
export default class NextForgePageFactory {
  static async render(
    forge: Forge,
    topology: ForgeTopology,
    logger: Logger | Console,
    renderer: ReactRenderer,
    sessionStore: NextForgeSessionStore | undefined,
    request: Request,
  ): Promise<ReactNode> {
    const requestPath = extractPathname(request.url)

    logger.debug(`GET request to Forge page at path ${requestPath}`)

    const resolution = NextRouteResolver.resolve(topology, 'GET', requestPath)

    if (resolution.kind !== 'matched') {
      notFound()
    }

    const session = (await sessionStore?.load(request)) ?? {}
    const snapshot = await NextSnapshotFactory.create({
      route: resolution.route,
      method: 'GET',
      request,
      params: resolution.params,
      session,
      state: { [FORGE_REACT_ACTION]: requestPath },
    })
    const outcome = await forge.execute({ snapshot, responseBindings: NO_OP_RESPONSE_BINDINGS, renderer })

    await sessionStore?.save(snapshot.session, request, NO_OP_RESPONSE_BINDINGS)

    if (outcome.kind === 'navigate') {
      redirect(NextRedirect.toTarget(outcome.url, request))
    }

    if (outcome.kind === 'error') {
      if (outcome.error.status === 404) {
        notFound()
      }

      throw new Error(outcome.error.message)
    }

    return outcome.output as ReactNode
  }
}
