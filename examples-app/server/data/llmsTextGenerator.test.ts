import PatternSourceStore from './patternSourceStore'
import LlmsTextGenerator from './llmsTextGenerator'
import type { ContentEntry } from './guideContentStore'

const ingressUrl = 'https://forge.example'

function makeEntry(
  slug: string,
  section: string,
  path: string,
  title: string,
  markdown: string = 'Intro text.',
): ContentEntry {
  return {
    slug,
    section,
    path,
    title,
    tags: [],
    markdown,
  }
}

describe('LlmsTextGenerator', () => {
  describe('buildIndex()', () => {
    it('should link entries using frontmatter paths', () => {
      // Arrange
      const entries = [
        makeEntry('packages', 'packages', 'packages/overview', 'Packages'),
        makeEntry(
          'govuk-text-input',
          'packages',
          'packages/govuk-components/text-input',
          'Text Input',
        ),
        makeEntry('loop', 'authoring-language', 'authoring-language/loop', 'Loop'),
        makeEntry(
          'patterns-composite-fields',
          'patterns',
          'patterns/composite-fields',
          'Composite fields',
        ),
      ]
      const generator = new LlmsTextGenerator(new PatternSourceStore(), ingressUrl)

      // Act
      const index = generator.buildIndex(entries)

      // Assert
      expect(index).toContain(
        '[Text Input](https://forge.example/llms/forge-developer-guide/packages/govuk-components/text-input)',
      )
      expect(index).toContain(
        '[Loop](https://forge.example/llms/forge-developer-guide/authoring-language/loop)',
      )
      expect(index).toContain(
        '[Composite fields](https://forge.example/llms/forge-developer-guide/patterns/composite-fields)',
      )
    })

    it('should include the ingress URL in the generated path hints', () => {
      // Arrange
      const entries = [makeEntry('packages', 'packages', 'packages/overview', 'Packages')]
      const generator = new LlmsTextGenerator(new PatternSourceStore(), ingressUrl)

      // Act
      const index = generator.buildIndex(entries)

      // Assert
      expect(index).toContain(
        'https://forge.example/llms/forge-developer-guide/{path}` for full markdown',
      )
      expect(index).toContain('`https://forge.example/llms-full.txt` for everything')
    })

    it('should group nested entries under overview headings when path segments contain groups', () => {
      // Arrange
      const entries = [
        makeEntry(
          'authoring-language',
          'authoring-language',
          'authoring-language/overview',
          'Overview',
        ),
        makeEntry(
          'references',
          'authoring-language',
          'authoring-language/references/overview',
          'References',
          'Reference documentation.',
        ),
        makeEntry('loop', 'authoring-language', 'authoring-language/references/loop', 'Loop'),
        makeEntry('packages', 'packages', 'packages/overview', 'Packages'),
        makeEntry(
          'govuk-components-package',
          'packages',
          'packages/govuk-components/overview',
          'GOV.UK Components',
          'GOV.UK component documentation.',
        ),
        makeEntry(
          'govuk-text-input',
          'packages',
          'packages/govuk-components/text-input',
          'Text Input',
        ),
      ]
      const generator = new LlmsTextGenerator(new PatternSourceStore(), ingressUrl)

      // Act
      const index = generator.buildIndex(entries)

      // Assert
      expect(index).toContain('### References\n\nReference documentation.')
      expect(index).toContain('### GOV.UK Components\n\nGOV.UK component documentation.')
      expect(index.indexOf('### References')).toBeLessThan(index.indexOf('[Loop]'))
      expect(index.indexOf('### GOV.UK Components')).toBeLessThan(index.indexOf('[Text Input]'))
    })
  })

  describe('buildContentPage()', () => {
    it('should resolve relative markdown links to full llms paths', () => {
      // Arrange
      const entries = [
        makeEntry(
          'overview',
          'building-journeys',
          'building-journeys/overview',
          'Overview',
          'Start with [Defining a journey](defining-a-journey) and [Steps](defining-steps#fields).',
        ),
        makeEntry(
          'defining-a-journey',
          'building-journeys',
          'building-journeys/defining-a-journey',
          'Defining a journey',
        ),
        makeEntry(
          'defining-steps',
          'building-journeys',
          'building-journeys/defining-steps',
          'Defining steps',
        ),
      ]
      const generator = new LlmsTextGenerator(new PatternSourceStore(), ingressUrl)

      // Act
      const page = generator.buildContentPage(entries[0], entries)

      // Assert
      expect(page).toContain(
        '[Defining a journey](https://forge.example/llms/forge-developer-guide/building-journeys/defining-a-journey)',
      )
      expect(page).toContain(
        '[Steps](https://forge.example/llms/forge-developer-guide/building-journeys/defining-steps#fields)',
      )
    })

    it('should leave absolute and external links unchanged', () => {
      // Arrange
      const entries = [
        makeEntry(
          'overview',
          'get-started',
          'get-started/overview',
          'Overview',
          'See [docs](https://example.com) and [home](/get-started) and [top](#intro).',
        ),
      ]
      const generator = new LlmsTextGenerator(new PatternSourceStore(), ingressUrl)

      // Act
      const page = generator.buildContentPage(entries[0], entries)

      // Assert
      expect(page).toContain('[docs](https://example.com)')
      expect(page).toContain('[home](/get-started)')
      expect(page).toContain('[top](#intro)')
    })

    it('should leave unresolved relative links unchanged', () => {
      // Arrange
      const entries = [
        makeEntry(
          'overview',
          'get-started',
          'get-started/overview',
          'Overview',
          'See [missing](no-such-page) for details.',
        ),
      ]
      const generator = new LlmsTextGenerator(new PatternSourceStore(), ingressUrl)

      // Act
      const page = generator.buildContentPage(entries[0], entries)

      // Assert
      expect(page).toContain('[missing](no-such-page)')
    })
  })
})
