import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import type { ForgeTopology, Logger } from '@ministryofjustice/hmpps-forge/core/framework'
import { extractPathname } from '@ministryofjustice/hmpps-forge/core/framework'
import type { NextForgeFormState } from '@ministryofjustice/hmpps-forge/next-react/client'

import { FORGE_REACT_ACTION, type ReactRenderer } from '../renderer/ReactRenderer'
import type { NextForgeSessionStore } from './types'
import NextRouteResolver from './NextRouteResolver'
import NextSnapshotFactory from './NextSnapshotFactory'
import NextActionResponseBindings from './NextActionResponseBindings'
import NextRedirect from './NextRedirect'
import { createFormState } from './nextReactFormState'

/**
 * POST dispatch for the action flow. The cookie store is resolved once from
 * `cookies()` before `forge.execute`, so engine cookie mutations and the session
 * store share one deterministic write path. `redirect()` throws, so it is never
 * wrapped in a try/catch.
 */
export default class NextForgeActionFactory {
  static async run(
    forge: Forge,
    topology: ForgeTopology,
    logger: Logger | Console,
    renderer: ReactRenderer,
    sessionStore: NextForgeSessionStore | undefined,
    request: Request,
  ): Promise<NextForgeFormState> {
    const requestPath = extractPathname(request.url)

    logger.debug(`POST request to Forge page action at path ${requestPath}`)

    const resolution = NextRouteResolver.resolve(topology, 'POST', requestPath)

    if (resolution.kind !== 'matched') {
      throw new Error(`No Forge POST route matched for path "${requestPath}".`)
    }

    const cookieStore = await cookies()
    const bindings = new NextActionResponseBindings(cookieStore)
    const session = (await sessionStore?.load(request)) ?? {}
    const snapshot = await NextSnapshotFactory.create({
      route: resolution.route,
      method: 'POST',
      request,
      params: resolution.params,
      session,
      state: { [FORGE_REACT_ACTION]: requestPath },
    })
    const outcome = await forge.execute({ snapshot, responseBindings: bindings, renderer })

    await sessionStore?.save(snapshot.session, request, bindings)

    if (outcome.kind === 'navigate') {
      redirect(NextRedirect.toTarget(outcome.url, request))
    }

    if (outcome.kind === 'error') {
      throw new Error(outcome.error.message)
    }

    return createFormState(requestPath, outcome.context, outcome.output as readonly ReactNode[])
  }
}
