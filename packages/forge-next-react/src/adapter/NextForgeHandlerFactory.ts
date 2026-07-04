import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import type { ForgeOutcome, ForgeTopology, HttpMethod, Logger } from '@ministryofjustice/hmpps-forge/core/framework'
import { extractPathname } from '@ministryofjustice/hmpps-forge/core/framework'

import { FORGE_REACT_ACTION, type ReactRenderer } from '../renderer/ReactRenderer'
import type { NextForgeHandler } from './createNextForgeHandler'
import type { NextForgeSessionStore, NextRouteContext } from './types'
import NextRouteResolver from './NextRouteResolver'
import NextSnapshotFactory from './NextSnapshotFactory'
import RecordingResponseBindings from './RecordingResponseBindings'

export default class NextForgeHandlerFactory {
  static create(
    forge: Forge,
    topology: ForgeTopology,
    logger: Logger | Console,
    renderer: ReactRenderer,
    sessionStore?: NextForgeSessionStore,
  ): NextForgeHandler {
    const handleRequest = async (
      method: HttpMethod,
      request: Request,
      context?: NextRouteContext,
    ): Promise<Response> => {
      const requestPath = extractPathname(request.url)

      logger.debug(`${method} request to Forge route at path ${requestPath}`)

      const resolution = NextRouteResolver.resolve(topology, method, requestPath)

      if (resolution.kind === 'not-found') {
        return new Response('Not found', { status: 404 })
      }

      if (resolution.kind === 'method-not-allowed') {
        return new Response(`${method} not allowed`, {
          status: 405,
          headers: { allow: resolution.allowed.join(', ') },
        })
      }

      const session = (await sessionStore?.load(request)) ?? {}
      const snapshot = await NextSnapshotFactory.create({
        route: resolution.route,
        method,
        request,
        params: resolution.params,
        session,
        state: { [FORGE_REACT_ACTION]: requestPath },
        context,
      })
      const bindings = new RecordingResponseBindings()
      const outcome = await forge.execute({ snapshot, responseBindings: bindings, renderer })

      await sessionStore?.save(snapshot.session, request, bindings)

      return this.commitOutcome(outcome, request, bindings)
    }

    return {
      GET: (request, context) => handleRequest('GET', request, context),
      POST: (request, context) => handleRequest('POST', request, context),
    }
  }

  private static commitOutcome(
    outcome: ForgeOutcome<unknown>,
    request: Request,
    bindings: RecordingResponseBindings,
  ): Response {
    if (outcome.kind === 'navigate') {
      const location = new URL(outcome.url, request.url).toString()

      return bindings.applyTo(new Response(undefined, { status: 302, headers: { location } }))
    }

    if (outcome.kind === 'error') {
      return bindings.applyTo(new Response(outcome.error.message, { status: outcome.error.status }))
    }

    if (!outcome.output) {
      return bindings.applyTo(new Response('Render outcome produced no output - renderer not bound', { status: 500 }))
    }

    const html = `<!DOCTYPE html>${renderToStaticMarkup(outcome.output as ReactNode)}`

    return bindings.applyTo(
      new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    )
  }
}
