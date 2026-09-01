import type { ResponsesClientEvent } from 'openai/resources/responses/responses'

import { OpenAIWebSocketResponsesClient, type OpenAIResponsesWebSocket } from './OpenAIWebSocketResponsesClient'

describe('OpenAIWebSocketResponsesClient', () => {
  describe('responses.create()', () => {
    it('should resolve structured output over the persistent connection', async () => {
      // Arrange
      const sentEvents: ResponsesClientEvent[] = []
      const socket: OpenAIResponsesWebSocket = {
        send: event => sentEvents.push(event),
        stream: () =>
          (async function* responseEvents() {
            yield { type: 'open' }
            yield {
              type: 'message',
              message: {
                type: 'response.completed',
                stream_id: 'forge-llm-1',
                response: {
                  output: [
                    {
                      type: 'message',
                      content: [{ type: 'output_text', text: '{"answers":{"ownsProperty":"yes"}}' }],
                    },
                  ],
                },
              },
            }
          })(),
        close: vi.fn(),
      }
      const client = new OpenAIWebSocketResponsesClient({}, socket)

      // Act
      const response = await client.responses.create({
        model: 'gpt-5.6-luna',
        input: 'Yes',
        background: false,
        stream: false,
      })

      // Assert
      expect(response).toEqual({ output_text: '{"answers":{"ownsProperty":"yes"}}' })
      expect(sentEvents).toEqual([
        {
          type: 'response.create',
          stream_id: 'forge-llm-1',
          model: 'gpt-5.6-luna',
          input: 'Yes',
        },
      ])
    })

    it('should close the persistent connection when requested', () => {
      // Arrange
      const close = vi.fn()
      const socket: OpenAIResponsesWebSocket = {
        send: vi.fn(),
        stream: () =>
          (async function* responseEvents() {
            yield { type: 'open' }
          })(),
        close,
      }
      const client = new OpenAIWebSocketResponsesClient({}, socket)

      // Act
      client.close()

      // Assert
      expect(close).toHaveBeenCalledOnce()
    })
  })
})
