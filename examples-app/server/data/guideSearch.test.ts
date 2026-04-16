import { chunkEntries, buildExcerpt } from './guideSearch'
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

  it('should split on ### headings as well as ## headings', () => {
    // Arrange
    const entries = [
      makeEntry(
        'test',
        'Test',
        '## Parent\nParent intro content with enough text to pass the minimum length filter.\n\n### Child A\nChild A content that has enough text to pass the minimum length filter.\n\n### Child B\nChild B content that has enough text to pass the minimum length filter.',
      ),
    ]

    // Act
    const chunks = chunkEntries(entries)

    // Assert
    expect(chunks).toHaveLength(3)
    expect(chunks[0].heading).toBe('Parent')
    expect(chunks[1].heading).toBe('Child A')
    expect(chunks[2].heading).toBe('Child B')
  })

  it('should set headingPath to H2 > H3 breadcrumb for H3 chunks', () => {
    // Arrange
    const entries = [
      makeEntry(
        'test',
        'Test',
        '## Parent\nParent body that is long enough to pass the minimum length filter on its own.\n\n### Child\nChild body that is long enough to pass the minimum length filter on its own.',
      ),
    ]

    // Act
    const chunks = chunkEntries(entries)

    // Assert
    expect(chunks[0].headingPath).toBe('Parent')
    expect(chunks[1].heading).toBe('Child')
    expect(chunks[1].headingPath).toBe('Parent > Child')
  })

  it('should sub-split long sections with paragraph-level overlap', () => {
    // Arrange
    const paragraph = 'paragraph text '.repeat(10).trim()
    const longBody = Array(8).fill(paragraph).join('\n\n')
    const entries = [makeEntry('test', 'Test', `## Big\n${longBody}`)]

    // Act
    const chunks = chunkEntries(entries)

    // Assert
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every(chunk => chunk.heading === 'Big')).toBe(true)
    expect(chunks.every(chunk => chunk.text.length <= 1000)).toBe(true)

    const overlapText = chunks[0].text.split('\n\n').pop()

    expect(chunks[1].text).toContain(overlapText)
  })
})

describe('buildExcerpt()', () => {
  it('should wrap matched terms in mark tags', () => {
    // Arrange
    const text = 'Blocks describe the visible building pieces of a journey.'

    // Act
    const excerpt = buildExcerpt(text, ['blocks'])

    // Assert
    expect(excerpt).toContain('<mark>Blocks</mark>')
  })

  it('should match whole words only, not substrings', () => {
    // Arrange
    const text = 'The unblockable feature is unrelated.'

    // Act
    const excerpt = buildExcerpt(text, ['block'])

    // Assert
    expect(excerpt).not.toContain('<mark>')
  })

  it('should neutralise raw HTML in content and escape quotes', () => {
    // Arrange
    const text = 'Use <script>alert("x")</script> with care in blocks.'

    // Act
    const excerpt = buildExcerpt(text, ['blocks'])

    // Assert
    expect(excerpt).not.toContain('<script>')
    expect(excerpt).toContain('&quot;x&quot;')
    expect(excerpt).toContain('<mark>blocks</mark>')
  })

  it('should centre the excerpt near the first matched term when it appears deep in the text', () => {
    // Arrange
    const filler = 'this is some filler text that pushes the match deeper. '.repeat(10)
    const text = `${filler}The special keyword appears here.`

    // Act
    const excerpt = buildExcerpt(text, ['keyword'])

    // Assert
    expect(excerpt).toContain('<mark>keyword</mark>')
    expect(excerpt.startsWith('this is some filler')).toBe(false)
  })

  it('should fall back to leading text when no term matches', () => {
    // Arrange
    const text = 'A journey describes a set of steps a user completes together.'

    // Act
    const excerpt = buildExcerpt(text, ['unrelated'])

    // Assert
    expect(excerpt).toContain('A journey describes')
    expect(excerpt).not.toContain('<mark>')
  })

  it('should return an empty string for empty content', () => {
    // Arrange / Act
    const excerpt = buildExcerpt('', ['anything'])

    // Assert
    expect(excerpt).toBe('')
  })
})
