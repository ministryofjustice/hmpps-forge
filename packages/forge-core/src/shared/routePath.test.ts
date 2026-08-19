import { joinPaths, normalizeBasePath, normalizeRelativePath, resolvePathParams } from './routePath'

describe('routePath', () => {
  describe('normalizeBasePath()', () => {
    it('should normalize missing leading and trailing slashes', () => {
      // Arrange
      const basePath = 'forms/journey/'

      // Act
      const result = normalizeBasePath(basePath)

      // Assert
      expect(result).toBe('/forms/journey')
    })

    it('should return an empty string when base path is undefined', () => {
      // Act
      const result = normalizeBasePath()

      // Assert
      expect(result).toBe('')
    })
  })

  describe('normalizeRelativePath()', () => {
    it('should strip a leading slash and query fragments', () => {
      // Arrange
      const path = '/next-step?from=summary#details'

      // Act
      const result = normalizeRelativePath(path)

      // Assert
      expect(result).toBe('next-step')
    })

    it('should preserve an external URL origin while dropping query fragments', () => {
      // Arrange
      const path = 'https://example.test/next-step?from=summary#details'

      // Act
      const result = normalizeRelativePath(path)

      // Assert
      expect(result).toBe('https://example.test/next-step')
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

  describe('joinPaths()', () => {
    it('should collapse duplicate slashes across segments', () => {
      // Arrange
      const segments = ['/forms/', '/journey', 'step-one']

      // Act
      const result = joinPaths(...segments)

      // Assert
      expect(result).toBe('/forms/journey/step-one')
    })

    it('should return the root path when all segments are empty', () => {
      // Act
      const result = joinPaths('', '/')

      // Assert
      expect(result).toBe('/')
    })
  })
})
