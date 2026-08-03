import { extractPathname, resolvePathParams } from './routePath'

describe('routePath', () => {
  describe('extractPathname()', () => {
    it('should extract a pathname from an absolute URL', () => {
      // Arrange
      const url = 'https://example.test/forms/journey/step?tab=current#summary'

      // Act
      const result = extractPathname(url)

      // Assert
      expect(result).toBe('/forms/journey/step')
    })

    it('should extract a pathname from a relative request URL', () => {
      // Arrange
      const url = '/forms/journey/step?tab=current#summary'

      // Act
      const result = extractPathname(url)

      // Assert
      expect(result).toBe('/forms/journey/step')
    })
  })

  describe('resolvePathParams()', () => {
    it('should substitute matching param placeholders', () => {
      // Arrange
      const path = '/users/:userId/cases/:caseId'
      const params = { userId: 'user-1', caseId: 'case-99' }

      // Act
      const result = resolvePathParams(path, params)

      // Assert
      expect(result).toBe('/users/user-1/cases/case-99')
    })

    it('should preserve unmatched param placeholders', () => {
      // Arrange
      const path = '/users/:userId/cases/:caseId'
      const params = { userId: 'user-1' }

      // Act
      const result = resolvePathParams(path, params)

      // Assert
      expect(result).toBe('/users/user-1/cases/:caseId')
    })
  })
})
