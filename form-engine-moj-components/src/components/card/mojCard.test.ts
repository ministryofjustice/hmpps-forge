import { MojComponentTestHelper } from '@form-engine-moj-components/test-utils/MojComponentTestHelper'
import { setupComponentTest } from '@form-engine-moj-components/test-utils/setupComponentTest'
import { mojCard } from './mojCard'

jest.mock('nunjucks')

describe('mojCard', () => {
  setupComponentTest()

  const helper = new MojComponentTestHelper(mojCard)

  describe('Heading transformation', () => {
    it('should convert string heading to object format', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        heading: 'Search cases',
        href: '/cases/search',
      })

      // Assert
      expect(params.heading).toEqual({ text: 'Search cases' })
    })

    it('should pass through object heading unchanged', async () => {
      // Arrange
      const headingObj = {
        text: 'Search cases',
        level: 3,
        classes: 'custom-heading',
      }

      // Act
      const params = await helper.getParams({
        heading: headingObj,
        href: '/cases/search',
      })

      // Assert
      expect(params.heading).toEqual(headingObj)
    })

    it('should pass through heading with HTML', async () => {
      // Arrange
      const headingObj = {
        html: '<span>Search</span> cases',
      }

      // Act
      const params = await helper.getParams({
        heading: headingObj,
        href: '/cases/search',
      })

      // Assert
      expect(params.heading).toEqual(headingObj)
    })

    it('should pass through heading with custom level', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        heading: { text: 'Search cases', level: 4 },
        href: '/cases/search',
      })

      // Assert
      expect(params.heading).toEqual({ text: 'Search cases', level: 4 })
    })
  })

  describe('Href transformation', () => {
    it('should pass through href unchanged', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        heading: 'Search cases',
        href: '/cases/search',
      })

      // Assert
      expect(params.href).toBe('/cases/search')
    })

    it('should handle external URLs', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        heading: 'External link',
        href: 'https://example.com/page',
      })

      // Assert
      expect(params.href).toBe('https://example.com/page')
    })
  })

  describe('Description transformation', () => {
    it('should convert string description to object format', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        heading: 'Search cases',
        href: '/cases/search',
        description: 'Find and manage case records',
      })

      // Assert
      expect(params.description).toEqual({ text: 'Find and manage case records' })
    })

    it('should pass through object description unchanged', async () => {
      // Arrange
      const descriptionObj = {
        text: 'Find and manage case records',
        classes: 'custom-description',
      }

      // Act
      const params = await helper.getParams({
        heading: 'Search cases',
        href: '/cases/search',
        description: descriptionObj,
      })

      // Assert
      expect(params.description).toEqual(descriptionObj)
    })

    it('should pass through description with HTML', async () => {
      // Arrange
      const descriptionObj = {
        html: '<strong>Find</strong> and manage case records',
      }

      // Act
      const params = await helper.getParams({
        heading: 'Search cases',
        href: '/cases/search',
        description: descriptionObj,
      })

      // Assert
      expect(params.description).toEqual(descriptionObj)
    })

    it('should set description to undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        heading: 'Search cases',
        href: '/cases/search',
      })

      // Assert
      expect(params.description).toBeUndefined()
    })
  })

  describe('Clickable transformation', () => {
    it('should pass through clickable true', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        heading: 'Search cases',
        href: '/cases/search',
        clickable: true,
      })

      // Assert
      expect(params.clickable).toBe(true)
    })

    it('should pass through clickable false', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        heading: 'Search cases',
        href: '/cases/search',
        clickable: false,
      })

      // Assert
      expect(params.clickable).toBe(false)
    })

    it('should leave clickable undefined when not provided', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        heading: 'Search cases',
        href: '/cases/search',
      })

      // Assert
      expect(params.clickable).toBeUndefined()
    })
  })

  describe('Additional options', () => {
    it('should pass through classes', async () => {
      // Arrange & Act
      const params = await helper.getParams({
        heading: 'Search cases',
        href: '/cases/search',
        classes: 'custom-card-class',
      })

      // Assert
      expect(params.classes).toBe('custom-card-class')
    })

    it('should pass through attributes', async () => {
      // Arrange
      const attributes = {
        'data-testid': 'search-card',
        'aria-label': 'Search cases card',
      }

      // Act
      const params = await helper.getParams({
        heading: 'Search cases',
        href: '/cases/search',
        attributes,
      })

      // Assert
      expect(params.attributes).toEqual(attributes)
    })
  })

  describe('Template and context', () => {
    it('should call nunjucks with correct template path', async () => {
      // Arrange & Act
      const { template } = await helper.executeComponent({
        heading: 'Search cases',
        href: '/cases/search',
      })

      // Assert
      expect(template).toBe('components/card/template.njk')
    })

    it('should wrap params in context object', async () => {
      // Arrange & Act
      const { context } = await helper.executeComponent({
        heading: 'Search cases',
        href: '/cases/search',
      })

      // Assert
      expect(context).toHaveProperty('params')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('heading')
      expect((context as { params: Record<string, any> }).params).toHaveProperty('href')
    })
  })
})
