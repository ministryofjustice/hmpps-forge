import { randomUUID } from 'node:crypto'

import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import {
  LlmAdapter,
  type LlmAdapterResult,
  type LlmSupplier,
} from '@ministryofjustice/hmpps-forge/llm-adapter'
import type MarkdownIt from 'markdown-it'
import createMarkdownIt from 'markdown-it'

import {
  type LlmWebchatHostSession,
  type LlmWebchatMessage,
  LlmWebchatSessionStore,
} from './LlmWebchatSessionStore'

export interface LlmWebchatView {
  readonly messages: readonly LlmWebchatMessage[]
  readonly status?: LlmAdapterResult['status']
  readonly navigationUrl?: string
}

export interface LlmWebchatUpdate extends LlmWebchatView {
  readonly assistantMessage?: LlmWebchatMessage
}

/** Owns the application-session presentation state around one LLM adapter conversation. */
export class LlmWebchat {
  private static readonly entryPath = '/llm-demo/housing-situation'

  private static readonly markdown = LlmWebchat.createMarkdown()

  constructor(
    private readonly forge: Forge,
    private readonly supplier: LlmSupplier,
    private readonly hostSession: LlmWebchatHostSession,
    private readonly origin: string,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = randomUUID,
  ) {}

  private static createMarkdown(): MarkdownIt {
    const markdown = createMarkdownIt({
      breaks: true,
      html: false,
      linkify: false,
      typographer: false,
    })

    markdown.renderer.rules.hr = () => '<hr class="llm-webchat__content-rule">\n'
    markdown.renderer.rules.image = (tokens, index) =>
      markdown.utils.escapeHtml(tokens[index].content)

    return markdown
  }

  async start(): Promise<LlmWebchatView> {
    if (this.hostSession.llmWebchat?.adapterSession !== undefined) {
      return this.getView()
    }

    const conversationId = this.createId()

    this.hostSession.llmWebchat = { conversationId, messages: [] }

    try {
      const result = await this.createAdapter().start({
        conversationId,
        entryPath: LlmWebchat.entryPath,
      })

      this.recordResult(result)

      return this.getView()
    } catch (error) {
      delete this.hostSession.llmWebchat

      throw error
    }
  }

  async respond(message: string): Promise<LlmWebchatUpdate> {
    const webchatSession = this.requireSession()
    const trimmedMessage = message.trim()

    if (trimmedMessage.length === 0) {
      throw new TypeError('Enter a message before sending it')
    }

    if (trimmedMessage.length > 2000) {
      throw new TypeError('Enter a message containing 2,000 characters or fewer')
    }

    if (webchatSession.status !== 'awaiting-input') {
      throw new Error('This LLM webchat conversation is no longer awaiting a response')
    }

    webchatSession.messages.push(this.createMessage(trimmedMessage, 'sent', 'You'))

    const result = await this.createAdapter().respond({
      conversationId: webchatSession.conversationId,
      message: trimmedMessage,
    })
    const assistantMessage = this.recordResult(result)

    return { ...this.getView(), ...(assistantMessage === undefined ? {} : { assistantMessage }) }
  }

  async reset(): Promise<void> {
    const webchatSession = this.hostSession.llmWebchat

    if (webchatSession === undefined) {
      return
    }

    await this.createAdapter().end({ conversationId: webchatSession.conversationId })
    delete this.hostSession.llmWebchat
  }

  getView(): LlmWebchatView {
    const webchatSession = this.hostSession.llmWebchat

    if (webchatSession === undefined) {
      return { messages: [] }
    }

    return {
      messages: [...webchatSession.messages],
      ...(webchatSession.status === undefined ? {} : { status: webchatSession.status }),
      ...(webchatSession.navigationUrl === undefined
        ? {}
        : { navigationUrl: webchatSession.navigationUrl }),
    }
  }

  private createAdapter(): LlmAdapter {
    return new LlmAdapter({
      forge: this.forge,
      supplier: this.supplier,
      sessionStore: new LlmWebchatSessionStore(this.hostSession),
      origin: this.origin,
    })
  }

  private recordResult(result: LlmAdapterResult): LlmWebchatMessage | undefined {
    const webchatSession = this.requireSession()
    const text = result.status === 'navigate' ? `Continue at ${result.url}` : result.message
    const assistantMessage =
      text.length === 0 ? undefined : this.createMessage(text, 'received', 'Forge assistant')

    if (assistantMessage !== undefined) {
      webchatSession.messages.push(assistantMessage)
    }

    webchatSession.status = result.status

    if (result.status === 'navigate') {
      webchatSession.navigationUrl = this.toSafeNavigationUrl(result.url)
    } else {
      delete webchatSession.navigationUrl
    }

    return assistantMessage
  }

  private toSafeNavigationUrl(path: string): string | undefined {
    const url = new URL(path, this.origin)

    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  }

  private createMessage(
    text: string,
    type: LlmWebchatMessage['type'],
    sender: string,
  ): LlmWebchatMessage {
    return {
      id: this.createId(),
      text,
      ...(type === 'received' ? { html: LlmWebchat.markdown.render(text) } : {}),
      type,
      sender,
      timestamp: this.now().toISOString(),
    }
  }

  private requireSession() {
    const webchatSession = this.hostSession.llmWebchat

    if (webchatSession === undefined || webchatSession.adapterSession === undefined) {
      throw new Error('Start the LLM webchat conversation before responding')
    }

    return webchatSession
  }
}
