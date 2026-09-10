import BrowserNavigationUrl from './BrowserNavigationUrl'

describe('BrowserNavigationUrl', () => {
  describe('resolve()', () => {
    it('should resolve a relative URL and expose each browser representation', () => {
      // Arrange
      const baseUrl = 'https://forms.example/browser-demo/your-name'

      // Act
      const url = BrowserNavigationUrl.resolve('contact?ref=123#email', baseUrl)

      // Assert
      expect(url.getOrigin()).toBe('https://forms.example')
      expect(url.getPathname()).toBe('/browser-demo/contact')
      expect(url.getFragment()).toBe('email')
      expect(url.toAbsoluteUrl()).toBe('https://forms.example/browser-demo/contact?ref=123#email')
      expect(url.toRelativeUrl()).toBe('/browser-demo/contact?ref=123#email')
      expect(url.toRequestPath()).toBe('/browser-demo/contact?ref=123')
      expect(url.toRequestHref()).toBe('https://forms.example/browser-demo/contact?ref=123')
    })

    it('should collect repeated query parameters in their original order', () => {
      // Arrange
      const queryUrl = '/search?tag=a&query=smith&tag=b'

      // Act
      const url = BrowserNavigationUrl.resolve(queryUrl, 'https://forms.example/')

      // Assert
      expect(url.getQuery()).toEqual({ tag: ['a', 'b'], query: 'smith' })
    })

    it('should compare origins after URL normalization', () => {
      // Arrange
      const url = BrowserNavigationUrl.resolve('https://forms.example:443/contact', 'https://outside.example/')

      // Act
      const sameOrigin = url.isSameOrigin('https://forms.example')

      // Assert
      expect(sameOrigin).toBe(true)
    })
  })
})
