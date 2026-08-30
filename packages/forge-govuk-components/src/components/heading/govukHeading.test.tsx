
import { ComponentTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { GovUKHeading } from './govukHeading'

const harness = new ComponentTestHarness(GovUKHeading)

const render = (props: GovUKHeading) => harness.render(GovUKHeading(props))

describe('GovUKHeading', () => {
  describe('block building', () => {
    it('should stamp the govukHeading variant when called as a builder', async () => {
      // Arrange & Act
      const built = GovUKHeading({ text: 'Page title' })

      // Assert
      expect(built.variant).toBe('govukHeading')
    })
  })

  describe('rendering', () => {
    it('should render an h1 with the large heading class by default', async () => {
      // Arrange & Act
      const output = await render({ text: 'Page title' })

      // Assert
      expect(output).toBe('<h1 class="govuk-heading-l">Page title</h1>')
    })

    it('should default the level from the size', async () => {
      // Arrange & Act
      const medium = await render({ text: 'Section', size: 'm' })
      const small = await render({ text: 'Subsection', size: 's' })
      const extraLarge = await render({ text: 'Page', size: 'xl' })

      // Assert
      expect(medium).toBe('<h2 class="govuk-heading-m">Section</h2>')
      expect(small).toBe('<h3 class="govuk-heading-s">Subsection</h3>')
      expect(extraLarge).toBe('<h1 class="govuk-heading-xl">Page</h1>')
    })

    it('should let an explicit level override the size default', async () => {
      // Arrange & Act
      const output = await render({ text: 'Goal', size: 'm', level: 4 })

      // Assert
      expect(output).toBe('<h4 class="govuk-heading-m">Goal</h4>')
    })

    it('should render a caption above the heading text matched to the size', async () => {
      // Arrange & Act
      const output = await render({ text: 'Page title', size: 'xl', caption: 'Section name' })

      // Assert
      expect(output).toBe(
        '<h1 class="govuk-heading-xl"><span class="govuk-caption-xl">Section name</span>Page title</h1>',
      )
    })

    it('should append additional classes and attributes', async () => {
      // Arrange & Act
      const output = await render({ text: 'Title', classes: 'app-title', attributes: { id: 'main-title' } })

      // Assert
      expect(output).toBe('<h1 class="govuk-heading-l app-title" id="main-title">Title</h1>')
    })

    it('should render HTML in the text and caption unescaped', async () => {
      // Arrange & Act
      const output = await render({ text: 'Goal: <strong>saving</strong>', caption: '<abbr title="Sentence Plan">SP</abbr>' })

      // Assert
      expect(output).toBe(
        '<h1 class="govuk-heading-l"><span class="govuk-caption-l"><abbr title="Sentence Plan">SP</abbr></span>Goal: <strong>saving</strong></h1>',
      )
    })
  })
})
