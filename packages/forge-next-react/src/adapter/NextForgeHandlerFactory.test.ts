import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Forge, ForgeExecutionRequest } from '@ministryofjustice/hmpps-forge/core'
import type { ForgeOutcome, ForgeTopology, Logger } from '@ministryofjustice/hmpps-forge/core/framework'

import NextForgeHandlerFactory from './NextForgeHandlerFactory'
import { ReactRenderer } from '../renderer/ReactRenderer'

const topology: ForgeTopology = {
  routes: [
    {
      nodeId: 'journey::step',
      kind: 'step',
      templatePath: '/step',
      basePath: '/journey',
      methods: ['GET', 'POST'],
    },
  ],
}

describe('NextForgeHandlerFactory', () => {
  describe('create()', () => {
    it('should return a 302 with a resolved location when Forge navigates', async () => {
      // Arrange
      const forge = createForge({ kind: 'navigate', url: '/journey/next' })
      const handler = NextForgeHandlerFactory.create(forge, topology, createLogger(), new ReactRenderer())
      const request = new Request('http://localhost/step')

      // Act
      const response = await handler.GET(request)

      // Assert
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('http://localhost/journey/next')
    })

    it('should return the error status and message body when Forge returns an error outcome', async () => {
      // Arrange
      const forge = createForge({ kind: 'error', error: { status: 400, message: 'Bad input' } })
      const handler = NextForgeHandlerFactory.create(forge, topology, createLogger(), new ReactRenderer())
      const request = new Request('http://localhost/step')

      // Act
      const response = await handler.GET(request)
      const body = await response.text()

      // Assert
      expect(response.status).toBe(400)
      expect(body).toBe('Bad input')
    })

    it('should return 200 text/html with the rendered markup when Forge renders output', async () => {
      // Arrange
      const output = createElement('p', { id: 'greeting' }, 'Hello')
      const forge = createForge({ kind: 'render', context: {} as never, output })
      const handler = NextForgeHandlerFactory.create(forge, topology, createLogger(), new ReactRenderer())
      const request = new Request('http://localhost/step')

      // Act
      const response = await handler.GET(request)
      const body = await response.text()

      // Assert
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
      expect(body).toContain('<p id="greeting">Hello</p>')
    })

    it('should apply recorded response bindings to the dispatched response', async () => {
      // Arrange
      const forge = {
        execute: vi.fn(async (request: ForgeExecutionRequest): Promise<ForgeOutcome<unknown>> => {
          request.responseBindings?.setHeader('x-recorded', 'yes')

          return { kind: 'navigate', url: '/journey/next' }
        }),
      } as unknown as Forge
      const handler = NextForgeHandlerFactory.create(forge, topology, createLogger(), new ReactRenderer())
      const request = new Request('http://localhost/step')

      // Act
      const response = await handler.GET(request)

      // Assert
      expect(response.headers.get('x-recorded')).toBe('yes')
    })
  })
})

function createForge(outcome: ForgeOutcome<unknown>): Forge {
  return {
    execute: vi.fn().mockResolvedValue(outcome),
  } as unknown as Forge
}

function createLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}
