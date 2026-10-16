import express from 'express'
import type { NextFunction, Request, Response, Router } from 'express'
import type { Environment } from 'nunjucks'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import type { ForgeRoute } from '@ministryofjustice/hmpps-forge/core/framework'
import { createExpressRouter, RequestBodyType } from './createExpressRouter'

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

const postRoute: ForgeRoute = {
  ...route,
  methods: ['POST'],
}

const formHeaders = { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '11' }
const jsonHeaders = { 'content-type': 'application/json', 'content-length': '15' }

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

  describe('request body types', () => {
    beforeEach(() => {
      mocks.getTopology.mockReturnValue({ routes: [postRoute] })
    })

    it('should dispatch a form POST when accepted body types are left as the default', () => {
      // Arrange
      const router = createExpressRouter(createForge(), { nunjucksEnv: createNunjucksEnv() })
      const req = createRequest({ method: 'POST', headers: formHeaders })

      // Act
      dispatchRouter(router, req, createResponse(), vi.fn())

      // Assert
      expect(mocks.execute).toHaveBeenCalledOnce()
    })

    it('should reject a JSON POST with 415 when accepted body types are left as the default', async () => {
      // Arrange
      const router = createExpressRouter(createForge(), { nunjucksEnv: createNunjucksEnv() })
      const req = createRequest({ method: 'POST', headers: jsonHeaders })
      const next = vi.fn()

      // Act
      await handleRouter(router, req, createResponse(), next)

      // Assert
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 415, statusCode: 415, expose: true }))
      expect(mocks.execute).not.toHaveBeenCalled()
    })

    it('should dispatch a JSON POST when JSON is an accepted body type', () => {
      // Arrange
      const router = createExpressRouter(createForge(), {
        nunjucksEnv: createNunjucksEnv(),
        acceptedBodyTypes: [RequestBodyType.FORM, RequestBodyType.JSON],
      })
      const req = createRequest({ method: 'POST', headers: jsonHeaders })

      // Act
      dispatchRouter(router, req, createResponse(), vi.fn())

      // Assert
      expect(mocks.execute).toHaveBeenCalledOnce()
    })

    it('should dispatch a form POST when JSON is also an accepted body type', () => {
      // Arrange
      const router = createExpressRouter(createForge(), {
        nunjucksEnv: createNunjucksEnv(),
        acceptedBodyTypes: [RequestBodyType.FORM, RequestBodyType.JSON],
      })
      const req = createRequest({ method: 'POST', headers: formHeaders })

      // Act
      dispatchRouter(router, req, createResponse(), vi.fn())

      // Assert
      expect(mocks.execute).toHaveBeenCalledOnce()
    })

    it('should dispatch a POST when the request has no body', () => {
      // Arrange
      const router = createExpressRouter(createForge(), { nunjucksEnv: createNunjucksEnv() })
      const req = createRequest({ method: 'POST', headers: {} })

      // Act
      dispatchRouter(router, req, createResponse(), vi.fn())

      // Assert
      expect(mocks.execute).toHaveBeenCalledOnce()
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

function createRequest(overrides: Partial<Pick<Request, 'method' | 'headers'>> = {}): Request {
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
    is: express.request.is,
    ...overrides,
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
