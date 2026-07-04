import { describe, expect, it } from 'vitest'
import type { ForgeRoute, ForgeTopology } from '@ministryofjustice/hmpps-forge/core/framework'

import NextRouteResolver from './NextRouteResolver'

const route: ForgeRoute = {
  nodeId: 'journey::details',
  kind: 'step',
  templatePath: '/orders/:id/details',
  basePath: '/orders/:id',
  methods: ['GET'],
}

function topologyOf(...routes: ForgeRoute[]): ForgeTopology {
  return { routes }
}

describe('NextRouteResolver', () => {
  describe('resolve()', () => {
    it('should return a matched resolution with extracted params when the path and method match', () => {
      // Arrange
      const topology = topologyOf(route)

      // Act
      const resolution = NextRouteResolver.resolve(topology, 'GET', '/orders/42/details')

      // Assert
      expect(resolution).toEqual({ kind: 'matched', route, params: { id: '42' } })
    })

    it('should return method-not-allowed with the route methods when the path matches another method', () => {
      // Arrange
      const topology = topologyOf(route)

      // Act
      const resolution = NextRouteResolver.resolve(topology, 'POST', '/orders/42/details')

      // Assert
      expect(resolution).toEqual({ kind: 'method-not-allowed', allowed: ['GET'] })
    })

    it('should return not-found when no route path matches', () => {
      // Arrange
      const topology = topologyOf(route)

      // Act
      const resolution = NextRouteResolver.resolve(topology, 'GET', '/orders/42')

      // Assert
      expect(resolution).toEqual({ kind: 'not-found' })
    })

    it('should ignore a trailing slash when matching a path', () => {
      // Arrange
      const topology = topologyOf(route)

      // Act
      const resolution = NextRouteResolver.resolve(topology, 'GET', '/orders/42/details/')

      // Assert
      expect(resolution).toEqual({ kind: 'matched', route, params: { id: '42' } })
    })
  })
})
