import type { ForgeRoute, ForgeTopology } from '../../framework/types/topology.type'
import TestRouteResolver from './TestRouteResolver'

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

const topology: ForgeTopology = { routes: ROUTES }

describe('TestRouteResolver', () => {
  describe('resolve()', () => {
    it('should match a static path', () => {
      // Act
      const result = TestRouteResolver.resolve('/step-one', 'GET', topology)

      // Assert
      expect(result.route.nodeId).toBe('step-one')
      expect(result.params).toEqual({})
    })

    it('should extract params from a parameterized path', () => {
      // Act
      const result = TestRouteResolver.resolve('/journey/my-form/step', 'GET', topology)

      // Assert
      expect(result.route.nodeId).toBe('param-step')
      expect(result.params).toEqual({ code: 'my-form' })
    })

    it('should throw when no route matches', () => {
      // Act & Assert
      expect(() => TestRouteResolver.resolve('/nonexistent', 'GET', topology)).toThrow('No route matched')
    })
  })
})
