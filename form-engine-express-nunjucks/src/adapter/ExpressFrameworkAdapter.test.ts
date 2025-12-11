import express from 'express'
import nunjucks from 'nunjucks'

import { FrameworkAdapter, StepHandler } from '@form-engine/core/runtime/routes/types'
import { Evaluated, RenderContext } from '@form-engine/core/runtime/rendering/types'
import { ASTNodeType } from '@form-engine/core/types/enums'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import ExpressFrameworkAdapter from './ExpressFrameworkAdapter'

describe('ExpressFrameworkAdapter', () => {
  let adapter: FrameworkAdapter<express.Router, express.Request, express.Response>
  let mockNunjucksEnv: jest.Mocked<nunjucks.Environment>
  let mockComponentRegistry: jest.Mocked<ComponentRegistry>

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

    const builder = ExpressFrameworkAdapter.configure({ nunjucksEnv: mockNunjucksEnv })

    adapter = builder.build({ componentRegistry: mockComponentRegistry })
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
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          post: { field: 'value' },
          query: { page: '1' },
          params: { id: '123' },
          path: '/step',
        }),
        mockReq,
        mockRes,
      )
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
    it('should convert Express request to StepRequest', () => {
      // Arrange
      const mockReq = {
        method: 'POST',
        body: { field1: 'value1' },
        query: { page: '1' },
        params: { id: '123' },
        path: '/step-one',
        session: { userId: 'user1' },
      } as unknown as express.Request

      // Act
      const result = adapter.toStepRequest(mockReq)

      // Assert
      expect(result).toEqual({
        method: 'POST',
        post: { field1: 'value1' },
        query: { page: '1' },
        params: { id: '123' },
        path: '/step-one',
        session: { userId: 'user1' },
        state: {},
      })
    })

    it('should handle undefined body and query', () => {
      // Arrange
      const mockReq = {
        method: 'GET',
        body: undefined,
        query: undefined,
        params: {},
        path: '/step',
        session: undefined,
      } as unknown as express.Request

      // Act
      const result = adapter.toStepRequest(mockReq)

      // Assert
      expect(result.post).toEqual({})
      expect(result.query).toEqual({})
    })

    it('should extract state from extended request', () => {
      // Arrange
      const mockReq = {
        method: 'GET',
        body: {},
        query: {},
        params: {},
        path: '/step',
        session: {},
        state: { customData: 'value' },
      } as unknown as express.Request

      // Act
      const result = adapter.toStepRequest(mockReq)

      // Assert
      expect(result.state).toEqual({ customData: 'value' })
    })
  })

  describe('getBaseUrl()', () => {
    it('should return baseUrl from Express request', () => {
      // Arrange
      const mockReq = {
        baseUrl: '/forms/my-journey',
      } as express.Request

      // Act
      const result = adapter.getBaseUrl(mockReq)

      // Assert
      expect(result).toBe('/forms/my-journey')
    })

    it('should return empty string when baseUrl is empty', () => {
      // Arrange
      const mockReq = {
        baseUrl: '',
      } as express.Request

      // Act
      const result = adapter.getBaseUrl(mockReq)

      // Assert
      expect(result).toBe('')
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
            blockType: 'basic',
            properties: { content: 'Hello' },
          },
        ],
        showValidationFailures: false,
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
