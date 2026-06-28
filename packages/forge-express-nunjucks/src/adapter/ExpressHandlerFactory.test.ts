import type { Request, Response } from 'express'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import type { ForgeRenderer, ForgeRoute, Logger } from '@ministryofjustice/hmpps-forge/core/framework'
import ExpressHandlerFactory from './ExpressHandlerFactory'

const route: ForgeRoute = {
  nodeId: 'journey::step-one',
  kind: 'step',
  templatePath: '/step-one',
  basePath: '/journey',
  methods: ['GET'],
}

describe('ExpressHandlerFactory', () => {
  describe('create()', () => {
    it('should execute Forge with a snapshot and response bindings', async () => {
      // Arrange
      const forge = createForge()
      const req = createRequest()
      const res = createResponse()
      const next = vi.fn()
      const handler = ExpressHandlerFactory.create(forge, route, createLogger(), createRenderer())

      // Act
      await handler(req, res, next)

      // Assert
      expect(forge.execute).toHaveBeenCalledWith({
        snapshot: expect.objectContaining({ nodeId: route.nodeId, method: 'GET' }),
        responseBindings: expect.any(Object),
        renderer: expect.any(Object),
      })
      expect(res.redirect).toHaveBeenCalledWith('/next')
    })

    it('should pass unexpected Forge errors to next', async () => {
      // Arrange
      const error = new Error('boom')
      const forge = createForge()
      const req = createRequest()
      const res = createResponse()
      const next = vi.fn()
      const handler = ExpressHandlerFactory.create(forge, route, createLogger(), createRenderer())

      vi.mocked(forge.execute).mockRejectedValue(error)

      // Act
      await handler(req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })
})

function createForge(): Forge {
  return {
    execute: vi.fn().mockResolvedValue({ kind: 'navigate', url: '/next' }),
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

function createRequest(): Request {
  return {
    method: 'GET',
    originalUrl: '/step-one',
    path: '/step-one',
    protocol: 'http',
    hostname: 'localhost',
    headers: {},
    cookies: {},
    params: {},
    query: {},
    body: {},
    app: { locals: {} },
  } as unknown as Request
}

function createRenderer(): ForgeRenderer<unknown> {
  return {
    renderBlock: vi.fn(),
    wrapNestedBlock: vi.fn(),
    assemblePage: vi.fn(),
  }
}

function createResponse(): Response {
  return {
    locals: {},
    setHeader: vi.fn(),
    cookie: vi.fn(),
    redirect: vi.fn(),
    send: vi.fn(),
    type: vi.fn(),
  } as unknown as Response
}
