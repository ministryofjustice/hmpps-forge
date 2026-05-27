import { ForgeTestClient } from './ForgeTestClient'
import type { TestRequest, TestResponse, TestRouter } from './types'

function createRouter(): TestRouter {
  return { routes: new Map(), children: new Map() }
}

function createHandler(action: (req: TestRequest, res: TestResponse) => void) {
  return { handler: vi.fn(async (req: TestRequest, res: TestResponse) => action(req, res)) }
}

describe('ForgeTestClient', () => {
  describe('route resolution', () => {
    it('should dispatch GET to a flat route', async () => {
      // Arrange
      const router = createRouter()

      router.routes.set('/step-one', {
        get: createHandler((_req, res) => {
          res.renderContext = { blocks: [] } as any
        }),
      })

      const client = new ForgeTestClient(router)

      // Act
      const result = await client.get('/step-one')

      // Assert
      expect(result.type).toBe('render')
    })

    it('should dispatch POST to a flat route', async () => {
      // Arrange
      const router = createRouter()

      router.routes.set('/step-one', {
        post: createHandler((_req, res) => {
          res.redirectUrl = '/step-two'
        }),
      })

      const client = new ForgeTestClient(router)

      // Act
      const result = await client.post('/step-one')

      // Assert
      expect(result.type).toBe('redirect')
      if (result.type === 'redirect') {
        expect(result.url).toBe('/step-two')
      }
    })

    it('should resolve routes through mounted child routers', async () => {
      // Arrange
      const root = createRouter()
      const child = createRouter()

      child.routes.set('/intro', {
        get: createHandler((_req, res) => {
          res.renderContext = { blocks: ['child-block'] } as any
        }),
      })
      root.children.set('/my-journey', child)

      const client = new ForgeTestClient(root)

      // Act
      const result = await client.get('/my-journey/intro')

      // Assert
      expect(result.type).toBe('render')
      if (result.type === 'render') {
        expect(result.context.blocks).toEqual(['child-block'])
      }
    })

    it('should extract params from parameterised mount paths', async () => {
      // Arrange
      const root = createRouter()
      const child = createRouter()
      let capturedParams: Record<string, string> = {}

      child.routes.set('/step', {
        get: createHandler((req, res) => {
          capturedParams = req.params
          res.renderContext = { blocks: [] } as any
        }),
      })
      root.children.set('/journey/:code', child)

      const client = new ForgeTestClient(root)

      // Act
      await client.get('/journey/my-form/step')

      // Assert
      expect(capturedParams.code).toBe('my-form')
    })

    it('should extract params from parameterised step paths', async () => {
      // Arrange
      const root = createRouter()
      const child = createRouter()
      let capturedParams: Record<string, string> = {}

      child.routes.set('/:stepId', {
        get: createHandler((req, res) => {
          capturedParams = req.params
          res.renderContext = { blocks: [] } as any
        }),
      })
      root.children.set('/journey', child)

      const client = new ForgeTestClient(root)

      // Act
      await client.get('/journey/intro')

      // Assert
      expect(capturedParams.stepId).toBe('intro')
    })

    it('should resolve journey root routes mounted at /', async () => {
      // Arrange
      const root = createRouter()
      const child = createRouter()

      child.routes.set('/', {
        get: createHandler((_req, res) => {
          res.redirectUrl = '/journey/first-step'
        }),
      })
      root.children.set('/journey', child)

      const client = new ForgeTestClient(root)

      // Act
      const result = await client.get('/journey')

      // Assert
      expect(result.type).toBe('redirect')
      if (result.type === 'redirect') {
        expect(result.url).toBe('/journey/first-step')
      }
    })
  })

  describe('error handling', () => {
    it('should throw when no route matches', async () => {
      // Arrange
      const router = createRouter()
      const client = new ForgeTestClient(router)

      // Act & Assert
      await expect(client.get('/nonexistent')).rejects.toThrow('No route matched')
    })

    it('should throw when no handler exists for the method', async () => {
      // Arrange
      const router = createRouter()

      router.routes.set('/step', {
        get: createHandler((_req, res) => {
          res.renderContext = { blocks: [] } as any
        }),
      })

      const client = new ForgeTestClient(router)

      // Act & Assert
      await expect(client.post('/step')).rejects.toThrow('No POST handler')
    })

    it('should throw when handler completes without render or redirect', async () => {
      // Arrange
      const router = createRouter()

      router.routes.set('/step', {
        get: createHandler(() => {}),
      })

      const client = new ForgeTestClient(router)

      // Act & Assert
      await expect(client.get('/step')).rejects.toThrow('without rendering or redirecting')
    })
  })

  describe('request building', () => {
    it('should pass session and state to the handler', async () => {
      // Arrange
      const router = createRouter()
      let capturedReq: TestRequest | undefined

      router.routes.set('/step', {
        get: createHandler((req, res) => {
          capturedReq = req
          res.renderContext = { blocks: [] } as any
        }),
      })

      const client = new ForgeTestClient(router)

      // Act
      await client.get('/step', {
        session: { answers: { name: 'John' } },
        state: { userId: 42 },
      })

      // Assert
      expect(capturedReq?.session).toEqual({ answers: { name: 'John' } })
      expect(capturedReq?.state).toEqual({ userId: 42 })
    })

    it('should pass body data on POST requests', async () => {
      // Arrange
      const router = createRouter()
      let capturedReq: TestRequest | undefined

      router.routes.set('/step', {
        post: createHandler((req, res) => {
          capturedReq = req
          res.redirectUrl = '/next'
        }),
      })

      const client = new ForgeTestClient(router)

      // Act
      await client.post('/step', {
        body: { name: 'Jane', age: '30' },
      })

      // Assert
      expect(capturedReq?.body).toEqual({ name: 'Jane', age: '30' })
    })

    it('should normalise header keys to lowercase', async () => {
      // Arrange
      const router = createRouter()
      let capturedReq: TestRequest | undefined

      router.routes.set('/step', {
        get: createHandler((req, res) => {
          capturedReq = req
          res.renderContext = { blocks: [] } as any
        }),
      })

      const client = new ForgeTestClient(router)

      // Act
      await client.get('/step', {
        headers: { 'Content-Type': 'application/json' },
      })

      // Assert
      expect(capturedReq?.headers['content-type']).toBe('application/json')
    })

    it('should merge explicit params with route-extracted params', async () => {
      // Arrange
      const root = createRouter()
      const child = createRouter()
      let capturedParams: Record<string, string> = {}

      child.routes.set('/step', {
        get: createHandler((req, res) => {
          capturedParams = req.params
          res.renderContext = { blocks: [] } as any
        }),
      })
      root.children.set('/journey/:code', child)

      const client = new ForgeTestClient(root)

      // Act
      await client.get('/journey/my-form/step', {
        params: { extra: 'value' },
      })

      // Assert
      expect(capturedParams.code).toBe('my-form')
      expect(capturedParams.extra).toBe('value')
    })
  })

  describe('response capture', () => {
    it('should capture headers set during the request', async () => {
      // Arrange
      const router = createRouter()

      router.routes.set('/step', {
        get: createHandler((_req, res) => {
          res.headers.set('x-custom', 'test-value')
          res.renderContext = { blocks: [] } as any
        }),
      })

      const client = new ForgeTestClient(router)

      // Act
      const result = await client.get('/step')

      // Assert
      expect(result.headers.get('x-custom')).toBe('test-value')
    })

    it('should capture cookies set during the request', async () => {
      // Arrange
      const router = createRouter()

      router.routes.set('/step', {
        get: createHandler((_req, res) => {
          res.cookies.set('token', { value: 'abc', options: { httpOnly: true } })
          res.renderContext = { blocks: [] } as any
        }),
      })

      const client = new ForgeTestClient(router)

      // Act
      const result = await client.get('/step')

      // Assert
      expect(result.cookies.get('token')).toEqual({ value: 'abc', options: { httpOnly: true } })
    })
  })
})
