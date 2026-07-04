import type { Forge } from '@ministryofjustice/hmpps-forge/core'

import { ReactRenderer, type ReactRendererOptions } from '../renderer/ReactRenderer'
import type { NextForgeSessionStore, NextRouteContext } from './types'
import NextForgeHandlerFactory from './NextForgeHandlerFactory'

export interface NextForgeHandler {
  GET(request: Request, context?: NextRouteContext): Promise<Response>
  POST(request: Request, context?: NextRouteContext): Promise<Response>
}

export interface NextForgeHandlerOptions extends ReactRendererOptions {
  sessionStore?: NextForgeSessionStore
}

/**
 * Build Next.js route handlers that serve a configured {@link Forge} instance.
 *
 * The returned `{ GET, POST }` handlers resolve the route from the topology
 * (404 / 405 before touching the engine), build a snapshot, call
 * `forge.execute`, persist the session, and dispatch the outcome. This factory
 * owns only the Next route-handler transport; Forge owns request evaluation and
 * rendering.
 */
export function createNextForgeHandler(forge: Forge, options: NextForgeHandlerOptions = {}): NextForgeHandler {
  const renderer = new ReactRenderer(options)
  const topology = forge.getTopology()
  const logger = forge.getLogger()

  return NextForgeHandlerFactory.create(forge, topology, logger, renderer, options.sessionStore)
}
