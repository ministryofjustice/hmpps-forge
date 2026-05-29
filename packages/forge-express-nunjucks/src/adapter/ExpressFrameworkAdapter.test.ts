import express from 'express'
import nunjucks from 'nunjucks'

import { BlockType } from '@ministryofjustice/hmpps-forge/core/authoring'
import {
  ComponentRegistry,
  ForgeInstrumentation,
  FrameworkAdapter,
  StepHandler,
  RenderBlock,
  RenderContext,
} from '@ministryofjustice/hmpps-forge/core/framework'
import ExpressFrameworkAdapter from './ExpressFrameworkAdapter'

describe('ExpressFrameworkAdapter', () => {
  let adapter: FrameworkAdapter<express.Router, express.Request, express.Response>
  let mockNunjucksEnv: Mocked<nunjucks.Environment>
  let mockComponentRegistry: Mocked<ComponentRegistry>
  let mockLogger: Console
  let mockTemplate: { render: Mock }

  beforeEach(() => {
    mockTemplate = { render: vi.fn().mockReturnValue('<html>rendered</html>') }

    mockNunjucksEnv = {
      getTemplate: vi.fn().mockReturnValue(mockTemplate),
    } as unknown as Mocked<nunjucks.Environment>

    mockComponentRegistry = {
      get: vi.fn().mockReturnValue({
        render: vi.fn().mockResolvedValue('<div>Block HTML</div>'),
      }),
      getAll: vi.fn().mockReturnValue(new Map()),
    } as unknown as Mocked<ComponentRegistry>

    mockLogger = { debug: vi.fn() } as unknown as Console

    const builder = ExpressFrameworkAdapter.configure({ nunjucksEnv: mockNunjucksEnv })

    adapter = builder.build({ logger: mockLogger, instrumentation: new ForgeInstrumentation(undefined, mockLogger) })
  })

  describe('createRouter()', () => {
    it('should create an Express router', () => {
      // Act
      const router = adapter.createRouter()

      // Assert
      expect(router).toBeDefined()
      expect(typeof router.get).toBe('function')
      expect(typeof router.post).toBe('function')
      expect(typeof router.use).toBe('function')
    })
  })

  describe('mountRouter()', () => {
    it('should mount child router on parent at specified path', () => {
      // Arrange
      const parent = express.Router()
      const child = express.Router()
      const useSpy = vi.spyOn(parent, 'use')

      // Act
      adapter.mountRouter(parent, '/journey', child)

      // Assert
      expect(useSpy).toHaveBeenCalledWith('/journey', child)
    })
  })

  describe('get()', () => {
    it('should register GET route handler on router', () => {
      // Arrange
      const router = express.Router()
      const getSpy = vi.spyOn(router, 'get')
      const handler: StepHandler<express.Request, express.Response> = vi.fn().mockResolvedValue(undefined)

      // Act
      adapter.get(router, '/step-one', handler)

      // Assert
      expect(getSpy).toHaveBeenCalledWith('/step-one', expect.any(Function))
    })

    it('should wrap handler to catch async errors', async () => {
      // Arrange
      const error = new Error('Async error')
      const handler: StepHandler<express.Request, express.Response> = vi.fn().mockRejectedValue(error)
      const mockNext = vi.fn()
      const mockReq = {
        method: 'GET',
        body: {},
        query: {},
        params: {},
        path: '/step',
      } as unknown as express.Request
      const mockRes = {} as express.Response

      let capturedHandler: express.RequestHandler | undefined

      const mockRouter = {
        get: vi.fn((path: string, h: express.RequestHandler) => {
          capturedHandler = h
        }),
      } as unknown as express.Router

      adapter.get(mockRouter, '/step', handler)

      // Act
      await capturedHandler!(mockReq, mockRes, mockNext)

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error)
    })

    it('should log the full original path when the route is mounted below a parent router', async () => {
      // Arrange
      const handler: StepHandler<express.Request, express.Response> = vi.fn().mockResolvedValue(undefined)
      const mockNext = vi.fn()
      const mockReq = {
        method: 'GET',
        originalUrl: '/patterns/branching/demo/check-answers?from=task-list',
        path: '/check-answers',
      } as unknown as express.Request
      const mockRes = {} as express.Response

      let capturedHandler: express.RequestHandler | undefined

      const mockRouter = {
        get: vi.fn((path: string, h: express.RequestHandler) => {
          capturedHandler = h
        }),
      } as unknown as express.Router

      adapter.get(mockRouter, '/check-answers', handler)

      // Act
      await capturedHandler!(mockReq, mockRes, mockNext)

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'GET request to step at path /patterns/branching/demo/check-answers',
      )
    })

    it('should convert request to StepRequest before calling handler', async () => {
      // Arrange
      const handler: StepHandler<express.Request, express.Response> = vi.fn().mockResolvedValue(undefined)
      const mockNext = vi.fn()
      const mockReq = {
        method: 'GET',
        body: { field: 'value' },
        query: { page: '1' },
        params: { id: '123' },
        path: '/step',
        protocol: 'https',
        host: 'example.com',
        originalUrl: '/step?page=1',
        session: { user: 'test' },
      } as unknown as express.Request
      const mockRes = {} as express.Response

      let capturedHandler: express.RequestHandler | undefined

      const mockRouter = {
        get: vi.fn((path: string, h: express.RequestHandler) => {
          capturedHandler = h
        }),
      } as unknown as express.Router

      adapter.get(mockRouter, '/step', handler)

      // Act
      await capturedHandler!(mockReq, mockRes, mockNext)

      // Assert
      expect(handler).toHaveBeenCalledWith(mockReq, mockRes)
    })

    it('should merge res.locals into req.state before calling handler', async () => {
      // Arrange
      const handler: StepHandler<express.Request, express.Response> = vi.fn().mockResolvedValue(undefined)
      const mockNext = vi.fn()
      const mockReq = {
        method: 'GET',
        body: {},
        query: {},
        params: {},
        path: '/step',
        originalUrl: '/step',
      } as unknown as express.Request
      const mockRes = {
        locals: { csrfToken: 'abc123', userName: 'Alice' },
      } as unknown as express.Response

      let capturedHandler: express.RequestHandler | undefined

      const mockRouter = {
        get: vi.fn((_path: string, h: express.RequestHandler) => {
          capturedHandler = h
        }),
      } as unknown as express.Router

      adapter.get(mockRouter, '/step', handler)

      // Act
      await capturedHandler!(mockReq, mockRes, mockNext)

      // Assert
      const reqWithState = mockReq as express.Request & { state: Record<string, unknown> }
      expect(reqWithState.state.csrfToken).toBe('abc123')
      expect(reqWithState.state.userName).toBe('Alice')
    })

    it('should let req.state values take precedence over res.locals', async () => {
      // Arrange
      const handler: StepHandler<express.Request, express.Response> = vi.fn().mockResolvedValue(undefined)
      const mockNext = vi.fn()
      const mockReq = {
        method: 'GET',
        body: {},
        query: {},
        params: {},
        path: '/step',
        originalUrl: '/step',
        state: { userName: 'FromState' },
      } as unknown as express.Request
      const mockRes = {
        locals: { csrfToken: 'abc123', userName: 'FromLocals' },
      } as unknown as express.Response

      let capturedHandler: express.RequestHandler | undefined

      const mockRouter = {
        get: vi.fn((_path: string, h: express.RequestHandler) => {
          capturedHandler = h
        }),
      } as unknown as express.Router

      adapter.get(mockRouter, '/step', handler)

      // Act
      await capturedHandler!(mockReq, mockRes, mockNext)

      // Assert
      const reqWithState = mockReq as express.Request & { state: Record<string, unknown> }
      expect(reqWithState.state.csrfToken).toBe('abc123')
      expect(reqWithState.state.userName).toBe('FromState')
    })
  })

  describe('post()', () => {
    it('should register POST route handler on router', () => {
      // Arrange
      const router = express.Router()
      const postSpy = vi.spyOn(router, 'post')
      const handler: StepHandler<express.Request, express.Response> = vi.fn().mockResolvedValue(undefined)

      // Act
      adapter.post(router, '/step-one', handler)

      // Assert
      expect(postSpy).toHaveBeenCalledWith('/step-one', expect.any(Function))
    })

    it('should wrap handler to catch async errors', async () => {
      // Arrange
      const error = new Error('POST async error')
      const handler: StepHandler<express.Request, express.Response> = vi.fn().mockRejectedValue(error)
      const mockNext = vi.fn()
      const mockReq = {
        method: 'POST',
        body: {},
        query: {},
        params: {},
        path: '/step',
      } as unknown as express.Request
      const mockRes = {} as express.Response

      let capturedHandler: express.RequestHandler | undefined

      const mockRouter = {
        post: vi.fn((path: string, h: express.RequestHandler) => {
          capturedHandler = h
        }),
      } as unknown as express.Router

      adapter.post(mockRouter, '/step', handler)

      // Act
      await capturedHandler!(mockReq, mockRes, mockNext)

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })

  describe('toStepRequest()', () => {
    it('should convert Express request to StepRequest with method-based access', () => {
      // Arrange
      const mockReq = {
        method: 'POST',
        body: { field1: 'value1' },
        query: { page: '1' },
        params: { id: '123' },
        headers: { 'content-type': 'application/json' },
        cookies: { session: 'abc123' },
        protocol: 'https',
        host: 'example.com:3000',
        originalUrl: '/step-one?page=1',
        session: { userId: 'user1' },
      } as unknown as express.Request

      // Act
      const result = adapter.toStepRequest(mockReq)

      // Assert
      expect(result.method).toBe('POST')
      expect(result.url).toBe('https://example.com:3000/step-one?page=1')
      expect(result.getSession()).toEqual({ userId: 'user1' })
      expect(result.getAllState()).toEqual({})

      expect(result.getPost('field1')).toBe('value1')
      expect(result.getAllPost()).toEqual({ field1: 'value1' })
      expect(result.getQuery('page')).toBe('1')
      expect(result.getAllQuery()).toEqual({ page: '1' })
      expect(result.getParam('id')).toBe('123')
      expect(result.getParams()).toEqual({ id: '123' })
      expect(result.getHeader('content-type')).toBe('application/json')
      expect(result.getAllHeaders()).toEqual({ 'content-type': 'application/json' })
      expect(result.getCookie('session')).toBe('abc123')
      expect(result.getAllCookies()).toEqual({ session: 'abc123' })
    })

    it('should handle undefined body and query', () => {
      // Arrange
      const mockReq = {
        method: 'GET',
        body: undefined,
        query: undefined,
        params: {},
        protocol: 'http',
        host: 'localhost',
        originalUrl: '/step',
        session: undefined,
      } as unknown as express.Request

      // Act
      const result = adapter.toStepRequest(mockReq)

      // Assert
      expect(result.getAllPost()).toEqual({})
      expect(result.getAllQuery()).toEqual({})
      expect(result.getPost('nonexistent')).toBeUndefined()
      expect(result.getQuery('nonexistent')).toBeUndefined()
    })

    it('should extract state from extended request', () => {
      // Arrange
      const mockReq = {
        method: 'GET',
        body: {},
        query: {},
        params: {},
        protocol: 'http',
        host: 'localhost',
        originalUrl: '/step',
        session: {},
        state: { customData: 'value' },
      } as unknown as express.Request

      // Act
      const result = adapter.toStepRequest(mockReq)

      // Assert
      expect(result.getState('customData')).toBe('value')
      expect(result.getAllState()).toEqual({ customData: 'value' })
    })

    it('should normalize header names to lowercase for lookups', () => {
      // Arrange
      const mockReq = {
        method: 'GET',
        body: {},
        query: {},
        params: {},
        headers: { 'content-type': 'application/json', 'x-custom-header': 'value' },
        protocol: 'http',
        host: 'localhost',
        originalUrl: '/step',
      } as unknown as express.Request

      // Act
      const result = adapter.toStepRequest(mockReq)

      // Assert
      expect(result.getHeader('Content-Type')).toBe('application/json')
      expect(result.getHeader('X-Custom-Header')).toBe('value')
    })
  })

  describe('toStepResponse()', () => {
    it('should create a StepResponse that writes headers directly to Express response', () => {
      // Arrange
      const mockRes = {
        setHeader: vi.fn(),
        getHeader: vi.fn().mockReturnValue('test-value'),
        getHeaderNames: vi.fn().mockReturnValue(['x-custom']),
        cookie: vi.fn(),
      } as unknown as express.Response

      // Act
      const result = adapter.toStepResponse(mockRes)
      result.setHeader('X-Custom', 'test-value')

      // Assert
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Custom', 'test-value')
      expect(result.getHeader('X-Custom')).toBe('test-value')
    })

    it('should create a StepResponse that writes cookies directly to Express response', () => {
      // Arrange
      const mockRes = {
        setHeader: vi.fn(),
        getHeader: vi.fn().mockImplementation((name: string) => {
          if (name === 'Set-Cookie') {
            return ['session=abc123; HttpOnly']
          }

          return undefined
        }),
        getHeaderNames: vi.fn().mockReturnValue([]),
        cookie: vi.fn(),
      } as unknown as express.Response

      // Act
      const result = adapter.toStepResponse(mockRes)
      result.setCookie('session', 'abc123', { httpOnly: true })

      // Assert
      expect(mockRes.cookie).toHaveBeenCalledWith('session', 'abc123', { httpOnly: true })
    })

    it('should create a new instance each time', () => {
      // Arrange
      const mockRes1 = {
        setHeader: vi.fn(),
        getHeader: vi.fn(),
        getHeaderNames: vi.fn().mockReturnValue([]),
        cookie: vi.fn(),
      } as unknown as express.Response
      const mockRes2 = {
        setHeader: vi.fn(),
        getHeader: vi.fn(),
        getHeaderNames: vi.fn().mockReturnValue([]),
        cookie: vi.fn(),
      } as unknown as express.Response

      // Act
      const result1 = adapter.toStepResponse(mockRes1)
      const result2 = adapter.toStepResponse(mockRes2)

      // Assert
      expect(result1).not.toBe(result2)
    })

    it('should return empty maps when no headers or cookies have been set', () => {
      // Arrange
      const mockRes = {
        setHeader: vi.fn(),
        getHeader: vi.fn().mockReturnValue(undefined),
        getHeaderNames: vi.fn().mockReturnValue([]),
        cookie: vi.fn(),
      } as unknown as express.Response

      // Act
      const result = adapter.toStepResponse(mockRes)

      // Assert
      expect(result.getAllHeaders().size).toBe(0)
      expect(result.getAllCookies().size).toBe(0)
    })

    it('should parse Set-Cookie header to return cookies that have been set', () => {
      // Arrange
      const mockRes = {
        setHeader: vi.fn(),
        getHeader: vi.fn().mockImplementation((name: string) => {
          if (name === 'Set-Cookie') {
            return ['session=abc123; HttpOnly; Secure', 'preference=dark; Max-Age=86400; SameSite=Lax; Path=/']
          }

          return undefined
        }),
        getHeaderNames: vi.fn().mockReturnValue([]),
        cookie: vi.fn(),
      } as unknown as express.Response

      // Act
      const result = adapter.toStepResponse(mockRes)

      // Assert
      const sessionCookie = result.getCookie('session')
      expect(sessionCookie?.value).toBe('abc123')
      expect(sessionCookie?.options?.httpOnly).toBe(true)
      expect(sessionCookie?.options?.secure).toBe(true)

      const preferenceCookie = result.getCookie('preference')
      expect(preferenceCookie?.value).toBe('dark')
      expect(preferenceCookie?.options?.maxAge).toBe(86400)
      expect(preferenceCookie?.options?.sameSite).toBe('lax')
      expect(preferenceCookie?.options?.path).toBe('/')

      const allCookies = result.getAllCookies()
      expect(allCookies.size).toBe(2)
    })
  })

  describe('toStepRequest() baseUrl', () => {
    it('should strip path from originalUrl to get resolved base URL', () => {
      // Arrange
      const mockReq = {
        method: 'GET',
        body: {},
        query: {},
        params: {},
        headers: {},
        protocol: 'https',
        host: 'example.com',
        originalUrl: '/forms/sentence-plan/v1.0/oasys/goal/89e9a810-8bc6-4e42-831f-f0d3be29cac2/create-goal',
        path: '/create-goal',
        baseUrl: '/forms/sentence-plan/v1.0/oasys/goal/:uuid',
      } as unknown as express.Request

      // Act
      const result = adapter.toStepRequest(mockReq)

      // Assert
      expect(result.baseUrl).toBe('/forms/sentence-plan/v1.0/oasys/goal/89e9a810-8bc6-4e42-831f-f0d3be29cac2')
    })

    it('should handle simple paths without route params', () => {
      // Arrange
      const mockReq = {
        method: 'GET',
        body: {},
        query: {},
        params: {},
        headers: {},
        protocol: 'http',
        host: 'localhost',
        originalUrl: '/forms/my-journey/step-one',
        path: '/step-one',
        baseUrl: '/forms/my-journey',
      } as unknown as express.Request

      // Act
      const result = adapter.toStepRequest(mockReq)

      // Assert
      expect(result.baseUrl).toBe('/forms/my-journey')
    })

    it('should strip query strings before resolving the base URL', () => {
      // Arrange
      const mockReq = {
        method: 'GET',
        body: {},
        query: { from: 'summary' },
        params: {},
        headers: {},
        protocol: 'http',
        host: 'localhost',
        originalUrl: '/forms/my-journey/step-one?from=summary',
        path: '/step-one',
        baseUrl: '/forms/my-journey',
      } as unknown as express.Request

      // Act
      const result = adapter.toStepRequest(mockReq)

      // Assert
      expect(result.baseUrl).toBe('/forms/my-journey')
    })

    it('should fall back to baseUrl when path does not match originalUrl suffix', () => {
      // Arrange
      const mockReq = {
        method: 'GET',
        body: {},
        query: {},
        params: {},
        headers: {},
        protocol: 'http',
        host: 'localhost',
        originalUrl: '/forms/my-journey',
        path: '/different-path',
        baseUrl: '/forms/my-journey',
      } as unknown as express.Request

      // Act
      const result = adapter.toStepRequest(mockReq)

      // Assert
      expect(result.baseUrl).toBe('/forms/my-journey')
    })

    it('should fall back to baseUrl when path is empty', () => {
      // Arrange
      const mockReq = {
        method: 'GET',
        body: {},
        query: {},
        params: {},
        headers: {},
        protocol: 'http',
        host: 'localhost',
        originalUrl: '/forms/my-journey',
        path: '',
        baseUrl: '/forms/my-journey',
      } as unknown as express.Request

      // Act
      const result = adapter.toStepRequest(mockReq)

      // Assert
      expect(result.baseUrl).toBe('/forms/my-journey')
    })
  })

  describe('redirect()', () => {
    it('should redirect to specified URL', () => {
      // Arrange
      const mockRes = {
        redirect: vi.fn(),
      } as unknown as express.Response

      // Act
      adapter.redirect(mockRes, '/next-step')

      // Assert
      expect(mockRes.redirect).toHaveBeenCalledWith('/next-step')
    })

    it('should handle absolute URLs', () => {
      // Arrange
      const mockRes = {
        redirect: vi.fn(),
      } as unknown as express.Response

      // Act
      adapter.redirect(mockRes, 'https://example.com/callback')

      // Assert
      expect(mockRes.redirect).toHaveBeenCalledWith('https://example.com/callback')
    })
  })

  describe('render()', () => {
    it('should render page with blocks and send HTML response', async () => {
      // Arrange
      const mockReq = {
        app: { locals: {} },
      } as unknown as express.Request
      const mockRes = {
        locals: {},
        type: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as express.Response

      const renderContext: RenderContext = {
        routeTree: [],
        step: { path: '/step', title: 'Test Step', view: { template: 'test.njk' } },
        ancestors: [{ code: 'test', path: '/test', title: 'Test Journey' }],
        blocks: [
          {
            id: 'compile_ast:1',
            variant: 'html',
            blockType: BlockType.BASIC,
            properties: { content: 'Hello' },
          },
        ],
        showValidationFailures: false,
        fieldValidationErrors: [],
        domainValidationErrors: [],
        answers: {},
        data: {},
      }

      // Act
      await adapter.render(renderContext, mockReq, mockRes, mockComponentRegistry)

      // Assert
      expect(mockComponentRegistry.get).toHaveBeenCalledWith('html')
      expect(mockRes.type).toHaveBeenCalledWith('html')
      expect(mockRes.send).toHaveBeenCalledWith('<html>rendered</html>')
    })

    it('should merge app.locals and res.locals into template context', async () => {
      // Arrange
      const mockReq = {
        app: { locals: { applicationName: 'My App' } },
      } as unknown as express.Request
      const mockRes = {
        locals: { csrfToken: 'abc123' },
        type: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as unknown as express.Response

      const renderContext: RenderContext = {
        routeTree: [],
        step: { path: '/step', title: 'Test Step', view: { template: 'test.njk' } },
        ancestors: [{ code: 'test', path: '/test', title: 'Test Journey' }],
        blocks: [] as RenderBlock[],
        showValidationFailures: false,
        fieldValidationErrors: [],
        domainValidationErrors: [],
        answers: {},
        data: {},
      }

      // Act
      await adapter.render(renderContext, mockReq, mockRes, mockComponentRegistry)

      // Assert
      expect(mockNunjucksEnv.getTemplate).toHaveBeenCalledWith('test.njk')
      expect(mockTemplate.render).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationName: 'My App',
          csrfToken: 'abc123',
          step: { path: '/step', title: 'Test Step', view: { template: 'test.njk' } },
        }),
      )
    })
  })

  describe('forwardError()', () => {
    it('should call next with error when next is provided', () => {
      // Arrange
      const mockRes = {} as express.Response
      const mockNext = vi.fn()
      const error = new Error('Something went wrong')

      // Act
      adapter.forwardError(mockRes, error, mockNext)

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error)
    })

    it('should throw error when next is not provided', () => {
      // Arrange
      const mockRes = {} as express.Response
      const error = new Error('Something went wrong')

      // Act & Assert
      expect(() => adapter.forwardError(mockRes, error)).toThrow('Something went wrong')
    })
  })

})
