import { ForgeTestClient } from './ForgeTestClient'
import type Forge from '../engine/Forge'
import type { EvaluateOptions } from '../engine/Forge'
import type { ForgeOutcome } from '../framework/types/outcome.type'
import type { ForgeRoute } from '../framework/types/topology.type'
import type { RequestSnapshot } from '../framework/types/snapshot.type'

const ROUTES: ForgeRoute[] = [
  { nodeId: 'step-one', kind: 'step', templatePath: '/step-one', basePath: '', methods: ['GET', 'POST'] },
  {
    nodeId: 'param-step',
    kind: 'step',
    templatePath: '/journey/:code/step',
    basePath: '/journey/:code',
    methods: ['GET', 'POST'],
  },
  { nodeId: 'journey-root', kind: 'journey', templatePath: '/journey', basePath: '/journey', methods: ['GET'] },
]

function renderOutcome(): ForgeOutcome {
  return {
    kind: 'render',
    context: { blocks: [], fieldValidationErrors: [] } as never,
    componentRegistry: {} as never,
  }
}

function navigateOutcome(url: string): ForgeOutcome {
  return { kind: 'navigate', url }
}

function errorOutcome(): ForgeOutcome {
  return {
    kind: 'error',
    error: { code: 'node-not-found', message: 'boom' },
  }
}

function createClient(
  resolve: ForgeOutcome | ((snapshot: RequestSnapshot, options?: EvaluateOptions) => ForgeOutcome),
): {
  client: ForgeTestClient
  snapshots: RequestSnapshot[]
} {
  const snapshots: RequestSnapshot[] = []
  const fakeForge = {
    getTopology: () => ({ routes: ROUTES }),
    evaluate: async (snapshot: RequestSnapshot, options?: EvaluateOptions) => {
      snapshots.push(snapshot)

      return typeof resolve === 'function' ? resolve(snapshot, options) : resolve
    },
  } as unknown as Forge

  return { client: new ForgeTestClient(fakeForge), snapshots }
}

describe('ForgeTestClient', () => {
  describe('dispatch()', () => {
    it('should render when the engine returns a render outcome', async () => {
      // Arrange
      const { client } = createClient(renderOutcome())

      // Act
      const result = await client.get('/step-one')

      // Assert
      expect(result.type).toBe('render')
    })

    it('should redirect when the engine returns a navigate outcome', async () => {
      // Arrange
      const { client } = createClient(navigateOutcome('/step-two'))

      // Act
      const result = await client.post('/step-one')

      // Assert
      expect(result.type).toBe('redirect')
      if (result.type === 'redirect') {
        expect(result.url).toBe('/step-two')
      }
    })

    it('should select the node and method for the matched route', async () => {
      // Arrange
      const { client, snapshots } = createClient(navigateOutcome('/journey/first-step'))

      // Act
      await client.get('/journey')

      // Assert
      expect(snapshots[0]).toMatchObject({ nodeId: 'journey-root', method: 'GET' })
    })
  })

  describe('route resolution', () => {
    it('should extract params from parameterised template paths', async () => {
      // Arrange
      const { client, snapshots } = createClient(renderOutcome())

      // Act
      await client.get('/journey/my-form/step')

      // Assert
      expect(snapshots[0].nodeId).toBe('param-step')
      expect(snapshots[0].params.code).toBe('my-form')
    })

    it('should resolve the base path with params for relative redirect resolution', async () => {
      // Arrange
      const { client, snapshots } = createClient(renderOutcome())

      // Act
      await client.get('/journey/my-form/step')

      // Assert
      expect(snapshots[0].location.basePath).toBe('/journey/my-form')
    })

    it('should merge explicit params with route-extracted params', async () => {
      // Arrange
      const { client, snapshots } = createClient(renderOutcome())

      // Act
      await client.get('/journey/my-form/step', { params: { extra: 'value' } })

      // Assert
      expect(snapshots[0].params.code).toBe('my-form')
      expect(snapshots[0].params.extra).toBe('value')
    })
  })

  describe('error handling', () => {
    it('should throw when no route matches', async () => {
      // Arrange
      const { client } = createClient(renderOutcome())

      // Act & Assert
      await expect(client.get('/nonexistent')).rejects.toThrow('No route matched')
    })

    it('should throw an http error when the engine returns an error outcome', async () => {
      // Arrange
      const { client } = createClient(errorOutcome())

      // Act & Assert
      await expect(client.get('/step-one')).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('request building', () => {
    it('should pass session, state, query and body to the snapshot', async () => {
      // Arrange
      const { client, snapshots } = createClient(renderOutcome())

      // Act
      await client.post('/step-one', {
        session: { answers: { name: 'John' } },
        state: { userId: 42 },
        query: { ref: 'abc' },
        body: { name: 'Jane', age: '30' },
      })

      // Assert
      expect(snapshots[0]).toMatchObject({
        session: { answers: { name: 'John' } },
        state: { userId: 42 },
        query: { ref: 'abc' },
        post: { name: 'Jane', age: '30' },
      })
    })

    it('should normalise header keys to lowercase', async () => {
      // Arrange
      const { client, snapshots } = createClient(renderOutcome())

      // Act
      await client.get('/step-one', { headers: { 'Content-Type': 'application/json' } })

      // Assert
      expect(snapshots[0].headers['content-type']).toBe('application/json')
    })
  })

  describe('response capture', () => {
    it('should expose headers and cookies written via response bindings', async () => {
      // Arrange
      const { client } = createClient((_snapshot, options) => {
        options?.response?.setHeader('x-custom', 'test-value')
        options?.response?.setCookie('token', 'abc', { httpOnly: true })

        return renderOutcome()
      })

      // Act
      const result = await client.get('/step-one')

      // Assert
      expect(result.headers.get('x-custom')).toBe('test-value')
      expect(result.cookies.get('token')).toEqual({ value: 'abc', options: { httpOnly: true } })
    })
  })
})
