import type { ForgeRoute } from '../../framework/types/topology.type'
import type { ResolvedRoute } from './TestRouteResolver'
import TestSnapshotFactory from './TestSnapshotFactory'

const route: ForgeRoute = {
  nodeId: 'journey::step-one',
  kind: 'step',
  templatePath: '/journey/:code/step-one',
  basePath: '/journey/:code',
  methods: ['GET', 'POST'],
}

function createResolvedRoute(params: Record<string, string> = { code: 'abc' }): ResolvedRoute {
  return { route, params }
}

describe('TestSnapshotFactory', () => {
  describe('create()', () => {
    it('should create a request snapshot from test input', () => {
      // Arrange
      const resolved = createResolvedRoute()

      // Act
      const snapshot = TestSnapshotFactory.create('POST', '/journey/abc/step-one?ref=123', resolved, {
        query: { ref: '123' },
        body: { answer: 'yes' },
        headers: { Accept: 'text/html' },
        cookies: { session: 'cookie-value' },
        state: { userId: 42 },
        session: { answers: {} },
      })

      // Assert
      expect(snapshot).toMatchObject({
        nodeId: 'journey::step-one',
        method: 'POST',
        location: {
          origin: 'http://localhost',
          href: 'http://localhost/journey/abc/step-one?ref=123',
          pathname: '/journey/abc/step-one',
          basePath: '/journey/abc',
        },
        params: { code: 'abc' },
        query: { ref: '123' },
        post: { answer: 'yes' },
        headers: { accept: 'text/html' },
        cookies: { session: 'cookie-value' },
        state: { userId: 42 },
        session: { answers: {} },
      })
    })

    it('should merge explicit params with resolved params', () => {
      // Arrange
      const resolved = createResolvedRoute({ code: 'matched' })

      // Act
      const snapshot = TestSnapshotFactory.create('GET', '/journey/matched/step-one', resolved, {
        params: { code: 'explicit', extra: 'value' },
      })

      // Assert
      expect(snapshot.params).toEqual({ code: 'matched', extra: 'value' })
    })

    it('should default optional fields when no options given', () => {
      // Arrange
      const resolved = createResolvedRoute()

      // Act
      const snapshot = TestSnapshotFactory.create('GET', '/journey/abc/step-one', resolved)

      // Assert
      expect(snapshot.query).toEqual({})
      expect(snapshot.post).toEqual({})
      expect(snapshot.headers).toEqual({})
      expect(snapshot.cookies).toEqual({})
      expect(snapshot.state).toEqual({})
      expect(snapshot.session).toBeUndefined()
    })
  })
})
