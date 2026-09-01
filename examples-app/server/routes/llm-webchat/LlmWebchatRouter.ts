import createError from 'http-errors'
import { Router, type NextFunction, type Request, type Response } from 'express'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import type { LlmSupplier } from '@ministryofjustice/hmpps-forge/llm-adapter'

import logger from '../../logger'
import { LlmWebchat } from './LlmWebchat'

interface LlmWebchatRouterOptions {
  readonly forge: Forge
  readonly supplier: LlmSupplier
  readonly origin: string
  readonly enabled: boolean
}

interface LlmWebchatStreamEvent {
  readonly type: 'accepted' | 'result' | 'error'
  readonly message?: string
  readonly html?: string
  readonly status?: 'awaiting-input' | 'complete' | 'navigate'
  readonly navigationUrl?: string
  readonly timestamp?: string
}

/** Express transport for the session-backed LLM webchat example. */
export class LlmWebchatRouter {
  constructor(private readonly options: LlmWebchatRouterOptions) {}

  create(): Router {
    const router = Router()

    router.get('/llm-webchat', (request, response, next) => this.show(request, response, next))
    router.post('/llm-webchat/messages', (request, response, next) =>
      this.respond(request, response, next),
    )
    router.post('/llm-webchat/messages/stream', (request, response) =>
      this.streamResponse(request, response),
    )
    router.post('/llm-webchat/reset', (request, response, next) =>
      this.reset(request, response, next),
    )

    return router
  }

  private async show(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      const view = await this.createWebchat(request).start()

      response.render('pages/llm-webchat', { ...view, llmEnabled: this.options.enabled })
    } catch (error) {
      next(error)
    }
  }

  private async respond(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      this.assertEnabled()
      await this.createWebchat(request).respond(this.readMessage(request))
      response.redirect(303, '/llm-webchat')
    } catch (error) {
      next(error)
    }
  }

  private async streamResponse(request: Request, response: Response): Promise<void> {
    response.status(200)
    response.type('application/x-ndjson')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders()

    try {
      this.assertEnabled()

      const message = this.readMessage(request)

      this.writeEvent(response, { type: 'accepted', message, timestamp: new Date().toISOString() })

      const update = await this.createWebchat(request).respond(message)

      this.writeEvent(response, {
        type: 'result',
        message: update.assistantMessage?.text,
        html: update.assistantMessage?.html,
        timestamp: update.assistantMessage?.timestamp,
        status: update.status,
        navigationUrl: update.navigationUrl,
      })
    } catch (error) {
      logger.error({ err: error }, 'LLM webchat streaming response failed')
      this.writeEvent(response, {
        type: 'error',
        message:
          error instanceof TypeError
            ? error.message
            : 'The Forge assistant could not respond. Try again in a moment.',
      })
    } finally {
      response.end()
    }
  }

  private async reset(request: Request, response: Response, next: NextFunction): Promise<void> {
    try {
      await this.createWebchat(request).reset()
      response.redirect(303, '/llm-webchat')
    } catch (error) {
      next(error)
    }
  }

  private createWebchat(request: Request): LlmWebchat {
    return new LlmWebchat(
      this.options.forge,
      this.options.supplier,
      request.session,
      this.options.origin,
    )
  }

  private readMessage(request: Request): string {
    const message = request.body?.message

    if (typeof message !== 'string') {
      throw new TypeError('Enter a message before sending it')
    }

    return message
  }

  private assertEnabled(): void {
    if (!this.options.enabled) {
      throw createError(503, 'Set OPENAI_API_KEY to use the LLM webchat example')
    }
  }

  private writeEvent(response: Response, event: LlmWebchatStreamEvent): void {
    response.write(`${JSON.stringify(event)}\n`)
  }
}
