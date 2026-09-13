import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MarkdownSectionFactory } from './MarkdownSectionFactory'

describe('MarkdownSectionFactory', () => {
  let tempDir: string | undefined

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'markdown-section-factory-'))
  })

  afterEach(async () => {
    if (!tempDir) {
      return
    }

    await rm(tempDir, { recursive: true, force: true })
  })

  describe('build()', () => {
    it.each([
      {
        description: 'one preview is referenced',
        body: ':::preview\n---\nslot: address-lookup-results\n---\n:::',
        names: ['address-lookup-results'],
      },
      { description: 'no previews are referenced', body: 'Plain markdown', names: [] },
      {
        description: 'a preview appears only in a code fence',
        body: '```markdown\n:::preview\n---\nslot: unknown\n---\n:::\n```',
        names: [],
      },
    ])('should include only requested slots when $description', async ({ body, names }) => {
      // Arrange
      if (!tempDir) {
        throw new Error('Temporary directory was not created')
      }

      await writeFile(
        join(tempDir, 'page.md'),
        `---\ntitle: Example\nslug: arbitrary-page\n---\n${body}`,
      )
      const factory = new MarkdownSectionFactory(tempDir, {
        code: 'concepts',
        title: 'Concepts',
        path: '/concepts',
      })

      // Act
      const definition = factory.build()

      // Assert
      expect(definition.steps?.[0]?.blocks).toEqual([
        expect.objectContaining({
          slots: Object.fromEntries(names.map(name => [name, expect.any(Array)])),
        }),
      ])
    })

    it('should name the file and preview when a referenced preview is unknown', async () => {
      // Arrange
      if (!tempDir) {
        throw new Error('Temporary directory was not created')
      }

      await writeFile(
        join(tempDir, 'page.md'),
        '---\ntitle: Example\nslug: arbitrary-page\n---\n:::preview\n---\nslot: missing-example\n---\n:::',
      )
      const factory = new MarkdownSectionFactory(tempDir, {
        code: 'concepts',
        title: 'Concepts',
        path: '/concepts',
      })

      // Act
      const build = () => factory.build()

      // Assert
      expect(build).toThrow('Unknown preview "missing-example" in "page.md"')
    })

    it('should parse a multi-line array under a submap key when the bracket opens on its own line', async () => {
      // Arrange
      if (!tempDir) {
        throw new Error('Temporary directory was not created')
      }

      await writeFile(
        join(tempDir, 'page.md'),
        [
          '---',
          'title: Example page',
          'slug: example-page',
          'order: 1',
          'related:',
          '  concept:',
          '    [',
          '      first-concept,',
          '      second-concept,',
          '    ]',
          '  reference: [journey, step]',
          'next:',
          '  how-to: testing',
          '---',
          '',
          '# Example page',
        ].join('\n'),
      )

      const factory = new MarkdownSectionFactory(tempDir, {
        code: 'concepts',
        title: 'Concepts',
        path: '/concepts',
      })

      // Act
      const definition = factory.build()

      // Assert
      expect(definition.steps?.[0]?.metadata).toMatchObject({
        related: {
          concept: 'first-concept,second-concept',
          reference: 'journey,step',
        },
        next: {
          'how-to': 'testing',
        },
      })
    })

    it('should pass nav through to the step metadata when set in frontmatter', async () => {
      // Arrange
      if (!tempDir) {
        throw new Error('Temporary directory was not created')
      }

      await writeFile(
        join(tempDir, 'page.md'),
        [
          '---',
          'title: Example page',
          'slug: example-page',
          'order: 1',
          'nav: Getting started/Basics',
          '---',
          '',
          '# Example page',
        ].join('\n'),
      )

      const factory = new MarkdownSectionFactory(tempDir, {
        code: 'concepts',
        title: 'Concepts',
        path: '/concepts',
      })

      // Act
      const definition = factory.build()

      // Assert
      expect(definition.steps?.[0]?.metadata).toMatchObject({
        nav: 'Getting started/Basics',
      })
    })

    it('should generate steps from markdown files in nested folders', async () => {
      // Arrange
      if (!tempDir) {
        throw new Error('Temporary directory was not created')
      }

      const nestedDir = join(tempDir, 'structural')

      await mkdir(nestedDir)
      await writeFile(
        join(nestedDir, 'journey.md'),
        [
          '---',
          'title: journey()',
          'slug: journey',
          'order: 1',
          'nav: Authoring API/Structural',
          '---',
          '',
          '# `journey()`',
        ].join('\n'),
      )

      const factory = new MarkdownSectionFactory(tempDir, {
        code: 'reference',
        title: 'Reference',
        path: '/reference',
      })

      // Act
      const definition = factory.build()

      // Assert
      expect(definition.steps?.[0]).toMatchObject({
        path: '/journey',
        title: 'journey()',
        metadata: { nav: 'Authoring API/Structural' },
      })
    })
  })
})
