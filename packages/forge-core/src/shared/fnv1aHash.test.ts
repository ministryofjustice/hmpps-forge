import { fnv1aHash } from './fnv1aHash'

describe('fnv1aHash()', () => {
  it('should return the known FNV-1a vector when hashing an empty string', () => {
    // Arrange
    const input = ''

    // Act
    const hash = fnv1aHash(input)

    // Assert
    expect(hash).toBe('cbf29ce484222325')
  })

  it('should return the known FNV-1a vector when hashing a short ascii string', () => {
    // Arrange
    const input = 'a'

    // Act
    const hash = fnv1aHash(input)

    // Assert
    expect(hash).toBe('af63dc4c8601ec8c')
  })

  it('should return the same hash when hashing the same input twice', () => {
    // Arrange
    const input = JSON.stringify({ journey: { code: 'demo', steps: [{ path: '/start' }] } })

    // Act
    const first = fnv1aHash(input)
    const second = fnv1aHash(input)

    // Assert
    expect(first).toBe(second)
  })

  it('should return different hashes when inputs differ', () => {
    // Arrange
    const left = 'forge-source-a'
    const right = 'forge-source-b'

    // Act
    const leftHash = fnv1aHash(left)
    const rightHash = fnv1aHash(right)

    // Assert
    expect(leftHash).not.toBe(rightHash)
  })

  it('should hash multi-byte characters by their utf-8 bytes', () => {
    // Arrange
    const input = 'né'

    // Act
    const hash = fnv1aHash(input)

    // Assert
    expect(hash).toHaveLength(16)
    expect(hash).not.toBe(fnv1aHash('ne'))
  })
})
