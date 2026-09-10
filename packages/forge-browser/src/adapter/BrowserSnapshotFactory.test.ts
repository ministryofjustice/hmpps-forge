import BrowserSnapshotFactory from './BrowserSnapshotFactory'
import type { ResolvedBrowserRoute } from './BrowserRouteResolver'
import type { BrowserLocationSnapshot } from './types'

const location: BrowserLocationSnapshot = {
  href: 'https://forms.example/host-page',
}

const resolved: ResolvedBrowserRoute = {
  route: { nodeId: 'step-1', kind: 'step', templatePath: '/demo/start', basePath: '/demo', methods: ['GET', 'POST'] },
  params: {},
}

describe('BrowserSnapshotFactory', () => {
  describe('create()', () => {
    it('should build a snapshot with empty headers and cookies when given a browser interaction', () => {
      // Arrange
      const session = { id: 'session-1' }

      // Act
      const snapshot = BrowserSnapshotFactory.create({
        method: 'POST',
        url: '/demo/start?ref=123&tag=a&tag=b#some-header',
        resolved,
        location,
        body: { fullName: 'Ada' },
        session,
      })

      // Assert
      expect(snapshot).toEqual({
        nodeId: 'step-1',
        method: 'POST',
        location: {
          origin: 'https://forms.example',
          href: 'https://forms.example/demo/start?ref=123&tag=a&tag=b',
          pathname: '/demo/start',
          basePath: '/demo',
        },
        params: {},
        query: { ref: '123', tag: ['a', 'b'] },
        post: { fullName: 'Ada' },
        headers: {},
        cookies: {},
        state: {},
        session,
      })
    })

    it('should resolve base path params when the route declares them', () => {
      // Arrange
      const paramResolved: ResolvedBrowserRoute = {
        route: {
          nodeId: 'step-2',
          kind: 'step',
          templatePath: '/cases/:caseId/review',
          basePath: '/cases/:caseId',
          methods: ['GET'],
        },
        params: { caseId: '99' },
      }

      // Act
      const snapshot = BrowserSnapshotFactory.create({
        method: 'GET',
        url: '/cases/99/review',
        resolved: paramResolved,
        location,
        session: {},
      })

      // Assert
      expect(snapshot.location.basePath).toBe('/cases/99')
      expect(snapshot.params).toEqual({ caseId: '99' })
    })
  })
})
