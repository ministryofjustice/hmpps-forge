import { resolveRouteTemplateTargetPath } from './routeTemplateTargetResolver'

describe('resolveRouteTemplateTargetPath()', () => {
  it('should resolve absolute route-template paths without a host', () => {
    // Arrange
    const target = '/forms/:id/check-answers?from=details#top'

    // Act
    const result = resolveRouteTemplateTargetPath(target, '/forms/:id/details')

    // Assert
    expect(result).toBe('/forms/:id/check-answers')
  })

  it('should resolve sibling relative paths against the current route template', () => {
    // Arrange
    const target = 'check-answers'

    // Act
    const result = resolveRouteTemplateTargetPath(target, '/forms/:id/details')

    // Assert
    expect(result).toBe('/forms/:id/check-answers')
  })

  it('should resolve dot-relative paths against the current route-template directory', () => {
    // Arrange
    const target = '../documents/list?from=details'

    // Act
    const result = resolveRouteTemplateTargetPath(target, '/forms/:id/people/:personId/details')

    // Assert
    expect(result).toBe('/forms/:id/people/documents/list')
  })

  it('should resolve relative paths from trailing-slash route templates as directories', () => {
    // Arrange
    const target = '../documents/list'

    // Act
    const result = resolveRouteTemplateTargetPath(target, '/forms/:id/people/')

    // Assert
    expect(result).toBe('/forms/:id/documents/list')
  })

  it('should ignore external targets', () => {
    // Arrange
    const target = 'https://service.test/forms/:id/check-answers'

    // Act
    const result = resolveRouteTemplateTargetPath(target, '/forms/:id/details')

    // Assert
    expect(result).toBeUndefined()
  })

  it('should ignore protocol-relative targets', () => {
    // Arrange
    const target = '//service.test/forms/:id/check-answers'

    // Act
    const result = resolveRouteTemplateTargetPath(target, '/forms/:id/details')

    // Assert
    expect(result).toBeUndefined()
  })
})
