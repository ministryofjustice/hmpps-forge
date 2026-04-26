import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import GuideContentStore from './guideContentStore'

describe('GuideContentStore', () => {
  let tempDir: string | undefined

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'guide-content-store-'))
  })

  afterEach(async () => {
    if (!tempDir) {
      return
    }

    await rm(tempDir, { recursive: true, force: true })
  })

  describe('load()', () => {
    it('should load guide markdown recursively using filename as slug', async () => {
      // Arrange
      if (!tempDir) {
        throw new Error('Temporary directory was not created')
      }

      const nestedDir = join(tempDir, 'sections', 'example')
      await mkdir(nestedDir, { recursive: true })
      await writeFile(
        join(nestedDir, 'example-page.md'),
        [
          '---',
          'title: Example page',
          'section: example',
          'path: example/page',
          'teaches: [one, two]',
          '---',
          '',
          '# Example page',
        ].join('\n'),
      )

      const store = new GuideContentStore(tempDir)

      // Act
      await store.load()

      // Assert
      expect(store.get('example-page')).toMatchObject({
        slug: 'example-page',
        title: 'Example page',
        section: 'example',
        path: 'example/page',
        tags: ['one', 'two'],
      })
    })

    it('should ignore markdown files without guide frontmatter fields', async () => {
      // Arrange
      if (!tempDir) {
        throw new Error('Temporary directory was not created')
      }

      await writeFile(join(tempDir, 'README.md'), '# Notes')
      await writeFile(join(tempDir, 'partial.md'), ['---', 'title: Partial', '---'].join('\n'))

      const store = new GuideContentStore(tempDir)

      // Act
      await store.load()

      // Assert
      expect(store.allEntries()).toHaveLength(0)
    })

    it('should throw when duplicate slug filenames are found', async () => {
      // Arrange
      if (!tempDir) {
        throw new Error('Temporary directory was not created')
      }

      const firstDir = join(tempDir, 'first')
      const secondDir = join(tempDir, 'second')
      await mkdir(firstDir, { recursive: true })
      await mkdir(secondDir, { recursive: true })

      const markdown = ['---', 'title: Duplicate', 'path: duplicate', '---'].join('\n')
      await writeFile(join(firstDir, 'duplicate.md'), markdown)
      await writeFile(join(secondDir, 'duplicate.md'), markdown)

      const store = new GuideContentStore(tempDir)

      // Act
      const result = store.load()

      // Assert
      await expect(result).rejects.toThrow('Duplicate guide content slug "duplicate"')
    })
  })
})
