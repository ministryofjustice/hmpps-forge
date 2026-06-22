import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import type {
  AdapterAssembleRenderInput,
  AdapterCommitInput,
  ForgeAdapterConfig,
} from '@ministryofjustice/hmpps-forge/core'
import type { NextForgeFormState } from '@ministryofjustice/hmpps-forge/next-react/client'

import type { ReactRenderedBlock } from '../renderer/ReactRenderer'
import NextReactAdapterConfig from './NextReactAdapterConfig'
import type NextReactAdapterInput from './NextReactAdapterInput.type'
import { FORGE_REACT_ACTION } from '../renderer/ReactRenderer'
import { createFormState } from './nextReactFormState'

export default class NextActionReactAdapterConfig
  extends NextReactAdapterConfig<NextReactAdapterInput>
  implements
    ForgeAdapterConfig<NextReactAdapterInput, NextForgeFormState, ReactNode, NextForgeFormState, ReactRenderedBlock>
{
  assembleRender(input: AdapterAssembleRenderInput<ReactNode>): NextForgeFormState {
    const action = input.requestState[FORGE_REACT_ACTION]
    const path = typeof action === 'string' ? action : input.context.step.path

    return createFormState(path, input.context, input.renderedBlocks)
  }

  async commit(input: AdapterCommitInput<NextReactAdapterInput, NextForgeFormState>): Promise<NextForgeFormState> {
    if (input.outcome.kind === 'navigate') {
      redirect(this.toRedirectUrl(input.outcome.url, input.input.request))
    }

    if (input.outcome.kind === 'error') {
      if (input.match === undefined) {
        throw new Error(`No Forge POST route matched for path "${this.requestPath(input.input.request)}".`)
      }

      throw new Error(input.outcome.error.message)
    }

    const response = this.applyResponseBindings(new Response(undefined), input.response)

    await this.saveSession(input.input, input.snapshot, response)

    return this.requireOutput(input)
  }

  private requireOutput(input: AdapterCommitInput<NextReactAdapterInput, NextForgeFormState>): NextForgeFormState {
    if (input.outcome.kind !== 'render' || input.outcome.output === undefined) {
      throw new Error('Render outcome produced no output - renderer not bound')
    }

    return input.outcome.output
  }

  private requestPath(request: Request): string {
    const url = new URL(request.url)

    return url.pathname
  }

  private toRedirectUrl(url: string, request: Request): string {
    if (url.includes('://') || url.startsWith('/')) {
      return url
    }

    const resolved = new URL(url, request.url)

    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  }
}
