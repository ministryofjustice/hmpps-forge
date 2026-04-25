import { expect, test } from '@playwright/test'
import ForgeFormHelper from '../pages/forgeFormHelper'

const basePath = '/forge-developer-guide/patterns/demos/cms-content'

test.describe('CMS content journey', () => {
  let form: ForgeFormHelper

  test.beforeEach(async ({ page }) => {
    form = new ForgeFormHelper(page)
  })

  test.describe('posts page', () => {
    test('should show the posts heading', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/posts`)

      // Assert
      await form.expectHeading('Blog posts')
    })

    test('should show empty state when no posts exist', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/posts`)

      // Assert
      await form.expectInsetText('No posts yet')
    })

    test('should show a button to write a new post', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/posts`)

      // Assert
      await expect(page.getByRole('button', { name: 'Write a new post' })).toBeVisible()
    })
  })

  test.describe('write page', () => {
    test('should show the write heading', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/write`)

      // Assert
      await form.expectHeading('Write a post')
    })

    test('should show the rich text editor', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/write`)

      // Assert
      await expect(page.locator('.moj-rich-text-editor__content')).toBeVisible()
    })

    test('should show validation errors when submitting empty form', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/write`)

      // Act
      await form.clickButton('Publish post')

      // Assert
      await form.expectValidationError('Enter a title')
      await form.expectValidationError('Enter some content')
    })

    test('should show validation error for missing title only', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/write`)
      await page.locator('.moj-rich-text-editor__content').fill('Some content')

      // Act
      await form.clickButton('Publish post')

      // Assert
      await form.expectValidationError('Enter a title')
    })

    test('should show validation error for missing content only', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/write`)
      await form.fillTextInput('Title', 'My post')

      // Act
      await form.clickButton('Publish post')

      // Assert
      await form.expectValidationError('Enter some content')
    })
  })

  test.describe('publishing a post', () => {
    test('should redirect to posts page after publishing', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/write`)
      await form.fillTextInput('Title', 'Test post')
      await page.locator('.moj-rich-text-editor__content').fill('Hello world')

      // Act
      await form.clickButton('Publish post')

      // Assert
      await form.expectHeading('Blog posts')
      await form.expectUrl(`${basePath}/posts`)
    })

    test('should display the published post on the posts page', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/write`)
      await form.fillTextInput('Title', 'My first post')
      await page.locator('.moj-rich-text-editor__content').fill('This is the body of my post')

      // Act
      await form.clickButton('Publish post')

      // Assert
      await expect(page.locator('article')).toBeVisible()
      await expect(page.getByRole('heading', { name: 'My first post' })).toBeVisible()
      await expect(page.locator('article')).toContainText('This is the body of my post')
    })

    test('should show post count after publishing', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/write`)
      await form.fillTextInput('Title', 'Counted post')
      await page.locator('.moj-rich-text-editor__content').fill('Content here')

      // Act
      await form.clickButton('Publish post')

      // Assert
      await expect(page.locator('p.govuk-body', { hasText: 'posts published' })).toBeVisible()
    })

    test('should no longer show the empty state after publishing', async ({ page }) => {
      // Arrange
      await page.goto(`${basePath}/write`)
      await form.fillTextInput('Title', 'A post')
      await page.locator('.moj-rich-text-editor__content').fill('Some content')

      // Act
      await form.clickButton('Publish post')

      // Assert
      await expect(page.locator('.govuk-inset-text')).not.toBeVisible()
    })

    test('should display multiple posts in order', async ({ page }) => {
      // Arrange — publish first post
      await page.goto(`${basePath}/write`)
      await form.fillTextInput('Title', 'First post')
      await page.locator('.moj-rich-text-editor__content').fill('First body')
      await form.clickButton('Publish post')

      // Act — publish second post
      await form.clickButton('Write a new post')
      await form.fillTextInput('Title', 'Second post')
      await page.locator('.moj-rich-text-editor__content').fill('Second body')
      await form.clickButton('Publish post')

      // Assert — newest post first
      const articles = page.locator('article')
      await expect(articles).toHaveCount(2)
      await expect(articles.first()).toContainText('Second post')
      await expect(articles.last()).toContainText('First post')
    })
  })
})
