import type express from 'express'
import type nunjucks from 'nunjucks'
import type { Forge } from '@ministryofjustice/hmpps-forge/core'
import { ForgeOrchestrator } from '@ministryofjustice/hmpps-forge/core'
import type { ForgeOutcome, ForgeRoute } from '@ministryofjustice/hmpps-forge/core/framework'
import NunjucksRenderer from '../renderer/NunjucksRenderer'
import { createExpressRouter } from './createExpressRouter'

const { evaluateMock, getTopologyMock } = vi.hoisted(() => ({
  evaluateMock: vi.fn(),
  getTopologyMock: vi.fn(),
}))

vi.mock('@ministryofjustice/hmpps-forge/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@ministryofjustice/hmpps-forge/core')>()

  return {
    ...actual,
    ForgeOrchestrator: vi.fn().mockImplementation(function mockForgeOrchestratorCtor() {
      return { evaluate: evaluateMock, getTopology: getTopologyMock }
    }),
  }
})

vi.mock('../renderer/NunjucksRenderer', () => ({
  default: vi.fn(),
}))

describe('createExpressRouter', () => {
  const nunjucksEnv = {} as nunjucks.Environment
  let forge: Forge

  beforeEach(() => {
    vi.clearAllMocks()

    forge = {
      getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    } as unknown as Forge

    getTopologyMock.mockReturnValue({ routes: [stepRoute()] })
    evaluateMock.mockResolvedValue(renderOutcome('<html>page</html>'))
  })

  function stepRoute(): ForgeRoute {
    return {
      nodeId: 'test-journey::compile_ast:2',
      kind: 'step',
      templatePath: '/journey/step-one',
      basePath: '/journey',
      methods: ['GET', 'POST'],
      title: 'Step One',
    }
  }

  function renderOutcome(output: string): ForgeOutcome<string> {
    return {
      kind: 'render',
      context: {} as never,
      componentRegistry: {} as never,
      output,
      renderedBlocks: [output],
    }
  }

  function createRequest(overrides: Record<string, unknown> = {}): express.Request {
    return {
      method: 'GET',
      url: '/journey/step-one',
      originalUrl: '/journey/step-one',
      protocol: 'http',
      hostname: 'localhost',
      headers: {},
      cookies: {},
      body: {},
      session: undefined,
      app: { locals: {} },
      ...overrides,
    } as unknown as express.Request
  }

  interface DispatchResult {
    kind: 'send' | 'redirect' | 'next'
    value: unknown
    contentType?: string
  }

  function dispatch(router: express.Router, req: express.Request, resLocals: Record<string, unknown> = {}) {
    return new Promise<DispatchResult>(resolve => {
      let contentType: string | undefined
      const res = {
        locals: resLocals,
        setHeader: vi.fn(),
        getHeader: vi.fn(),
        getHeaders: vi.fn().mockReturnValue({}),
        cookie: vi.fn(),
        redirect: (url: string) => resolve({ kind: 'redirect', value: url }),
        type: (value: string) => {
          contentType = value

          return res
        },
        send: (body: unknown) => resolve({ kind: 'send', value: body, contentType }),
      }

      router(req, res as unknown as express.Response, (err: unknown) => resolve({ kind: 'next', value: err }))
    })
  }

  describe('composition', () => {
    it('should compose a ForgeOrchestrator over a NunjucksRenderer built from the options', () => {
      // Arrange & Act
      createExpressRouter(forge, { nunjucksEnv, defaultTemplate: 'custom-step' })

      // Assert
      expect(NunjucksRenderer).toHaveBeenCalledWith({ nunjucksEnv, defaultTemplate: 'custom-step' })
      expect(ForgeOrchestrator).toHaveBeenCalledWith({
        core: forge,
        renderer: vi.mocked(NunjucksRenderer).mock.instances[0],
      })
    })

    it('should register one Express route per topology method', () => {
      // Arrange & Act
      const router = createExpressRouter(forge, { nunjucksEnv })

      // Assert
      const registered = router.stack.map(layer => {
        const route = layer.route as unknown as { path: string; methods: Record<string, boolean> } | undefined

        return { path: route?.path, methods: route?.methods }
      })
      expect(registered).toEqual([
        { path: '/journey/step-one', methods: { get: true } },
        { path: '/journey/step-one', methods: { post: true } },
      ])
    })
  })

  describe('request handling', () => {
    it('should send the orchestrator output as html when the outcome is render', async () => {
      // Arrange
      const router = createExpressRouter(forge, { nunjucksEnv })

      // Act
      const result = await dispatch(router, createRequest())

      // Assert
      expect(result).toEqual({ kind: 'send', value: '<html>page</html>', contentType: 'html' })
    })

    it('should redirect when the outcome is navigate', async () => {
      // Arrange
      evaluateMock.mockResolvedValue({ kind: 'navigate', url: '/journey/step-two' })
      const router = createExpressRouter(forge, { nunjucksEnv })

      // Act
      const result = await dispatch(router, createRequest())

      // Assert
      expect(result).toEqual({ kind: 'redirect', value: '/journey/step-two' })
    })

    it('should forward an http error when the outcome is an error', async () => {
      // Arrange
      evaluateMock.mockResolvedValue({
        kind: 'error',
        error: { code: 'node-not-found', message: 'No route registered' },
      })
      const router = createExpressRouter(forge, { nunjucksEnv })

      // Act
      const result = await dispatch(router, createRequest())

      // Assert
      expect(result.kind).toBe('next')
      expect(result.value).toMatchObject({ status: 404, message: 'No route registered' })
    })

    it('should merge app locals, response locals and request state into the snapshot state', async () => {
      // Arrange
      const router = createExpressRouter(forge, { nunjucksEnv })
      const req = createRequest({
        app: { locals: { fromApp: 'app', shared: 'app' } },
        state: { fromReq: 'req' },
      })

      // Act
      await dispatch(router, req, { fromRes: 'res', shared: 'res' })

      // Assert
      expect(evaluateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeId: 'test-journey::compile_ast:2',
          state: expect.objectContaining({ fromApp: 'app', fromRes: 'res', fromReq: 'req', shared: 'res' }),
        }),
        expect.objectContaining({ response: expect.anything() }),
      )
    })

    it('should exclude the express settings object from the snapshot state', async () => {
      // Arrange
      const router = createExpressRouter(forge, { nunjucksEnv })
      const req = createRequest({
        app: { locals: { fromApp: 'app', settings: { 'view engine': 'njk' } } },
      })

      // Act
      await dispatch(router, req)

      // Assert
      const snapshot = evaluateMock.mock.calls[0][0]

      expect(snapshot.state.fromApp).toBe('app')
      expect(snapshot.state.settings).toBeUndefined()
    })
  })
})
