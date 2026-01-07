import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukSummaryList } from './govukSummaryList'

jest.mock('nunjucks')

describe('GOV.UK Summary List Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukSummaryList)

  describe('Row data transformation', () => {
    it('sets single row with text content correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
      })

      // Assert
      expect(params.rows).toHaveLength(1)
      expect(params.rows[0]).toEqual({
        key: { text: 'Name' },
        value: { text: 'John Smith' },
      })
    })

    it('sets multiple rows correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
          {
            key: { text: 'Date of birth' },
            value: { text: '5 January 1978' },
          },
          {
            key: { text: 'Contact number' },
            value: { text: '07700 900457' },
          },
        ],
      })

      // Assert
      expect(params.rows).toHaveLength(3)
      expect(params.rows[0].key.text).toBe('Name')
      expect(params.rows[0].value.text).toBe('John Smith')
      expect(params.rows[1].key.text).toBe('Date of birth')
      expect(params.rows[1].value.text).toBe('5 January 1978')
      expect(params.rows[2].key.text).toBe('Contact number')
      expect(params.rows[2].value.text).toBe('07700 900457')
    })

    it('sets rows with actions correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
            actions: {
              items: [
                {
                  href: '/change-name',
                  text: 'Change',
                  visuallyHiddenText: 'name',
                },
              ],
            },
          },
        ],
      })

      // Assert
      expect(params.rows[0].actions).toBeDefined()
      expect(params.rows[0].actions?.items).toHaveLength(1)
      expect(params.rows[0].actions?.items?.[0]).toEqual({
        href: '/change-name',
        text: 'Change',
        visuallyHiddenText: 'name',
      })
    })

    it('sets row with multiple actions correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
            actions: {
              items: [
                {
                  href: '/change-name',
                  text: 'Change',
                  visuallyHiddenText: 'name',
                },
                {
                  href: '/remove-name',
                  text: 'Remove',
                  visuallyHiddenText: 'name',
                },
              ],
            },
          },
        ],
      })

      // Assert
      expect(params.rows[0].actions?.items).toHaveLength(2)
      expect(params.rows[0].actions?.items?.[0].text).toBe('Change')
      expect(params.rows[0].actions?.items?.[1].text).toBe('Remove')
    })

    it('sets row classes correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
            classes: 'app-summary-list__row--custom',
          },
        ],
      })

      // Assert
      expect(params.rows[0].classes).toBe('app-summary-list__row--custom')
    })
  })

  describe('Key and value content', () => {
    it('sets key with text content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
      })

      // Assert
      expect(params.rows[0].key.text).toBe('Name')
      expect(params.rows[0].key.html).toBeUndefined()
    })

    it('sets key with html content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { html: '<strong>Name</strong>' },
            value: { text: 'John Smith' },
          },
        ],
      })

      // Assert
      expect(params.rows[0].key.html).toBe('<strong>Name</strong>')
      expect(params.rows[0].key.text).toBeUndefined()
    })

    it('sets value with text content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
      })

      // Assert
      expect(params.rows[0].value.text).toBe('John Smith')
      expect(params.rows[0].value.html).toBeUndefined()
    })

    it('sets value with html content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Address' },
            value: { html: '<span class="govuk-!-font-weight-bold">72 Guild Street</span><br>London<br>SE23 6FH' },
          },
        ],
      })

      // Assert
      expect(params.rows[0].value.html).toBe(
        '<span class="govuk-!-font-weight-bold">72 Guild Street</span><br>London<br>SE23 6FH',
      )
      expect(params.rows[0].value.text).toBeUndefined()
    })

    it('sets classes on key', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name', classes: 'app-summary-list__key--custom' },
            value: { text: 'John Smith' },
          },
        ],
      })

      // Assert
      expect(params.rows[0].key.classes).toBe('app-summary-list__key--custom')
    })

    it('sets classes on value', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith', classes: 'app-summary-list__value--custom' },
          },
        ],
      })

      // Assert
      expect(params.rows[0].value.classes).toBe('app-summary-list__value--custom')
    })
  })

  describe('Actions', () => {
    it('sets action with href and text', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
            actions: {
              items: [
                {
                  href: '/change-name',
                  text: 'Change',
                },
              ],
            },
          },
        ],
      })

      // Assert
      expect(params.rows[0].actions?.items?.[0]).toMatchObject({
        href: '/change-name',
        text: 'Change',
      })
    })

    it('sets action with html content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
            actions: {
              items: [
                {
                  href: '/change-name',
                  html: '<strong>Change</strong>',
                },
              ],
            },
          },
        ],
      })

      // Assert
      expect(params.rows[0].actions?.items?.[0].html).toBe('<strong>Change</strong>')
    })

    it('sets action with visuallyHiddenText', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
            actions: {
              items: [
                {
                  href: '/change-name',
                  text: 'Change',
                  visuallyHiddenText: 'name',
                },
              ],
            },
          },
        ],
      })

      // Assert
      expect(params.rows[0].actions?.items?.[0].visuallyHiddenText).toBe('name')
    })

    it('sets action with classes and attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
            actions: {
              items: [
                {
                  href: '/change-name',
                  text: 'Change',
                  classes: 'app-action--custom',
                  attributes: {
                    'data-module': 'action-link',
                  },
                },
              ],
            },
          },
        ],
      })

      // Assert
      expect(params.rows[0].actions?.items?.[0].classes).toBe('app-action--custom')
      expect(params.rows[0].actions?.items?.[0].attributes).toEqual({
        'data-module': 'action-link',
      })
    })

    it('sets actions wrapper classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
            actions: {
              items: [
                {
                  href: '/change-name',
                  text: 'Change',
                },
              ],
              classes: 'app-summary-list__actions--custom',
            },
          },
        ],
      })

      // Assert
      expect(params.rows[0].actions?.classes).toBe('app-summary-list__actions--custom')
    })
  })

  describe('Summary card wrapper', () => {
    it('sets card with text title', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        card: {
          title: {
            text: 'Personal details',
          },
        },
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
      })

      // Assert
      expect(params.card).toBeDefined()
      expect(params.card?.title?.text).toBe('Personal details')
      expect(params.card?.title?.html).toBeUndefined()
    })

    it('sets card with html title', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        card: {
          title: {
            html: '<strong>Personal</strong> details',
          },
        },
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
      })

      // Assert
      expect(params.card?.title?.html).toBe('<strong>Personal</strong> details')
      expect(params.card?.title?.text).toBeUndefined()
    })

    it('sets card title with heading level', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        card: {
          title: {
            text: 'University 1',
            headingLevel: 3,
          },
        },
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
      })

      // Assert
      expect(params.card?.title?.headingLevel).toBe(3)
    })

    it('sets card title with classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        card: {
          title: {
            text: 'Personal details',
            classes: 'app-card__title--custom',
          },
        },
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
      })

      // Assert
      expect(params.card?.title?.classes).toBe('app-card__title--custom')
    })

    it('sets card with actions', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        card: {
          title: {
            text: 'Personal details',
          },
          actions: {
            items: [
              {
                href: '/delete-section',
                text: 'Delete',
                visuallyHiddenText: 'personal details',
              },
            ],
          },
        },
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
      })

      // Assert
      expect(params.card?.actions).toBeDefined()
      expect(params.card?.actions?.items).toHaveLength(1)
      expect(params.card?.actions?.items?.[0]).toEqual({
        href: '/delete-section',
        text: 'Delete',
        visuallyHiddenText: 'personal details',
      })
    })

    it('sets card with classes and attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        card: {
          title: {
            text: 'Personal details',
          },
          classes: 'app-summary-card--custom',
          attributes: {
            'data-module': 'card',
          },
        },
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
      })

      // Assert
      expect(params.card?.classes).toBe('app-summary-card--custom')
      expect(params.card?.attributes).toEqual({
        'data-module': 'card',
      })
    })

    it('sets complete card with all options', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        card: {
          title: {
            text: 'University 1',
            headingLevel: 3,
            classes: 'app-card__title',
          },
          actions: {
            items: [
              {
                href: '/delete',
                text: 'Delete',
                visuallyHiddenText: 'university 1',
              },
            ],
            classes: 'app-card__actions',
          },
          classes: 'app-summary-card',
          attributes: {
            'data-section': 'education',
          },
        },
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'University of Bristol' },
          },
        ],
      })

      // Assert
      expect(params.card?.title?.text).toBe('University 1')
      expect(params.card?.title?.headingLevel).toBe(3)
      expect(params.card?.title?.classes).toBe('app-card__title')
      expect(params.card?.actions?.items?.[0].text).toBe('Delete')
      expect(params.card?.actions?.classes).toBe('app-card__actions')
      expect(params.card?.classes).toBe('app-summary-card')
      expect(params.card?.attributes).toEqual({
        'data-section': 'education',
      })
    })
  })

  describe('Optional attributes', () => {
    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
        classes: 'govuk-summary-list--no-border',
      })

      // Assert
      expect(params.classes).toBe('govuk-summary-list--no-border')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
        attributes: {
          'data-module': 'summary-list',
          'data-track': 'answers-shown',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'summary-list',
        'data-track': 'answers-shown',
      })
    })

    it('handles all options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        rows: [
          {
            key: { text: 'Name', classes: 'key-class' },
            value: { html: '<strong>John Smith</strong>', classes: 'value-class' },
            actions: {
              items: [
                {
                  href: '/change',
                  text: 'Change',
                  visuallyHiddenText: 'name',
                  classes: 'action-class',
                },
              ],
              classes: 'actions-class',
            },
            classes: 'row-class',
          },
        ],
        card: {
          title: {
            text: 'Section 1',
            headingLevel: 2,
            classes: 'title-class',
          },
          actions: {
            items: [
              {
                href: '/delete',
                text: 'Delete',
              },
            ],
          },
          classes: 'card-class',
          attributes: {
            'data-card': 'true',
          },
        },
        classes: 'list-class',
        attributes: {
          'data-list': 'true',
        },
      })

      // Assert
      expect(params.rows[0].key.classes).toBe('key-class')
      expect(params.rows[0].value.classes).toBe('value-class')
      expect(params.rows[0].actions?.items?.[0].classes).toBe('action-class')
      expect(params.rows[0].actions?.classes).toBe('actions-class')
      expect(params.rows[0].classes).toBe('row-class')
      expect(params.card?.title?.classes).toBe('title-class')
      expect(params.card?.classes).toBe('card-class')
      expect(params.card?.attributes).toEqual({ 'data-card': 'true' })
      expect(params.classes).toBe('list-class')
      expect(params.attributes).toEqual({ 'data-list': 'true' })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
      })

      // Assert
      expect(template).toBe('govuk/components/summary-list/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
        classes: 'govuk-summary-list--no-border',
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params.rows).toHaveLength(1)
      expect(context.params.rows[0].key.text).toBe('Name')
      expect(context.params.classes).toBe('govuk-summary-list--no-border')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders summary list with basic rows', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
          {
            key: { text: 'Date of birth' },
            value: { text: '5 January 1978' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-summary-list')
      expect(html).toContain('Name')
      expect(html).toContain('John Smith')
      expect(html).toContain('Date of birth')
      expect(html).toContain('5 January 1978')
    })

    it('renders summary list with actions', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
            actions: {
              items: [
                {
                  href: '/change-name',
                  text: 'Change',
                  visuallyHiddenText: 'name',
                },
              ],
            },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-summary-list')
      expect(html).toContain('Name')
      expect(html).toContain('John Smith')
      expect(html).toContain('/change-name')
      expect(html).toContain('Change')
    })

    it('renders summary list with HTML content', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        rows: [
          {
            key: { html: '<strong>Address</strong>' },
            value: { html: '72 Guild Street<br>London<br>SE23 6FH' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-summary-list')
      expect(html).toContain('<strong>Address</strong>')
      expect(html).toContain('72 Guild Street')
      expect(html).toContain('London')
    })

    it('renders summary list with card wrapper', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        card: {
          title: {
            text: 'Personal details',
          },
        },
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
          {
            key: { text: 'Email' },
            value: { text: 'john.smith@example.com' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-summary-card')
      expect(html).toContain('Personal details')
      expect(html).toContain('govuk-summary-list')
      expect(html).toContain('Name')
      expect(html).toContain('john.smith@example.com')
    })

    it('renders summary list with card actions', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        card: {
          title: {
            text: 'University 1',
            headingLevel: 3,
          },
          actions: {
            items: [
              {
                href: '/delete-university',
                text: 'Delete',
                visuallyHiddenText: 'university 1',
              },
            ],
          },
        },
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'University of Bristol' },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-summary-card')
      expect(html).toContain('University 1')
      expect(html).toContain('/delete-university')
      expect(html).toContain('Delete')
      expect(html).toContain('University of Bristol')
    })

    it('renders summary list with no border class', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        rows: [
          {
            key: { text: 'Name' },
            value: { text: 'John Smith' },
          },
        ],
        classes: 'govuk-summary-list--no-border',
      })

      // Assert
      expect(html).toContain('govuk-summary-list')
      expect(html).toContain('govuk-summary-list--no-border')
    })
  })
})
