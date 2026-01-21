import express from 'express'
import nunjucks from 'nunjucks'

import { FrameworkAdapter, StepHandler } from '@form-engine/core/runtime/routes/types'
import { Evaluated, RenderContext } from '@form-engine/core/runtime/rendering/types'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockType } from '@form-engine/form/types/enums'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import ExpressFrameworkAdapter from './ExpressFrameworkAdapter'

describe('ExpressFrameworkAdapter', () => {
  let adapter: FrameworkAdapter<express.Router, express.Request, express.Response>
  let mockNunjucksEnv: jest.Mocked<nunjucks.Environment>
  let mockComponentRegistry: jest.Mocked<ComponentRegistry>
  let mockLogger: Console

  beforeEach(() => {
    mockNunjucksEnv = {
      render: jest.fn((template, data, callback) => {
        callback(null, '<html>rendered</html>')
      }),
    } as unknown as jest.Mocked<nunjucks.Environment>

    mockComponentRegistry = {
      get: jest.fn().mockReturnValue({
        render: jest.fn().mockResolvedValue('<div>Block HTML</div>'),
      }),
      getAll: jest.fn().mockReturnValue(new Map()),
    } as unknown as jest.Mocked<ComponentRegistry>

    mockLogger = { debug: jest.fn() } as unknown as Console

    const builder = ExpressFrameworkAdapter.configure({ nunjucksEnv: mockNunjucksEnv })

    adapter = builder.build({ componentRegistry: mockComponentRegistry, logger: mockLogger })
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
      const useSpy = jest.spyOn(parent, 'use')

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
      const getSpy = jest.spyOn(router, 'get')
      const handler: StepHandler<express.Request, express.Response> = jest.fn().mockResolvedValue(undefined)

      // Act
      adapter.get(router, '/step-one', handler)

      // Assert
      expect(getSpy).toHaveBeenCalledWith('/step-one', expect.any(Function))
    })

    it('should wrap handler to catch async errors', async () => {
      // Arrange
      const error = new Error('Async error')
      const handler: StepHandler<express.Request, express.Response> = jest.fn().mockRejectedValue(error)
      const mockNext = jest.fn()
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
        get: jest.fn((path: string, h: express.RequestHandler) => {
          capturedHandler = h
        }),
      } as unknown as express.Router

      adapter.get(mockRouter, '/step', handler)

      // Act
      await capturedHandler!(mockReq, mockRes, mockNext)

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error)
    })

    it('should convert request to StepRequest before calling handler', async () => {
      // Arrange
      const handler: StepHandler<express.Request, express.Response> = jest.fn().mockResolvedValue(undefined)
      const mockNext = jest.fn()
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
        get: jest.fn((path: string, h: express.RequestHandler) => {
          capturedHandler = h
        }),
      } as unknown as express.Router

      adapter.get(mockRouter, '/step', handler)

      // Act
      await capturedHandler!(mockReq, mockRes, mockNext)

      // Assert
      expect(handler).toHaveBeenCalledWith(mockReq, mockRes)
    })
  })

  describe('post()', () => {
    it('should register POST route handler on router', () => {
      // Arrange
      const router = express.Router()
      const postSpy = jest.spyOn(router, 'post')
      const handler: StepHandler<express.Request, express.Response> = jest.fn().mockResolvedValue(undefined)

      // Act
      adapter.post(router, '/step-one', handler)

      // Assert
      expect(postSpy).toHaveBeenCalledWith('/step-one', expect.any(Function))
    })

    it('should wrap handler to catch async errors', async () => {
      // Arrange
      const error = new Error('POST async error')
      const handler: StepHandler<express.Request, express.Response> = jest.fn().mockRejectedValue(error)
      const mockNext = jest.fn()
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
        post: jest.fn((path: string, h: express.RequestHandler) => {
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
        setHeader: jest.fn(),
        getHeader: jest.fn().mockReturnValue('test-value'),
        getHeaderNames: jest.fn().mockReturnValue(['x-custom']),
        cookie: jest.fn(),
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
        setHeader: jest.fn(),
        getHeader: jest.fn().mockImplementation((name: string) => {
          if (name === 'Set-Cookie') {
            return ['session=abc123; HttpOnly']
          }

          return undefined
        }),
        getHeaderNames: jest.fn().mockReturnValue([]),
        cookie: jest.fn(),
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
        setHeader: jest.fn(),
        getHeader: jest.fn(),
        getHeaderNames: jest.fn().mockReturnValue([]),
        cookie: jest.fn(),
      } as unknown as express.Response
      const mockRes2 = {
        setHeader: jest.fn(),
        getHeader: jest.fn(),
        getHeaderNames: jest.fn().mockReturnValue([]),
        cookie: jest.fn(),
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
        setHeader: jest.fn(),
        getHeader: jest.fn().mockReturnValue(undefined),
        getHeaderNames: jest.fn().mockReturnValue([]),
        cookie: jest.fn(),
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
        setHeader: jest.fn(),
        getHeader: jest.fn().mockImplementation((name: string) => {
          if (name === 'Set-Cookie') {
            return ['session=abc123; HttpOnly; Secure', 'preference=dark; Max-Age=86400; SameSite=Lax; Path=/']
          }

          return undefined
        }),
        getHeaderNames: jest.fn().mockReturnValue([]),
        cookie: jest.fn(),
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

  describe('getBaseUrl()', () => {
    it('should strip path from originalUrl to get resolved base URL', () => {
      // Arrange
      const mockReq = {
        originalUrl: '/forms/sentence-plan/v1.0/oasys/goal/89e9a810-8bc6-4e42-831f-f0d3be29cac2/create-goal',
        path: '/create-goal',
        baseUrl: '/forms/sentence-plan/v1.0/oasys/goal/:uuid',
      } as express.Request

      // Act
      const result = adapter.getBaseUrl(mockReq)

      // Assert
      expect(result).toBe('/forms/sentence-plan/v1.0/oasys/goal/89e9a810-8bc6-4e42-831f-f0d3be29cac2')
    })

    it('should handle simple paths without route params', () => {
      // Arrange
      const mockReq = {
        originalUrl: '/forms/my-journey/step-one',
        path: '/step-one',
        baseUrl: '/forms/my-journey',
      } as express.Request

      // Act
      const result = adapter.getBaseUrl(mockReq)

      // Assert
      expect(result).toBe('/forms/my-journey')
    })

    it('should fall back to baseUrl when path does not match originalUrl suffix', () => {
      // Arrange
      const mockReq = {
        originalUrl: '/forms/my-journey',
        path: '/different-path',
        baseUrl: '/forms/my-journey',
      } as express.Request

      // Act
      const result = adapter.getBaseUrl(mockReq)

      // Assert
      expect(result).toBe('/forms/my-journey')
    })

    it('should fall back to baseUrl when path is empty', () => {
      // Arrange
      const mockReq = {
        originalUrl: '/forms/my-journey',
        path: '',
        baseUrl: '/forms/my-journey',
      } as express.Request

      // Act
      const result = adapter.getBaseUrl(mockReq)

      // Assert
      expect(result).toBe('/forms/my-journey')
    })
  })

  describe('redirect()', () => {
    it('should redirect to specified URL', () => {
      // Arrange
      const mockRes = {
        redirect: jest.fn(),
      } as unknown as express.Response

      // Act
      adapter.redirect(mockRes, '/next-step')

      // Assert
      expect(mockRes.redirect).toHaveBeenCalledWith('/next-step')
    })

    it('should handle absolute URLs', () => {
      // Arrange
      const mockRes = {
        redirect: jest.fn(),
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
        type: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as express.Response

      const renderContext: RenderContext = {
        navigation: [],
        step: { path: '/step', title: 'Test Step', view: { template: 'test.njk' } },
        ancestors: [{ code: 'test', path: '/test', title: 'Test Journey' }],
        blocks: [
          {
            id: 'compile_ast:1',
            type: ASTNodeType.BLOCK,
            variant: 'html',
            blockType: BlockType.BASIC,
            properties: { content: 'Hello' },
          },
        ],
        showValidationFailures: false,
        validationErrors: [],
        answers: {},
        data: {},
      }

      // Act
      await adapter.render(renderContext, mockReq, mockRes)

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
        type: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as express.Response

      const renderContext: RenderContext = {
        navigation: [],
        step: { path: '/step', title: 'Test Step', view: { template: 'test.njk' } },
        ancestors: [{ code: 'test', path: '/test', title: 'Test Journey' }],
        blocks: [] as Evaluated<BlockASTNode>[],
        showValidationFailures: false,
        validationErrors: [],
        answers: {},
        data: {},
      }

      // Act
      await adapter.render(renderContext, mockReq, mockRes)

      // Assert
      expect(mockNunjucksEnv.render).toHaveBeenCalledWith(
        'test.njk',
        expect.objectContaining({
          applicationName: 'My App',
          csrfToken: 'abc123',
          step: { path: '/step', title: 'Test Step', view: { template: 'test.njk' } },
        }),
        expect.any(Function),
      )
    })
  })

  describe('forwardError()', () => {
    it('should call next with error when next is provided', () => {
      // Arrange
      const mockRes = {} as express.Response
      const mockNext = jest.fn()
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
