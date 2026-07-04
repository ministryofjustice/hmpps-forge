import { describe, expect, it, vi } from 'vitest'
import { headers } from 'next/headers'

import NextRequestFactory from './NextRequestFactory'

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}))

const mockHeaders = vi.mocked(headers)

describe('NextRequestFactory', () => {
  describe('buildPageRequest()', () => {
    it('should build a GET request from the mount path, catch-all params and origin option', async () => {
      // Arrange
      mockHeaders.mockResolvedValue(new Headers())

      // Act
      const request = await NextRequestFactory.buildPageRequest(
        { params: { forgePath: ['demo', 'start'] } },
        { mountPath: '/forms', origin: 'http://localhost' },
      )

      // Assert
      expect(request.method).toBe('GET')
      expect(request.url).toBe('http://localhost/forms/demo/start')
    })

    it('should append search params including array values to the URL', async () => {
      // Arrange
      mockHeaders.mockResolvedValue(new Headers())

      // Act
      const request = await NextRequestFactory.buildPageRequest(
        { params: { forgePath: ['demo', 'start'] }, searchParams: { tag: ['a', 'b'], q: 'x' } },
        { mountPath: '/forms', origin: 'http://localhost' },
      )

      // Assert
      const url = new URL(request.url)
      expect(url.pathname).toBe('/forms/demo/start')
      expect(url.searchParams.getAll('tag')).toEqual(['a', 'b'])
      expect(url.searchParams.get('q')).toBe('x')
    })

    it('should read the catch-all segment from a custom pathParam', async () => {
      // Arrange
      mockHeaders.mockResolvedValue(new Headers())

      // Act
      const request = await NextRequestFactory.buildPageRequest(
        { params: { slug: ['demo', 'done'] } },
        { mountPath: '/forms', pathParam: 'slug', origin: 'http://localhost' },
      )

      // Assert
      expect(new URL(request.url).pathname).toBe('/forms/demo/done')
    })

    it('should infer the origin from forwarded headers when no origin option is given', async () => {
      // Arrange
      mockHeaders.mockResolvedValue(new Headers({ 'x-forwarded-host': 'example.test', 'x-forwarded-proto': 'https' }))

      // Act
      const request = await NextRequestFactory.buildPageRequest(
        { params: { forgePath: ['demo', 'start'] } },
        { mountPath: '/forms' },
      )

      // Assert
      expect(request.url).toBe('https://example.test/forms/demo/start')
    })
  })

  describe('buildActionRequest()', () => {
    it('should build a POST request carrying the form data body', async () => {
      // Arrange
      mockHeaders.mockResolvedValue(new Headers())
      const formData = new FormData()
      formData.set('name', 'Terry')

      // Act
      const request = await NextRequestFactory.buildActionRequest('/forms/demo/start', formData, {
        origin: 'http://localhost',
      })

      // Assert
      expect(request.method).toBe('POST')
      expect(request.url).toBe('http://localhost/forms/demo/start')
      const body = await request.formData()
      expect(body.get('name')).toBe('Terry')
    })
  })
})
