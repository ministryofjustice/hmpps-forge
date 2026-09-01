import type { ForgeTopology } from '@ministryofjustice/hmpps-forge/core/framework'
import { LlmSnapshotFactory } from './LlmSnapshotFactory'

const topology: ForgeTopology = {
  routes: [
    {
      nodeId: 'application::details',
      kind: 'step',
      templatePath: '/applications/:applicationId/details',
      basePath: '/applications/:applicationId',
      methods: ['GET', 'POST'],
    },
  ],
}

describe('LlmSnapshotFactory', () => {
  describe('resolve()', () => {
    it('should resolve concrete route parameters for a supported method', () => {
      // Arrange
      const factory = new LlmSnapshotFactory('https://service.example')

      // Act
      const resolved = factory.resolve('POST', '/applications/app-123/details?source=chat', topology)

      // Assert
      expect(resolved).toEqual({
        route: topology.routes[0],
        params: { applicationId: 'app-123' },
      })
    })

    it('should not resolve an external URL with a matching pathname', () => {
      // Arrange
      const factory = new LlmSnapshotFactory('https://service.example')

      // Act
      const resolved = factory.resolve('GET', 'https://elsewhere.example/applications/app-123/details', topology)

      // Assert
      expect(resolved).toBeUndefined()
    })
  })

  describe('create()', () => {
    it('should create a snapshot with path parameters and repeated query values', () => {
      // Arrange
      const factory = new LlmSnapshotFactory('https://service.example')
      const resolved = factory.resolve(
        'POST',
        '/applications/app-123/details?tag=first&tag=second&source=chat',
        topology,
      )

      if (resolved === undefined) {
        throw new Error('Expected the route to resolve')
      }

      const session = { answers: { name: 'Sam' } }

      // Act
      const snapshot = factory.create(
        'POST',
        '/applications/app-123/details?tag=first&tag=second&source=chat',
        resolved,
        session,
        { name: 'Alex' },
      )

      // Assert
      expect(snapshot).toEqual({
        nodeId: 'application::details',
        method: 'POST',
        location: {
          origin: 'https://service.example',
          href: 'https://service.example/applications/app-123/details?tag=first&tag=second&source=chat',
          pathname: '/applications/app-123/details',
          basePath: '/applications/app-123',
        },
        params: { applicationId: 'app-123' },
        query: { tag: ['first', 'second'], source: 'chat' },
        post: { name: 'Alex' },
        headers: {},
        cookies: {},
        state: {},
        session,
      })
    })
  })
})
