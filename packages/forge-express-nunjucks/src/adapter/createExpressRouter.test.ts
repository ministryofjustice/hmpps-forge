import type { NextFunction, Request, Response, Router } from 'express'
import type { Environment } from 'nunjucks'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import type { ForgeRoute } from '@ministryofjustice/hmpps-forge/core/framework'
import { createExpressRouter } from './createExpressRouter'

interface TestRouter {
  handle(req: Request, res: Response, next: (error?: unknown) => void): void
}

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getTopology: vi.fn(),
}))

const route: ForgeRoute = {
  nodeId: 'step-one',
  kind: 'step',
  templatePath: '/step-one',
  basePath: '',
  methods: ['GET'],
}

describe('createExpressRouter', () => {
  beforeEach(() => {
    mocks.execute.mockReset()
    mocks.getTopology.mockReset()

    mocks.getTopology.mockReturnValue({ routes: [route] })
    mocks.execute.mockResolvedValue({ kind: 'navigate', url: '/next' })
  })

  describe('route registration', () => {
    it('should dispatch request snapshots through Forge', async () => {
      // Arrange
      const forge = createForge()
      const router = createExpressRouter(forge, { nunjucksEnv: createNunjucksEnv() })
      const req = createRequest()
      const res = createResponse()
      const next = vi.fn()

      // Act
      dispatchRouter(router, req, res, next)

      // Assert
      expect(mocks.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshot: expect.objectContaining({
            nodeId: 'step-one',
            method: 'GET',
            location: expect.objectContaining({ pathname: '/step-one' }),
          }),
          responseBindings: expect.any(Object),
          renderer: expect.any(Object),
        }),
      )
    })
  })

  describe('request handling', () => {
    it('should defer request dependency resolution to Forge', async () => {
      // Arrange
      const resolvedDependencies = { authenticatedHttp: { user: 'user-1' } }
      const requestDependencies = vi.fn(() => resolvedDependencies)
      const router = createExpressRouter(createForge(), {
        nunjucksEnv: createNunjucksEnv(),
        requestDependencies,
      })
      const req = createRequest()
      const res = createResponse()
      const next = vi.fn()

      // Act
      dispatchRouter(router, req, res, next)
      await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce())

      // Assert
      expect(requestDependencies).not.toHaveBeenCalled()

      const executionRequest = mocks.execute.mock.calls[0][0]
      const result = executionRequest.requestDependencies()

      expect(requestDependencies).toHaveBeenCalledWith(req)
      expect(result).toBe(resolvedDependencies)
    })

    it('should pass unexpected runtime errors to next', async () => {
      // Arrange
      const error = new Error('boom')
      mocks.execute.mockRejectedValue(error)
      const router = createExpressRouter(createForge(), { nunjucksEnv: createNunjucksEnv() })
      const req = createRequest()
      const res = createResponse()
      const next = vi.fn()

      // Act
      await handleRouter(router, req, res, next)

      // Assert
      expect(next).toHaveBeenCalledWith(error)
    })
  })
})

function createForge(): Forge {
  return {
    getLogger: () => ({ debug: vi.fn() }),
    getTopology: mocks.getTopology,
    execute: mocks.execute,
  } as unknown as Forge
}

function createNunjucksEnv(): Environment {
  return {
    getTemplate: vi.fn(),
  } as unknown as Environment
}

function createRequest(): Request {
  return {
    method: 'GET',
    url: '/step-one',
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

function createResponse(): Response {
  return {
    locals: {},
    getHeader: vi.fn(),
    getHeaders: vi.fn(() => ({})),
    setHeader: vi.fn(),
    cookie: vi.fn(),
    redirect: vi.fn(),
    send: vi.fn(),
    type: vi.fn(),
  } as unknown as Response
}

function dispatchRouter(router: Router, req: Request, res: Response, next: NextFunction): void {
  const testRouter = router as unknown as TestRouter

  testRouter.handle(req, res, next)
}

async function handleRouter(router: Router, req: Request, res: Response, next: NextFunction): Promise<void> {
  const testRouter = router as unknown as TestRouter

  await new Promise<void>(resolve => {
    testRouter.handle(req, res, error => {
      next(error)
      resolve()
    })
  })
}
