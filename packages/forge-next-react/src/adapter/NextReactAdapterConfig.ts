import type {
  AdapterRenderBlockInput,
  AdapterRouteMatch,
  AdapterWrapNestedBlockInput,
} from '@ministryofjustice/hmpps-forge/core'
import { BufferedResponseBindings } from '@ministryofjustice/hmpps-forge/core'
import type { ForgeTopology, RequestSnapshot, ResponseBindings } from '@ministryofjustice/hmpps-forge/core/framework'
import { extractPathname } from '@ministryofjustice/hmpps-forge/core/framework'
import type { ReactNode } from 'react'

import type { ReactRenderedBlock } from '../renderer/ReactRenderer'
import { ReactRenderer } from '../renderer/ReactRenderer'
import {
  applyResponseBindings,
  loadSession,
  resolveRoute,
  toSnapshot,
  type NextForgeSessionStore,
} from './forgeRequest'
import type NextReactAdapterInput from './NextReactAdapterInput.type'

export interface NextReactAdapterConfigOptions {
  readonly sessionStore?: NextForgeSessionStore
}

export default abstract class NextReactAdapterConfig<TNativeInput extends NextReactAdapterInput> {
  constructor(
    protected readonly renderer: ReactRenderer,
    private readonly options: NextReactAdapterConfigOptions = {},
  ) {}

  resolveRoute(input: TNativeInput, topology: ForgeTopology): AdapterRouteMatch | undefined {
    return resolveRoute(topology.routes, input.method, extractPathname(input.request.url))
  }

  createResponseBindings(_input: TNativeInput): ResponseBindings {
    return new BufferedResponseBindings()
  }

  async createSnapshot(
    input: TNativeInput,
    match: AdapterRouteMatch,
    _response: ResponseBindings,
  ): Promise<RequestSnapshot> {
    const session = await loadSession(input.request, this.options.sessionStore)

    return toSnapshot(match.route, match.params, input.method, input.request, session, input.state, input.context)
  }

  renderBlock(input: AdapterRenderBlockInput<ReactNode, ReactRenderedBlock>): Promise<ReactNode> {
    return this.renderer.renderBlock(input.entry, input.block)
  }

  wrapNestedBlock(input: AdapterWrapNestedBlockInput<ReactNode>): ReactRenderedBlock {
    return this.renderer.wrapNestedBlock(input.block, input.output)
  }

  protected async saveSession(
    input: TNativeInput,
    snapshot: RequestSnapshot | undefined,
    response: Response,
  ): Promise<void> {
    if (snapshot === undefined) {
      return
    }

    await this.options.sessionStore?.save(snapshot.session, response, input.request)
  }

  protected applyResponseBindings(response: Response, bindings: ResponseBindings): Response {
    return applyResponseBindings(response, bindings)
  }
}
