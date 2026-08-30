import { component } from '../../components/presentation'
import { ComponentTestHarness } from '../../testing/components/ComponentTestHarness'
import { CollectionBlock } from './collectionBlock'

const TestBlock = component<{ html: string }>('testBlock', {
  factory:
    () =>
    ({ props }) =>
      props.html,
})

const harness = new ComponentTestHarness([CollectionBlock, TestBlock])

const testBlock = (html: string) => TestBlock({ html })

describe('collectionBlock component', () => {
  it('should render collection when it has items', async () => {
    // Arrange
    const block = CollectionBlock({
      collection: [testBlock('<div>Item 1</div>'), testBlock('<div>Item 2</div>'), testBlock('<div>Item 3</div>')],
    })

    // Act
    const result = await harness.render(block)

    // Assert
    expect(result).toBe('<div>Item 1</div><div>Item 2</div><div>Item 3</div>')
  })

  it('should render empty string when collection is empty', async () => {
    // Arrange
    const block = CollectionBlock({ collection: [] })

    // Act
    const result = await harness.render(block)

    // Assert
    expect(result).toBe('')
  })

  it('should render with wrapper div when classes are provided', async () => {
    // Arrange
    const block = CollectionBlock({
      collection: [testBlock('<div>Item 1</div>'), testBlock('<div>Item 2</div>')],
      classes: 'collection-wrapper custom-class',
    })

    // Act
    const result = await harness.render(block)

    // Assert
    expect(result).toBe('<div class="collection-wrapper custom-class"><div>Item 1</div><div>Item 2</div></div>')
  })

  it('should render with wrapper div when attributes are provided', async () => {
    // Arrange
    const block = CollectionBlock({
      collection: [testBlock('<div>Item 1</div>')],
      attributes: {
        'data-collection': 'items',
        id: 'item-list',
      },
    })

    // Act
    const result = await harness.render(block)

    // Assert
    expect(result).toBe('<div data-collection="items" id="item-list"><div>Item 1</div></div>')
  })

  it('should render with wrapper div when both classes and attributes are provided', async () => {
    // Arrange
    const block = CollectionBlock({
      collection: [testBlock('<div>Item 1</div>'), testBlock('<div>Item 2</div>')],
      classes: 'styled-collection',
      attributes: {
        'data-count': '2',
        role: 'list',
      },
    })

    // Act
    const result = await harness.render(block)

    // Assert
    expect(result).toBe(
      '<div class="styled-collection" data-count="2" role="list"><div>Item 1</div><div>Item 2</div></div>',
    )
  })

  it('should render with specified tag instead of div', async () => {
    // Arrange
    const block = CollectionBlock({
      collection: [testBlock('<li>Item 1</li>'), testBlock('<li>Item 2</li>')],
      tag: 'ul',
      classes: 'govuk-list',
    })

    // Act
    const result = await harness.render(block)

    // Assert
    expect(result).toBe('<ul class="govuk-list"><li>Item 1</li><li>Item 2</li></ul>')
  })

  it('should render with tag even without classes or attributes', async () => {
    // Arrange
    const block = CollectionBlock({
      collection: [testBlock('<li>Item 1</li>')],
      tag: 'ol',
    })

    // Act
    const result = await harness.render(block)

    // Assert
    expect(result).toBe('<ol><li>Item 1</li></ol>')
  })

  it('should render empty wrapper when classes provided and collection is empty', async () => {
    // Arrange
    const block = CollectionBlock({
      collection: [],
      classes: 'empty-collection',
    })

    // Act
    const result = await harness.render(block)

    // Assert
    expect(result).toBe('<div class="empty-collection"></div>')
  })

  it('should handle complex nested HTML in collection', async () => {
    // Arrange
    const firstHtml = '<div class="card"><h3>Title 1</h3></div>'
    const secondHtml = '<div class="card"><h3>Title 2</h3></div>'
    const block = CollectionBlock({ collection: [testBlock(firstHtml), testBlock(secondHtml)] })

    // Act
    const result = await harness.render(block)

    // Assert
    expect(result).toBe(`${firstHtml}${secondHtml}`)
  })

  it('should have the correct variant', () => {
    // Assert
    expect(CollectionBlock.variant).toBe('collection-block')
  })

  it('should render fallback when collection is empty', async () => {
    // Arrange
    const block = CollectionBlock({
      collection: [],
      fallback: [testBlock('<p>No items found</p>')],
    })

    // Act
    const result = await harness.render(block)

    // Assert
    expect(result).toBe('<p>No items found</p>')
  })

  it('should render collection items instead of fallback when collection has items', async () => {
    // Arrange
    const block = CollectionBlock({
      collection: [testBlock('<div>Item 1</div>')],
      fallback: [testBlock('<p>No items found</p>')],
    })

    // Act
    const result = await harness.render(block)

    // Assert
    expect(result).toBe('<div>Item 1</div>')
  })

  it('should render fallback with wrapper div when classes are provided', async () => {
    // Arrange
    const block = CollectionBlock({
      collection: [],
      fallback: [testBlock('<p>Empty state</p>')],
      classes: 'empty-collection',
    })

    // Act
    const result = await harness.render(block)

    // Assert
    expect(result).toBe('<div class="empty-collection"><p>Empty state</p></div>')
  })
})
