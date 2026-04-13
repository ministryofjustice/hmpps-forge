import { chunkEntries } from './guideContentStore'
import type { ContentEntry } from './guideContentStore'

function makeEntry(
  slug: string,
  title: string,
  markdown: string,
  tags: string[] = [],
): ContentEntry {
  return { slug, path: slug, title, tags, markdown }
}

describe('chunkEntries()', () => {
  it('should split content on ## headings', () => {
    // Arrange
    const entries = [
      makeEntry(
        'test',
        'Test',
        '## First\nSome content that is long enough to pass the minimum length filter.\n\n## Second\nMore content that is also long enough to pass the minimum length filter.',
      ),
    ]

    // Act
    const chunks = chunkEntries(entries)

    // Assert
    expect(chunks).toHaveLength(2)
    expect(chunks[0].heading).toBe('First')
    expect(chunks[1].heading).toBe('Second')
  })

  it('should label content before first heading as Introduction', () => {
    // Arrange
    const entries = [
      makeEntry(
        'test',
        'Test',
        'This is an introduction paragraph with enough text to pass the filter.\n\n## Section\nSection content that is long enough to not be filtered out by minimum length.',
      ),
    ]

    // Act
    const chunks = chunkEntries(entries)

    // Assert
    expect(chunks[0].heading).toBe('Introduction')
    expect(chunks[1].heading).toBe('Section')
  })

  it('should skip chunks shorter than 50 characters', () => {
    // Arrange
    const entries = [
      makeEntry(
        'test',
        'Test',
        '## Short\nTiny.\n\n## Long\nThis section has plenty of text content that exceeds the minimum character threshold.',
      ),
    ]

    // Act
    const chunks = chunkEntries(entries)

    // Assert
    expect(chunks).toHaveLength(1)
    expect(chunks[0].heading).toBe('Long')
  })

  it('should preserve slug and title from parent entry', () => {
    // Arrange
    const entries = [
      makeEntry(
        'blocks',
        'Blocks',
        '## Concepts\nThis is a section about block concepts with enough detail to be meaningful.',
      ),
    ]

    // Act
    const chunks = chunkEntries(entries)

    // Assert
    expect(chunks[0].slug).toBe('blocks')
    expect(chunks[0].title).toBe('Blocks')
  })

  it('should handle multiple entries', () => {
    // Arrange
    const entries = [
      makeEntry(
        'a',
        'A',
        '## One\nContent for section one that is long enough to pass the minimum filter.',
      ),
      makeEntry(
        'b',
        'B',
        '## Two\nContent for section two that is also long enough to pass the minimum filter.',
      ),
    ]

    // Act
    const chunks = chunkEntries(entries)

    // Assert
    expect(chunks).toHaveLength(2)
    expect(chunks[0].slug).toBe('a')
    expect(chunks[1].slug).toBe('b')
  })
})
