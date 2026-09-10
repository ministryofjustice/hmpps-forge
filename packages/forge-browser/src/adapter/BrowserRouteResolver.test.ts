import type { ForgeTopology } from '@ministryofjustice/hmpps-forge/core/framework'
import BrowserRouteResolver from './BrowserRouteResolver'

const topology: ForgeTopology = {
  routes: [
    { nodeId: 'journey-1', kind: 'journey', templatePath: '/demo', basePath: '/demo', methods: ['GET'] },
    { nodeId: 'step-1', kind: 'step', templatePath: '/demo/start', basePath: '/demo', methods: ['GET', 'POST'] },
    {
      nodeId: 'step-2',
      kind: 'step',
      templatePath: '/demo/items/:itemId',
      basePath: '/demo',
      methods: ['GET', 'POST'],
    },
  ],
}

describe('BrowserRouteResolver', () => {
  describe('resolve()', () => {
    it('should match a static path to its route', () => {
      // Arrange
      const path = '/demo/start'

      // Act
      const resolved = BrowserRouteResolver.resolve(path, 'GET', topology)

      // Assert
      expect(resolved?.route.nodeId).toBe('step-1')
      expect(resolved?.params).toEqual({})
    })

    it('should capture path params when the template declares them', () => {
      // Arrange
      const path = '/demo/items/42'

      // Act
      const resolved = BrowserRouteResolver.resolve(path, 'GET', topology)

      // Assert
      expect(resolved?.route.nodeId).toBe('step-2')
      expect(resolved?.params).toEqual({ itemId: '42' })
    })

    it('should return undefined when no route matches the path', () => {
      // Arrange
      const path = '/somewhere-else'

      // Act
      const resolved = BrowserRouteResolver.resolve(path, 'GET', topology)

      // Assert
      expect(resolved).toBeUndefined()
    })

    it('should return undefined when the route does not accept the method', () => {
      // Arrange
      const path = '/demo'

      // Act
      const resolved = BrowserRouteResolver.resolve(path, 'POST', topology)

      // Assert
      expect(resolved).toBeUndefined()
    })

    it('should ignore trailing slashes and query strings when matching', () => {
      // Arrange
      const path = '/demo/start/?from=nav'

      // Act
      const resolved = BrowserRouteResolver.resolve(path, 'GET', topology)

      // Assert
      expect(resolved?.route.nodeId).toBe('step-1')
    })
  })
})
