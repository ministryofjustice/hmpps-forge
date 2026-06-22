import type { ComponentType, ReactNode } from 'react'
import { notFound, redirect } from 'next/navigation'
import type {
  AdapterAssembleRenderInput,
  AdapterCommitInput,
  ForgeAdapterConfig,
} from '@ministryofjustice/hmpps-forge/core'
import type { ForgeEngineError } from '@ministryofjustice/hmpps-forge/core/framework'
import type {
  ForgeActionFormProps,
  NextForgeFormAction,
  NextForgeFormState,
} from '@ministryofjustice/hmpps-forge/next-react/client'
import { ForgeActionForm } from '@ministryofjustice/hmpps-forge/next-react/client'

import { FORGE_REACT_ACTION, type ReactRenderedBlock, type ReactRenderer } from '../renderer/ReactRenderer'
import NextReactAdapterConfig, { type NextReactAdapterConfigOptions } from './NextReactAdapterConfig'
import type NextReactAdapterInput from './NextReactAdapterInput.type'
import { createFormState } from './nextReactFormState'

export interface NextPageRenderOutput {
  readonly node: ReactNode
  readonly formState: NextForgeFormState
}

export interface NextPageReactAdapterConfigOptions {
  readonly submit?: NextForgeFormAction
  readonly actionForm?: ComponentType<ForgeActionFormProps>
}

export default class NextPageReactAdapterConfig
  extends NextReactAdapterConfig<NextReactAdapterInput>
  implements ForgeAdapterConfig<NextReactAdapterInput, ReactNode, ReactNode, NextPageRenderOutput, ReactRenderedBlock>
{
  private readonly pageOptions: NextPageReactAdapterConfigOptions

  constructor(
    renderer: ReactRenderer,
    pageOptions: NextPageReactAdapterConfigOptions = {},
    adapterOptions: NextReactAdapterConfigOptions = {},
  ) {
    super(renderer, adapterOptions)
    this.pageOptions = pageOptions
  }

  assembleRender(input: AdapterAssembleRenderInput<ReactNode>): NextPageRenderOutput {
    const node = this.renderer.assemblePage(input.context, input.renderedBlocks, input.requestState)
    const path = this.resolveActionPath(input.requestState, input.context.step.path)
    const formState = createFormState(path, input.context, input.renderedBlocks)

    return { node, formState }
  }

  async commit(input: AdapterCommitInput<NextReactAdapterInput, NextPageRenderOutput>): Promise<ReactNode> {
    if (input.outcome.kind === 'navigate') {
      redirect(this.toRedirectUrl(input.outcome.url, input.input.request))
    }

    if (input.outcome.kind === 'error') {
      if (this.isEngineError(input.outcome.error) && input.outcome.error.code === 'node-not-found') {
        notFound()
      }

      throw new Error(input.outcome.error.message)
    }

    const response = this.applyResponseBindings(new Response(undefined), input.response)

    await this.saveSession(input.input, input.snapshot, response)

    if (this.pageOptions.submit !== undefined) {
      const ActionForm = this.pageOptions.actionForm ?? ForgeActionForm

      return <ActionForm initialState={this.requireOutput(input).formState} action={this.pageOptions.submit} />
    }

    return this.requireOutput(input).node
  }

  private resolveActionPath(requestState: Record<string, unknown>, fallbackPath: string): string {
    const action = requestState[FORGE_REACT_ACTION]

    return typeof action === 'string' ? action : fallbackPath
  }

  private requireOutput(input: AdapterCommitInput<NextReactAdapterInput, NextPageRenderOutput>): NextPageRenderOutput {
    if (input.outcome.kind !== 'render' || input.outcome.output === undefined) {
      throw new Error('Render outcome produced no output - renderer not bound')
    }

    return input.outcome.output
  }

  private toRedirectUrl(url: string, request: Request): string {
    if (url.includes('://') || url.startsWith('/')) {
      return url
    }

    const resolved = new URL(url, request.url)

    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  }

  private isEngineError(error: unknown): error is ForgeEngineError {
    return typeof error === 'object' && error !== null && 'code' in error
  }
}
