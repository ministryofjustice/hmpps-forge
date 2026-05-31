import { escapeHtmlEntities } from './sanitize'

describe('sanitize', () => {
  describe('escapeHtmlEntities()', () => {
    it('should escape less-than character', () => {
      // Arrange
      const input = '<script>'

      // Act
      const result = escapeHtmlEntities(input)

      // Assert
      expect(result).toBe('&lt;script&gt;')
    })

    it('should escape greater-than character', () => {
      // Arrange
      const input = 'value > 10'

      // Act
      const result = escapeHtmlEntities(input)

      // Assert
      expect(result).toBe('value &gt; 10')
    })

    it('should escape ampersand', () => {
      // Arrange
      const input = 'A & B'

      // Act
      const result = escapeHtmlEntities(input)

      // Assert
      expect(result).toBe('A &amp; B')
    })

    it('should escape double quotes', () => {
      // Arrange
      const input = 'say "hello"'

      // Act
      const result = escapeHtmlEntities(input)

      // Assert
      expect(result).toBe('say &quot;hello&quot;')
    })

    it('should escape single quotes', () => {
      // Arrange
      const input = "it's fine"

      // Act
      const result = escapeHtmlEntities(input)

      // Assert
      expect(result).toBe('it&#39;s fine')
    })

    it('should escape multiple characters in complex XSS payload', () => {
      // Arrange
      const input = '<script>alert("XSS & \'attack\'")</script>'

      // Act
      const result = escapeHtmlEntities(input)

      // Assert
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS &amp; &#39;attack&#39;&quot;)&lt;/script&gt;')
    })

    it('should return unchanged string when no special characters', () => {
      // Arrange
      const input = 'Hello World 123'

      // Act
      const result = escapeHtmlEntities(input)

      // Assert
      expect(result).toBe('Hello World 123')
    })

    it('should handle empty string', () => {
      // Arrange
      const input = ''

      // Act
      const result = escapeHtmlEntities(input)

      // Assert
      expect(result).toBe('')
    })

    it('should handle img tag XSS payload', () => {
      // Arrange
      const input = '<img src=x onerror="alert(\'XSS\')">'

      // Act
      const result = escapeHtmlEntities(input)

      // Assert
      expect(result).toBe('&lt;img src=x onerror=&quot;alert(&#39;XSS&#39;)&quot;&gt;')
    })
  })
})
