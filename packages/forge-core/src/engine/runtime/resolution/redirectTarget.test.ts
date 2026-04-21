import { parseRedirectTarget, resolveRedirectTarget } from './redirectTarget'

describe('redirectTarget', () => {
  describe('parseRedirectTarget()', () => {
    it('should classify external URLs', () => {
      // Arrange
      const target = 'https://service.test/logout'

      // Act
      const result = parseRedirectTarget(target)

      // Assert
      expect(result).toEqual({ kind: 'external', value: 'https://service.test/logout' })
    })

    it('should classify absolute domain paths', () => {
      // Arrange
      const target = '/help/contact'

      // Act
      const result = parseRedirectTarget(target)

      // Assert
      expect(result).toEqual({ kind: 'absolute', value: '/help/contact' })
    })

    it('should classify relative paths', () => {
      // Arrange
      const target = '../documents/list'

      // Act
      const result = parseRedirectTarget(target)

      // Assert
      expect(result).toEqual({ kind: 'relative', value: '../documents/list' })
    })
  })

  describe('resolveRedirectTarget()', () => {
    it('should preserve external URLs unchanged', () => {
      // Arrange
      const target = 'https://service.test/logout'

      // Act
      const result = resolveRedirectTarget(target, {
        origin: 'https://our-domain.com',
        pathname: '/forms/applications/123/people',
      })

      // Assert
      expect(result).toEqual({
        kind: 'external',
        value: 'https://service.test/logout',
        pathname: '/logout',
      })
    })

    it('should resolve absolute paths from the current domain root', () => {
      // Arrange
      const target = '/help/contact'

      // Act
      const result = resolveRedirectTarget(target, {
        origin: 'https://our-domain.com',
        pathname: '/forms/applications/123/people',
      })

      // Assert
      expect(result).toEqual({
        kind: 'absolute',
        value: '/help/contact',
        pathname: '/help/contact',
      })
    })

    it('should resolve sibling relative redirects against the current pathname', () => {
      // Arrange
      const target = '../documents/list'

      // Act
      const result = resolveRedirectTarget(target, {
        origin: 'https://our-domain.com',
        pathname: '/forms/applications/:applicationId/people/',
      })

      // Assert
      expect(result).toEqual({
        kind: 'relative',
        value: '/forms/applications/:applicationId/documents/list',
        pathname: '/forms/applications/:applicationId/documents/list',
      })
    })

    it('should resolve ancestor redirects against the current pathname', () => {
      // Arrange
      const target = '../../people/list'

      // Act
      const result = resolveRedirectTarget(target, {
        origin: 'https://our-domain.com',
        pathname: '/forms/applications/:applicationId/people/:personId/details',
      })

      // Assert
      expect(result).toEqual({
        kind: 'relative',
        value: '/forms/applications/:applicationId/people/list',
        pathname: '/forms/applications/:applicationId/people/list',
      })
    })

    it('should preserve query strings and hashes for runtime redirects', () => {
      // Arrange
      const target = './check-answers?from=details#errors'

      // Act
      const result = resolveRedirectTarget(target, {
        origin: 'https://our-domain.com',
        pathname: '/forms/applications/123/people/456/details',
      })

      // Assert
      expect(result).toEqual({
        kind: 'relative',
        value: '/forms/applications/123/people/456/check-answers?from=details#errors',
        pathname: '/forms/applications/123/people/456/check-answers',
      })
    })

    it('should resolve plain step names against basePath when provided', () => {
      // Arrange
      const target = 'your-contacts'

      // Act
      const result = resolveRedirectTarget(target, {
        origin: 'https://our-domain.com',
        pathname: '/forms/journey/edit-contact/0',
        basePath: '/forms/journey',
      })

      // Assert
      expect(result).toEqual({
        kind: 'relative',
        value: '/forms/journey/your-contacts',
        pathname: '/forms/journey/your-contacts',
      })
    })

    it('should resolve dot-relative paths against pathname even when basePath is provided', () => {
      // Arrange
      const target = '../documents/list'

      // Act
      const result = resolveRedirectTarget(target, {
        origin: 'https://our-domain.com',
        pathname: '/forms/applications/:applicationId/people/',
        basePath: '/forms/applications/:applicationId',
      })

      // Assert
      expect(result).toEqual({
        kind: 'relative',
        value: '/forms/applications/:applicationId/documents/list',
        pathname: '/forms/applications/:applicationId/documents/list',
      })
    })

    it('should resolve plain step paths with sub-segments against basePath', () => {
      // Arrange
      const target = 'section/step-one'

      // Act
      const result = resolveRedirectTarget(target, {
        origin: 'https://our-domain.com',
        pathname: '/forms/journey/deep/nested/step',
        basePath: '/forms/journey',
      })

      // Assert
      expect(result).toEqual({
        kind: 'relative',
        value: '/forms/journey/section/step-one',
        pathname: '/forms/journey/section/step-one',
      })
    })

    it('should fall back to pathname resolution when basePath is not provided', () => {
      // Arrange
      const target = 'sibling-step'

      // Act
      const result = resolveRedirectTarget(target, {
        origin: 'https://our-domain.com',
        pathname: '/forms/journey/current-step',
      })

      // Assert
      expect(result).toEqual({
        kind: 'relative',
        value: '/forms/journey/sibling-step',
        pathname: '/forms/journey/sibling-step',
      })
    })
  })
})
