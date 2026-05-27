import TestFrameworkAdapter from './TestFrameworkAdapter'
import type { TestRequest, TestResponse, TestRouter } from './types'

describe('TestFrameworkAdapter', () => {
  describe('configure()', () => {
    it('should return a builder with build and createClient methods', () => {
      const builder = TestFrameworkAdapter.configure()

      expect(builder.build).toBeTypeOf('function')
      expect(builder.createClient).toBeTypeOf('function')
    })

    it('should throw when createClient is called before build', () => {
      const builder = TestFrameworkAdapter.configure()
      const router: TestRouter = { routes: new Map(), children: new Map() }

      expect(() => builder.createClient(router)).toThrow('has not been built yet')
    })

    it('should allow createClient after build', () => {
      const builder = TestFrameworkAdapter.configure()

      builder.build({ logger: console })

      const router: TestRouter = { routes: new Map(), children: new Map() }
      const client = builder.createClient(router)

      expect(client).toBeDefined()
    })
  })

  describe('routing', () => {
    let adapter: TestFrameworkAdapter

    beforeEach(() => {
      adapter = new (TestFrameworkAdapter as any)()
    })

    it('should create an empty router', () => {
      const router = adapter.createRouter()

      expect(router.routes.size).toBe(0)
      expect(router.children.size).toBe(0)
    })

    it('should register GET handlers', () => {
      const router = adapter.createRouter()
      const handler = vi.fn()

      adapter.get(router, '/step', handler)

      expect(router.routes.get('/step')?.get?.handler).toBe(handler)
    })

    it('should register POST handlers', () => {
      const router = adapter.createRouter()
      const handler = vi.fn()

      adapter.post(router, '/step', handler)

      expect(router.routes.get('/step')?.post?.handler).toBe(handler)
    })

    it('should mount child routers', () => {
      const parent = adapter.createRouter()
      const child = adapter.createRouter()

      adapter.mountRouter(parent, '/journey', child)

      expect(parent.children.get('/journey')).toBe(child)
    })
  })

  describe('toStepRequest()', () => {
    let adapter: TestFrameworkAdapter

    beforeEach(() => {
      adapter = new (TestFrameworkAdapter as any)()
    })

    it('should convert TestRequest to StepRequest', () => {
      // Arrange
      const req: TestRequest = {
        method: 'GET',
        url: 'http://localhost/journey/step',
        baseUrl: '/journey',
        headers: { 'content-type': 'text/html' },
        cookies: { session: 'abc' },
        params: { id: '123' },
        query: { page: '1' },
        body: {},
        session: { user: 'test' },
        state: { flag: true },
      }

      // Act
      const stepReq = adapter.toStepRequest(req)

      // Assert
      expect(stepReq.method).toBe('GET')
      expect(stepReq.url).toBe('http://localhost/journey/step')
      expect(stepReq.baseUrl).toBe('/journey')
      expect(stepReq.getHeader('content-type')).toBe('text/html')
      expect(stepReq.getCookie('session')).toBe('abc')
      expect(stepReq.getParam('id')).toBe('123')
      expect(stepReq.getQuery('page')).toBe('1')
      expect(stepReq.getSession()).toEqual({ user: 'test' })
      expect(stepReq.getState('flag')).toBe(true)
    })
  })

  describe('toStepResponse()', () => {
    let adapter: TestFrameworkAdapter

    beforeEach(() => {
      adapter = new (TestFrameworkAdapter as any)()
    })

    it('should track headers set on the response', () => {
      // Arrange
      const res: TestResponse = {
        headers: new Map(),
        cookies: new Map(),
      }

      // Act
      const stepRes = adapter.toStepResponse(res)
      stepRes.setHeader('x-custom', 'value')

      // Assert
      expect(stepRes.getHeader('x-custom')).toBe('value')
      expect(res.headers.get('x-custom')).toBe('value')
    })

    it('should track cookies set on the response', () => {
      // Arrange
      const res: TestResponse = {
        headers: new Map(),
        cookies: new Map(),
      }

      // Act
      const stepRes = adapter.toStepResponse(res)
      stepRes.setCookie('token', 'xyz', { httpOnly: true })

      // Assert
      expect(stepRes.getCookie('token')).toEqual({ value: 'xyz', options: { httpOnly: true } })
      expect(res.cookies.get('token')).toEqual({ value: 'xyz', options: { httpOnly: true } })
    })
  })

  describe('applyResult()', () => {
    let adapter: TestFrameworkAdapter

    beforeEach(() => {
      adapter = new (TestFrameworkAdapter as any)()
    })

    it('should capture redirect URL on redirect result', () => {
      // Arrange
      const res: TestResponse = { headers: new Map(), cookies: new Map() }
      const req = {} as TestRequest

      // Act
      adapter.applyResult({ type: 'redirect', url: '/next-step' }, req, res, {} as any)

      // Assert
      expect(res.redirectUrl).toBe('/next-step')
      expect(res.renderContext).toBeUndefined()
    })

    it('should capture render context on render result', () => {
      // Arrange
      const res: TestResponse = { headers: new Map(), cookies: new Map() }
      const req = {} as TestRequest
      const context = { blocks: [], answers: {} } as any

      // Act
      adapter.applyResult({ type: 'render', context }, req, res, {} as any)

      // Assert
      expect(res.renderContext).toBe(context)
      expect(res.redirectUrl).toBeUndefined()
    })
  })

  describe('forwardError()', () => {
    let adapter: TestFrameworkAdapter

    beforeEach(() => {
      adapter = new (TestFrameworkAdapter as any)()
    })

    it('should throw the error for test visibility', () => {
      const res = {} as TestResponse
      const error = new Error('test error')

      expect(() => adapter.forwardError(res, error)).toThrow('test error')
    })
  })
})
