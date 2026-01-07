import { GovukComponentTestHelper } from '@form-engine-govuk-components/test-utils/GovukComponentTestHelper'
import { setupComponentTest } from '@form-engine-govuk-components/test-utils/setupComponentTest'
import { govukTaskList } from './govukTaskList'

jest.mock('nunjucks')

describe('GOV.UK Task List Component', () => {
  setupComponentTest()

  const helper = new GovukComponentTestHelper(govukTaskList)

  describe('Item data transformation', () => {
    it('sets single item with title and status correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information' },
            status: {
              tag: { text: 'Completed' },
            },
          },
        ],
      })

      // Assert
      expect(params.items).toHaveLength(1)
      expect(params.items[0]).toEqual({
        title: { text: 'Company information' },
        status: {
          tag: { text: 'Completed' },
        },
      })
    })

    it('sets item with href correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information' },
            href: '/company-info',
            status: {
              tag: { text: 'Completed' },
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].href).toBe('/company-info')
    })

    it('sets multiple items correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information' },
            href: '/company-info',
            status: {
              tag: { text: 'Completed', classes: 'govuk-tag--blue' },
            },
          },
          {
            title: { text: 'Contact details' },
            href: '/contact-details',
            status: {
              tag: { text: 'In progress', classes: 'govuk-tag--light-blue' },
            },
          },
          {
            title: { text: 'Submit application' },
            status: {
              text: 'Cannot start yet',
            },
          },
        ],
      })

      // Assert
      expect(params.items).toHaveLength(3)
      expect(params.items[0].title.text).toBe('Company information')
      expect(params.items[0].href).toBe('/company-info')
      expect(params.items[1].title.text).toBe('Contact details')
      expect(params.items[1].href).toBe('/contact-details')
      expect(params.items[2].title.text).toBe('Submit application')
      expect(params.items[2].href).toBeUndefined()
    })

    it('sets item classes correctly', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information' },
            status: { tag: { text: 'Completed' } },
            classes: 'app-task-list__item--custom',
          },
        ],
      })

      // Assert
      expect(params.items[0].classes).toBe('app-task-list__item--custom')
    })
  })

  describe('Title options', () => {
    it('sets title with text content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information' },
            status: { tag: { text: 'Completed' } },
          },
        ],
      })

      // Assert
      expect(params.items[0].title.text).toBe('Company information')
      expect(params.items[0].title.html).toBeUndefined()
    })

    it('sets title with html content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { html: '<strong>Company</strong> information' },
            status: { tag: { text: 'Completed' } },
          },
        ],
      })

      // Assert
      expect(params.items[0].title.html).toBe('<strong>Company</strong> information')
      expect(params.items[0].title.text).toBeUndefined()
    })

    it('sets title with classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information', classes: 'app-task-list__title--custom' },
            status: { tag: { text: 'Completed' } },
          },
        ],
      })

      // Assert
      expect(params.items[0].title.classes).toBe('app-task-list__title--custom')
    })
  })

  describe('Hint', () => {
    it('sets hint with text content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Contact details' },
            hint: { text: 'Include email and phone number' },
            status: { tag: { text: 'In progress' } },
          },
        ],
      })

      // Assert
      expect(params.items[0].hint).toBeDefined()
      expect(params.items[0].hint?.text).toBe('Include email and phone number')
      expect(params.items[0].hint?.html).toBeUndefined()
    })

    it('sets hint with html content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Contact details' },
            hint: { html: 'Include <strong>email</strong> and phone number' },
            status: { tag: { text: 'In progress' } },
          },
        ],
      })

      // Assert
      expect(params.items[0].hint?.html).toBe('Include <strong>email</strong> and phone number')
      expect(params.items[0].hint?.text).toBeUndefined()
    })

    it('handles item without hint', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information' },
            status: { tag: { text: 'Completed' } },
          },
        ],
      })

      // Assert
      expect(params.items[0].hint).toBeUndefined()
    })
  })

  describe('Status', () => {
    it('sets status with tag', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information' },
            status: {
              tag: { text: 'Completed' },
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].status.tag).toBeDefined()
      expect(params.items[0].status.tag?.text).toBe('Completed')
    })

    it('sets status tag with html content', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information' },
            status: {
              tag: { html: '<strong>Completed</strong>' },
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].status.tag?.html).toBe('<strong>Completed</strong>')
      expect(params.items[0].status.tag?.text).toBeUndefined()
    })

    it('sets status tag with classes for blue color', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information' },
            status: {
              tag: { text: 'Completed', classes: 'govuk-tag--blue' },
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].status.tag?.classes).toBe('govuk-tag--blue')
    })

    it('sets status tag with classes for light blue color', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Contact details' },
            status: {
              tag: { text: 'In progress', classes: 'govuk-tag--light-blue' },
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].status.tag?.classes).toBe('govuk-tag--light-blue')
    })

    it('sets status tag with classes for grey color', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Payment details' },
            status: {
              tag: { text: 'Not started', classes: 'govuk-tag--grey' },
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].status.tag?.classes).toBe('govuk-tag--grey')
    })

    it('sets status tag with attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information' },
            status: {
              tag: {
                text: 'Completed',
                attributes: {
                  'data-status': 'complete',
                },
              },
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].status.tag?.attributes).toEqual({
        'data-status': 'complete',
      })
    })

    it('sets status with text only', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Submit application' },
            status: {
              text: 'Cannot start yet',
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].status.text).toBe('Cannot start yet')
      expect(params.items[0].status.tag).toBeUndefined()
      expect(params.items[0].status.html).toBeUndefined()
    })

    it('sets status with html only', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Submit application' },
            status: {
              html: '<span class="app-status">Cannot start yet</span>',
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].status.html).toBe('<span class="app-status">Cannot start yet</span>')
      expect(params.items[0].status.tag).toBeUndefined()
      expect(params.items[0].status.text).toBeUndefined()
    })

    it('sets status with classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Submit application' },
            status: {
              text: 'Cannot start yet',
              classes: 'app-task-list__status--custom',
            },
          },
        ],
      })

      // Assert
      expect(params.items[0].status.classes).toBe('app-task-list__status--custom')
    })
  })

  describe('Optional attributes', () => {
    it('passes through idPrefix', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        idPrefix: 'registration',
        items: [
          {
            title: { text: 'Company information' },
            status: { tag: { text: 'Completed' } },
          },
        ],
      })

      // Assert
      expect(params.idPrefix).toBe('registration')
    })

    it('passes through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information' },
            status: { tag: { text: 'Completed' } },
          },
        ],
        classes: 'app-task-list--custom',
      })

      // Assert
      expect(params.classes).toBe('app-task-list--custom')
    })

    it('passes through attributes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        items: [
          {
            title: { text: 'Company information' },
            status: { tag: { text: 'Completed' } },
          },
        ],
        attributes: {
          'data-module': 'task-list',
          'data-track': 'tasks-shown',
        },
      })

      // Assert
      expect(params.attributes).toEqual({
        'data-module': 'task-list',
        'data-track': 'tasks-shown',
      })
    })

    it('handles all options together', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        idPrefix: 'application',
        items: [
          {
            title: { text: 'Company information', classes: 'title-class' },
            hint: { text: 'Provide your company details' },
            href: '/company-info',
            status: {
              tag: {
                text: 'Completed',
                classes: 'govuk-tag--blue',
                attributes: { 'data-status': 'complete' },
              },
              classes: 'status-class',
            },
            classes: 'item-class',
          },
        ],
        classes: 'list-class',
        attributes: {
          'data-list': 'true',
        },
      })

      // Assert
      expect(params.idPrefix).toBe('application')
      expect(params.items[0].title.classes).toBe('title-class')
      expect(params.items[0].hint?.text).toBe('Provide your company details')
      expect(params.items[0].href).toBe('/company-info')
      expect(params.items[0].status.tag?.text).toBe('Completed')
      expect(params.items[0].status.tag?.classes).toBe('govuk-tag--blue')
      expect(params.items[0].status.tag?.attributes).toEqual({ 'data-status': 'complete' })
      expect(params.items[0].status.classes).toBe('status-class')
      expect(params.items[0].classes).toBe('item-class')
      expect(params.classes).toBe('list-class')
      expect(params.attributes).toEqual({ 'data-list': 'true' })
    })
  })

  describe('Template and context', () => {
    it('calls nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        items: [
          {
            title: { text: 'Company information' },
            status: { tag: { text: 'Completed' } },
          },
        ],
      })

      // Assert
      expect(template).toBe('govuk/components/task-list/template.njk')
    })

    it('wraps params in correct context structure', async () => {
      // Arrange & Act
      const { context } = (await helper.executeComponent({
        items: [
          {
            title: { text: 'Company information' },
            href: '/company-info',
            status: {
              tag: { text: 'Completed', classes: 'govuk-tag--blue' },
            },
          },
        ],
        classes: 'app-task-list--custom',
      })) as { context: { params: any } }

      // Assert
      expect(context).toHaveProperty('params')
      expect(context.params.items).toHaveLength(1)
      expect(context.params.items[0].title.text).toBe('Company information')
      expect(context.params.classes).toBe('app-task-list--custom')
    })
  })

  describe('DOM rendering smoke test', () => {
    it('renders task list with basic items', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [
          {
            title: { text: 'Company information' },
            href: '/company-info',
            status: {
              tag: { text: 'Completed', classes: 'govuk-tag--blue' },
            },
          },
          {
            title: { text: 'Contact details' },
            href: '/contact-details',
            status: {
              tag: { text: 'In progress', classes: 'govuk-tag--light-blue' },
            },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-task-list')
      expect(html).toContain('Company information')
      expect(html).toContain('/company-info')
      expect(html).toContain('Completed')
      expect(html).toContain('Contact details')
      expect(html).toContain('/contact-details')
      expect(html).toContain('In progress')
    })

    it('renders task list with hints', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [
          {
            title: { text: 'Contact details' },
            hint: { text: 'Include email and phone number' },
            href: '/contact-details',
            status: {
              tag: { text: 'In progress' },
            },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-task-list')
      expect(html).toContain('Contact details')
      expect(html).toContain('Include email and phone number')
    })

    it('renders task list with text-only status', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [
          {
            title: { text: 'Submit application' },
            status: {
              text: 'Cannot start yet',
            },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-task-list')
      expect(html).toContain('Submit application')
      expect(html).toContain('Cannot start yet')
    })

    it('renders task list with item without href', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [
          {
            title: { text: 'Submit application' },
            status: {
              text: 'Cannot start yet',
            },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-task-list')
      expect(html).toContain('Submit application')
      expect(html).not.toContain('href')
    })

    it('renders task list with HTML content', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [
          {
            title: { html: '<strong>Company</strong> information' },
            hint: { html: 'Provide <em>all</em> details' },
            href: '/company-info',
            status: {
              tag: { html: '<strong>Completed</strong>' },
            },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-task-list')
      expect(html).toContain('<strong>Company</strong> information')
      expect(html).toContain('<em>all</em> details')
      expect(html).toContain('<strong>Completed</strong>')
    })

    it('renders task list with custom classes', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [
          {
            title: { text: 'Company information' },
            status: { tag: { text: 'Completed' } },
          },
        ],
        classes: 'app-task-list--custom',
      })

      // Assert
      expect(html).toContain('govuk-task-list')
      expect(html).toContain('app-task-list--custom')
    })

    it('renders task list with custom idPrefix', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        idPrefix: 'registration',
        items: [
          {
            title: { text: 'Personal details' },
            status: { tag: { text: 'Completed' } },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-task-list')
      expect(html).toContain('registration')
    })

    it('renders task list with colored tags', async () => {
      // Arrange & Act
      const html = await helper.renderWithNunjucks({
        items: [
          {
            title: { text: 'Task 1' },
            status: {
              tag: { text: 'Completed', classes: 'govuk-tag--blue' },
            },
          },
          {
            title: { text: 'Task 2' },
            status: {
              tag: { text: 'In progress', classes: 'govuk-tag--light-blue' },
            },
          },
          {
            title: { text: 'Task 3' },
            status: {
              tag: { text: 'Not started', classes: 'govuk-tag--grey' },
            },
          },
        ],
      })

      // Assert
      expect(html).toContain('govuk-task-list')
      expect(html).toContain('govuk-tag--blue')
      expect(html).toContain('govuk-tag--light-blue')
      expect(html).toContain('govuk-tag--grey')
    })
  })
})
