import { describe, expect, it, vi } from 'vitest'

import NextActionResponseBindings, { type NextCookieStore } from './NextActionResponseBindings'

describe('NextActionResponseBindings', () => {
  describe('setCookie()', () => {
    it('should map core cookie options to Next options with Max-Age in seconds', () => {
      // Arrange
      const cookieStore: NextCookieStore = { set: vi.fn() }
      const bindings = new NextActionResponseBindings(cookieStore)

      // Act
      bindings.setCookie('sid', 'abc', { maxAge: 60000, httpOnly: true, sameSite: 'lax', path: '/' })

      // Assert
      expect(cookieStore.set).toHaveBeenCalledWith('sid', 'abc', {
        maxAge: 60,
        expires: undefined,
        httpOnly: true,
        secure: undefined,
        sameSite: 'lax',
        path: '/',
        domain: undefined,
      })
    })
  })

  describe('setHeader()', () => {
    it('should not touch the cookie store because server actions cannot set headers', () => {
      // Arrange
      const cookieStore: NextCookieStore = { set: vi.fn() }
      const bindings = new NextActionResponseBindings(cookieStore)

      // Act
      bindings.setHeader('x-custom', 'value')

      // Assert
      expect(cookieStore.set).not.toHaveBeenCalled()
    })
  })
})
