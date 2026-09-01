import OpenAI from 'openai'
import type { ResponseCreateParamsNonStreaming, ResponsesClientEvent } from 'openai/resources/responses/responses'
import { ResponsesWS } from 'openai/resources/responses/ws'
import { z } from 'zod'

import type { OpenAIResponsesClient } from './OpenAISupplier'

const completedResponseSchema = z.object({
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(
          z.object({
            type: z.string(),
            text: z.string().optional(),
          }),
        )
        .optional(),
    }),
  ),
})

interface OpenAIWebSocketServerEvent {
  readonly type: string
  readonly stream_id?: string
  readonly response?: {
    readonly error?: { readonly message?: string } | null
    readonly output?: unknown
  }
}

interface OpenAIWebSocketStreamEvent {
  readonly type: string
  readonly message?: OpenAIWebSocketServerEvent
  readonly error?: Error
  readonly reason?: string
}

export interface OpenAIResponsesWebSocket {
  send(event: ResponsesClientEvent): void
  stream(): AsyncIterableIterator<OpenAIWebSocketStreamEvent>
  close(): void
}

export interface OpenAIWebSocketResponsesClientOptions {
  readonly apiKey?: string
}

/** Sends Responses API requests over one persistent WebSocket connection. */
export class OpenAIWebSocketResponsesClient implements OpenAIResponsesClient {
  private readonly responsesClient: OpenAIResponsesClient['responses']

  private streamSequence = 0

  constructor(
    options: OpenAIWebSocketResponsesClientOptions = {},
    private readonly socket: OpenAIResponsesWebSocket = new ResponsesWS(new OpenAI({ apiKey: options.apiKey })),
  ) {
    this.responsesClient = {
      create: request => this.createResponse(request),
    }
  }

  get responses(): OpenAIResponsesClient['responses'] {
    return this.responsesClient
  }

  close(): void {
    this.socket.close()
  }

  private async createResponse(request: ResponseCreateParamsNonStreaming): Promise<{ readonly output_text: string }> {
    const streamId = `forge-llm-${++this.streamSequence}`
    const events = this.socket.stream()

    this.socket.send(this.buildEvent(request, streamId))

    for await (const event of events) {
      if (event.type === 'error') {
        throw event.error ?? new Error('OpenAI WebSocket failed')
      }

      if (event.type === 'close') {
        throw new Error(`OpenAI WebSocket closed before completing the response: ${event.reason ?? 'unknown reason'}`)
      }

      if (event.type !== 'message' || event.message?.stream_id !== streamId) {
        continue
      }

      if (event.message.type === 'response.completed') {
        return { output_text: this.readOutputText(event.message.response?.output) }
      }

      if (event.message.type === 'response.failed' || event.message.type === 'response.incomplete') {
        throw new Error(event.message.response?.error?.message ?? `OpenAI ${event.message.type}`)
      }
    }

    throw new Error('OpenAI WebSocket closed before completing the response')
  }

  private buildEvent(request: ResponseCreateParamsNonStreaming, streamId: string): ResponsesClientEvent {
    const { background: _background, stream: _stream, ...response } = request

    return {
      ...response,
      type: 'response.create',
      stream_id: streamId,
    }
  }

  private readOutputText(output: unknown): string {
    const parsed = completedResponseSchema.safeParse({ output })

    if (!parsed.success) {
      return ''
    }

    return parsed.data.output
      .filter(item => item.type === 'message')
      .flatMap(item => item.content ?? [])
      .filter(content => content.type === 'output_text')
      .map(content => content.text ?? '')
      .join('')
  }
}
