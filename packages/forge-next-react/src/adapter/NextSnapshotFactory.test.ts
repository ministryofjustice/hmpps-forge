import { describe, expect, it } from 'vitest'
import type { ForgeRoute } from '@ministryofjustice/hmpps-forge/core/framework'

import NextSnapshotFactory from './NextSnapshotFactory'

const route: ForgeRoute = {
  nodeId: 'journey::details',
  kind: 'step',
  templatePath: '/orders/:id/details',
  basePath: '/orders/:id',
  methods: ['GET', 'POST'],
}

describe('NextSnapshotFactory', () => {
  describe('create()', () => {
    it('should map GET request fields and resolve the base path from route params', async () => {
      // Arrange
      const request = new Request('http://localhost/orders/42/details?foo=bar&foo=baz', {
        headers: { 'x-custom': 'value' },
      })

      // Act
      const snapshot = await NextSnapshotFactory.create({
        route,
        method: 'GET',
        request,
        params: { id: '42' },
        session: { user: 'Terry' },
        state: { flag: true },
      })

      // Assert
      expect(snapshot.nodeId).toBe('journey::details')
      expect(snapshot.method).toBe('GET')
      expect(snapshot.location).toEqual({
        origin: 'http://localhost',
        href: 'http://localhost/orders/42/details?foo=bar&foo=baz',
        pathname: '/orders/42/details',
        basePath: '/orders/42',
      })
      expect(snapshot.params).toEqual({ id: '42' })
      expect(snapshot.query).toEqual({ foo: ['bar', 'baz'] })
      expect(snapshot.post).toEqual({})
      expect(snapshot.headers['x-custom']).toBe('value')
      expect(snapshot.state).toEqual({ flag: true })
      expect(snapshot.session).toEqual({ user: 'Terry' })
    })

    it('should parse a urlencoded POST body with repeated keys into arrays', async () => {
      // Arrange
      const request = new Request('http://localhost/orders/42/details', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'a=1&a=2&b=3',
      })

      // Act
      const snapshot = await NextSnapshotFactory.create({
        route,
        method: 'POST',
        request,
        params: { id: '42' },
        session: {},
        state: {},
      })

      // Assert
      expect(snapshot.post).toEqual({ a: ['1', '2'], b: '3' })
    })

    it('should parse the cookie header into a record', async () => {
      // Arrange
      const request = new Request('http://localhost/orders/42/details', {
        headers: { cookie: 'session=abc; theme=dark' },
      })

      // Act
      const snapshot = await NextSnapshotFactory.create({
        route,
        method: 'GET',
        request,
        params: { id: '42' },
        session: {},
        state: {},
      })

      // Assert
      expect(snapshot.cookies).toEqual({ session: 'abc', theme: 'dark' })
    })

    it('should merge async context params under route params so route params win', async () => {
      // Arrange
      const request = new Request('http://localhost/orders/42/details')

      // Act
      const snapshot = await NextSnapshotFactory.create({
        route,
        method: 'GET',
        request,
        params: { id: '42' },
        session: {},
        state: {},
        context: { params: Promise.resolve({ id: 'ignored', extra: 'kept' }) },
      })

      // Assert
      expect(snapshot.params).toEqual({ id: '42', extra: 'kept' })
    })
  })
})
