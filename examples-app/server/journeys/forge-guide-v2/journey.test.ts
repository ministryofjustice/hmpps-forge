import { join } from 'node:path'
import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { describe, expect, it } from 'vitest'
import GuideContentStore from '../../data/guideContentStore'
import { renderForgeDeveloperGuideMarkdown } from '../forge-developer-guide/components/forgeDeveloperGuideMarkdown'
import forgeGuideV2Package from '.'

const generatedPagePaths = [
  '/forge-guide-v2/patterns/branching',
  '/forge-guide-v2/patterns/add-another',
  '/forge-guide-v2/patterns/reveal-fields',
  '/forge-guide-v2/get-started/the-web-in-declarative-form',
  '/forge-guide-v2/get-started/what-is-forge',
  '/forge-guide-v2/get-started/installing-forge',
  '/forge-guide-v2/how-to-guides/testing-a-journey',
  '/forge-guide-v2/concepts/how-forge-runs-a-request',
  '/forge-guide-v2/concepts/how-forge-decides-where-users-can-go',
  '/forge-guide-v2/reference/session',
  '/forge-guide-v2/reference/literal',
]

function createClient() {
  const guideV2ContentStore = new GuideContentStore(join(__dirname, 'content'))

  return new ForgeTestHarness()
    .registerPackage(forgeGuideV2Package, { guideV2ContentStore })
    .createClient()
}

describe('forgeGuideV2Journey', () => {
  describe('onAccess', () => {
    it('should redirect the bare v2 root to the home step', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/forge-guide-v2', { session: {} })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toContain('home')
      }
    })
  })

  describe('generated steps', () => {
    it('should render a page generated from a markdown file with its title and body', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/forge-guide-v2/reference/session', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.title).toBe('Session()')
        expect(result.context.data.content).toContain('# `Session()`')
      }
    })

    it('should render every markdown file as its own generated step', async () => {
      // Arrange
      const client = createClient()

      // Act
      const results = await Promise.all(
        generatedPagePaths.map(path => client.get(path, { session: {} })),
      )

      // Assert
      results.forEach(result => {
        expect(result.type).toBe('render')
      })
    })

    it('should connect the journey reference example to its explanation', async () => {
      // Arrange
      const guideV2ContentStore = new GuideContentStore(join(__dirname, 'content'))
      await guideV2ContentStore.load()
      const markdown = guideV2ContentStore.getMarkdown('journey')

      if (!markdown) {
        throw new Error('Journey reference content was not loaded')
      }

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result.match(/app-code-step--1/g)).toHaveLength(3)
      expect(result.match(/app-code-step--2/g)).toHaveLength(2)
    })

    it('should connect the step reference example to its explanation', async () => {
      // Arrange
      const guideV2ContentStore = new GuideContentStore(join(__dirname, 'content'))
      await guideV2ContentStore.load()
      const markdown = guideV2ContentStore.getMarkdown('step')

      if (!markdown) {
        throw new Error('Step reference content was not loaded')
      }

      // Act
      const result = renderForgeDeveloperGuideMarkdown(markdown)

      // Assert
      expect(result.match(/app-code-step--1/g)).toHaveLength(3)
      expect(result.match(/app-code-step--2/g)).toHaveLength(4)
    })

    it('should stamp the section code as the step quadrant', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/forge-guide-v2/concepts/how-forge-runs-a-request', {
        session: {},
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.metadata).toMatchObject({ quadrant: 'concepts' })
      }
    })

    it('should resolve related slugs into linkable compass data for the template', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/forge-guide-v2/concepts/how-forge-runs-a-request', {
        session: {},
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.relatedPages).toEqual(
          expect.arrayContaining([
            {
              tag: 'Concept',
              quadrant: 'concepts',
              title: 'Returning a page, redirect, or error',
              href: '/forge-guide-v2/concepts/returning-a-page-redirect-or-error',
            },
            {
              tag: 'Concept',
              quadrant: 'concepts',
              title: 'How answers work',
              href: '/forge-guide-v2/concepts/how-answers-work',
            },
          ]),
        )
      }
    })

    it('should resolve a comma-separated related value into one compass row per slug', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/forge-guide-v2/reference/session', {
        session: {},
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.relatedPages).toEqual(
          expect.arrayContaining([
            {
              tag: 'Reference',
              quadrant: 'reference',
              title: 'Data()',
              href: '/forge-guide-v2/reference/data',
            },
            {
              tag: 'Reference',
              quadrant: 'reference',
              title: 'Answer()',
              href: '/forge-guide-v2/reference/answer',
            },
          ]),
        )
      }
    })

    it('should resolve next slugs into card data carrying the target page description', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/forge-guide-v2/concepts/how-forge-runs-a-request', {
        session: {},
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.nextPages).toEqual(
          expect.arrayContaining([
            {
              tag: 'Concept',
              quadrant: 'concepts',
              title: 'How Forge decides where users can go',
              href: '/forge-guide-v2/concepts/how-forge-decides-where-users-can-go',
              description:
                'How reachability uses entry points, redirects, validation, and request state to decide which steps are available',
            },
            {
              tag: 'How-to',
              quadrant: 'how-to-guides',
              title: 'Testing a journey',
              href: '/forge-guide-v2/how-to-guides/testing-a-journey',
              description: 'Exercise journeys in unit tests with the Forge test harness',
            },
          ]),
        )
      }
    })

    it('should carry the frontmatter related map through to the step metadata', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/forge-guide-v2/reference/session', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.metadata).toMatchObject({
          nav: 'Authoring API/References',
          related: {
            reference: 'data, answer',
            'how-to': 'creating-your-own-custom-effect',
          },
        })
      }
    })
  })

  describe('home', () => {
    it('should render the hand-authored home step alongside the generated steps', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/forge-guide-v2/home', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.title).toBe('Home')
        expect(result.context.data.content).toContain('Forge guide (v2)')
      }
    })
  })
})
