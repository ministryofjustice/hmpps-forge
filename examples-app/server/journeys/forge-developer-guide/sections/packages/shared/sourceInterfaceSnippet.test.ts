import { extractNamedTypeDeclarations } from './sourceInterfaceSnippet'

describe('extractNamedTypeDeclarations()', () => {
  it('should extract named type declarations with their leading documentation', () => {
    // Arrange
    const source = `
/**
 * Alert variant types.
 */
export type ExampleVariant = 'information' | 'warning'

/**
 * Long variant types.
 */
export type LongExampleVariant =
  | 'information'
  | 'warning'
  | 'success'

/**
 * Props for the example component.
 */
export interface ExampleProps {
  /**
   * HTML attributes.
   * @example { 'data-module': 'example' }
   */
  attributes?: Record<string, string>
}

export interface UnrelatedProps {
  text: string
}
`

    // Act
    const snippet = extractNamedTypeDeclarations(source, [
      'ExampleVariant',
      'LongExampleVariant',
      'ExampleProps',
    ])

    // Assert
    expect(snippet).toContain("export type ExampleVariant = 'information' | 'warning'")
    expect(snippet).toContain("| 'success'")
    expect(snippet).toContain('export interface ExampleProps')
    expect(snippet).toContain("@example { 'data-module': 'example' }")
    expect(snippet).not.toContain('UnrelatedProps')
  })

  it('should throw when a requested declaration is missing', () => {
    // Arrange
    const source = 'export interface ExampleProps { text: string }'

    // Act
    const extractMissingDeclaration = () => extractNamedTypeDeclarations(source, ['MissingProps'])

    // Assert
    expect(extractMissingDeclaration).toThrow(
      'Could not find interface or type declaration named MissingProps.',
    )
  })
})
