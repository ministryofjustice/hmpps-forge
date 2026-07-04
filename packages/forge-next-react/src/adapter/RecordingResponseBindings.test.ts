import { describe, expect, it } from 'vitest'

import RecordingResponseBindings from './RecordingResponseBindings'

describe('RecordingResponseBindings', () => {
  describe('applyTo()', () => {
    it('should apply a recorded header to the response', () => {
      // Arrange
      const bindings = new RecordingResponseBindings()
      bindings.setHeader('x-custom', 'value')

      // Act
      const response = bindings.applyTo(new Response())

      // Assert
      expect(response.headers.get('x-custom')).toBe('value')
    })

    it('should serialize a cookie with Max-Age in seconds and its flags', () => {
      // Arrange
      const bindings = new RecordingResponseBindings()
      bindings.setCookie('sid', 'abc', {
        maxAge: 60000,
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      })

      // Act
      const response = bindings.applyTo(new Response())

      // Assert
      const cookie = response.headers.getSetCookie()[0]
      expect(cookie).toContain('sid=abc')
      expect(cookie).toContain('Max-Age=60')
      expect(cookie).toContain('Path=/')
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('Secure')
      expect(cookie).toContain('SameSite=lax')
    })

    it('should append one set-cookie value per recorded cookie', () => {
      // Arrange
      const bindings = new RecordingResponseBindings()
      bindings.setCookie('first', 'one')
      bindings.setCookie('second', 'two')

      // Act
      const response = bindings.applyTo(new Response())

      // Assert
      expect(response.headers.getSetCookie()).toHaveLength(2)
    })
  })
})
