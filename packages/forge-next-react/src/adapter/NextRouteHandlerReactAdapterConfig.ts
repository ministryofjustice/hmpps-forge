import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import type {
  AdapterAssembleRenderInput,
  AdapterCommitInput,
  ForgeAdapterConfig,
} from '@ministryofjustice/hmpps-forge/core'
import type { ForgeError, ForgeErrorCode } from '@ministryofjustice/hmpps-forge/core/framework'

import type { ReactRenderedBlock } from '../renderer/ReactRenderer'
import NextReactAdapterConfig from './NextReactAdapterConfig'
import type NextReactAdapterInput from './NextReactAdapterInput.type'

export default class NextRouteHandlerReactAdapterConfig
  extends NextReactAdapterConfig<NextReactAdapterInput>
  implements ForgeAdapterConfig<NextReactAdapterInput, Response, ReactNode, ReactNode, ReactRenderedBlock>
{
  assembleRender(input: AdapterAssembleRenderInput<ReactNode>): ReactNode {
    return this.renderer.assemblePage(input.context, input.renderedBlocks, input.requestState)
  }

  async commit(input: AdapterCommitInput<NextReactAdapterInput, ReactNode>): Promise<Response> {
    if (input.outcome.kind === 'navigate') {
      const redirectUrl = new URL(input.outcome.url, input.input.request.url)
      const response = new Response(undefined, {
        status: 302,
        headers: { location: redirectUrl.toString() },
      })
      const boundResponse = this.applyResponseBindings(response, input.response)

      await this.saveSession(input.input, input.snapshot, boundResponse)

      return boundResponse
    }

    if (input.outcome.kind === 'error') {
      const response = new Response(input.outcome.error.message, { status: this.errorToStatus(input.outcome.error) })
      const boundResponse = this.applyResponseBindings(response, input.response)

      await this.saveSession(input.input, input.snapshot, boundResponse)

      return boundResponse
    }

    const output = this.requireOutput(input)
    const html = `<!DOCTYPE html>${renderToStaticMarkup(output)}`
    const response = new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    })
    const boundResponse = this.applyResponseBindings(response, input.response)

    await this.saveSession(input.input, input.snapshot, boundResponse)

    return boundResponse
  }

  private errorToStatus(error: ForgeError): number {
    if ('status' in error) {
      return error.status
    }

    return ERROR_CODE_STATUS[error.code]
  }

  private requireOutput(input: AdapterCommitInput<NextReactAdapterInput, ReactNode>): ReactNode {
    if (input.outcome.kind !== 'render' || input.outcome.output === undefined) {
      throw new Error('Render outcome produced no output - renderer not bound')
    }

    return input.outcome.output
  }
}

const ERROR_CODE_STATUS: Record<ForgeErrorCode, number> = {
  'node-not-found': 404,
  'method-not-supported': 405,
}
