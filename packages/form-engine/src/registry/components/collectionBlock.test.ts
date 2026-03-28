import { collectionBlock, EvaluatedCollectionBlock } from './collectionBlock'
import { BlockType, StructureType } from '../../form/types/enums'
import { RenderedBlock } from '../../form/types/structures.type'

describe('collectionBlock component', () => {
  const mockEvaluatedBlock = (overrides?: Partial<EvaluatedCollectionBlock>): EvaluatedCollectionBlock =>
    ({
      type: StructureType.BLOCK,
      blockType: BlockType.BASIC,
      variant: 'collection-block',
      ...overrides,
    }) as EvaluatedCollectionBlock

  const mockRenderedBlock = (html: string): RenderedBlock => ({
    block: {
      type: StructureType.BLOCK,
      blockType: BlockType.BASIC,
      variant: 'test',
    },
    html,
  })

  it('should render collection when it has items', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: [
        mockRenderedBlock('<div>Item 1</div>'),
        mockRenderedBlock('<div>Item 2</div>'),
        mockRenderedBlock('<div>Item 3</div>'),
      ],
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('<div>Item 1</div><div>Item 2</div><div>Item 3</div>')
  })

  it('should render empty string when collection is empty', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: [],
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('')
  })

  it('should render with wrapper div when classes are provided', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: [mockRenderedBlock('<div>Item 1</div>'), mockRenderedBlock('<div>Item 2</div>')],
      classes: 'collection-wrapper custom-class',
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('<div class="collection-wrapper custom-class"><div>Item 1</div><div>Item 2</div></div>')
  })

  it('should render with wrapper div when attributes are provided', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: [mockRenderedBlock('<div>Item 1</div>')],
      attributes: {
        'data-collection': 'items',
        id: 'item-list',
      },
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('<div data-collection="items" id="item-list"><div>Item 1</div></div>')
  })

  it('should render with wrapper div when both classes and attributes are provided', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: [mockRenderedBlock('<div>Item 1</div>'), mockRenderedBlock('<div>Item 2</div>')],
      classes: 'styled-collection',
      attributes: {
        'data-count': '2',
        role: 'list',
      },
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe(
      '<div class="styled-collection" data-count="2" role="list"><div>Item 1</div><div>Item 2</div></div>',
    )
  })

  it('should render empty wrapper when classes provided and collection is empty', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: [],
      classes: 'empty-collection',
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('<div class="empty-collection"></div>')
  })

  it('should handle complex nested HTML in collection', async () => {
    // Arrange
    const html1 = '<div class="card"><h3>Title 1</h3></div>'
    const html2 = '<div class="card"><h3>Title 2</h3></div>'
    const block = mockEvaluatedBlock({
      collection: [mockRenderedBlock(html1), mockRenderedBlock(html2)],
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe(`${html1}${html2}`)
  })

  it('should have the correct variant', () => {
    // Assert
    expect(collectionBlock.variant).toBe('collection-block')
  })

  it('should handle undefined collection', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: undefined,
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('')
  })

  it('should handle plain string items in collection', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: ['<li>Item 1</li>', '<li>Item 2</li>', '<li>Item 3</li>'] as unknown as any[],
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('<li>Item 1</li><li>Item 2</li><li>Item 3</li>')
  })

  it('should handle mixed rendered blocks and strings in collection', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: [
        mockRenderedBlock('<div>Block 1</div>'),
        '<p>Plain string</p>',
        mockRenderedBlock('<div>Block 2</div>'),
      ] as unknown as any[],
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('<div>Block 1</div><p>Plain string</p><div>Block 2</div>')
  })

  it('should handle nested arrays in collection items', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: [
        ['<li>Nested 1</li>', '<li>Nested 2</li>'],
        mockRenderedBlock('<li>Block item</li>'),
      ] as unknown as any[],
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('<li>Nested 1</li><li>Nested 2</li><li>Block item</li>')
  })

  it('should render fallback when collection is empty', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: [],
      fallback: [mockRenderedBlock('<p>No items found</p>')],
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('<p>No items found</p>')
  })

  it('should render fallback when collection is undefined', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: undefined,
      fallback: [mockRenderedBlock('<p>No items available</p>')],
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('<p>No items available</p>')
  })

  it('should render collection items instead of fallback when collection has items', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: [mockRenderedBlock('<div>Item 1</div>')],
      fallback: [mockRenderedBlock('<p>No items found</p>')],
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('<div>Item 1</div>')
  })

  it('should render fallback with wrapper div when classes are provided', async () => {
    // Arrange
    const block = mockEvaluatedBlock({
      collection: [],
      fallback: [mockRenderedBlock('<p>Empty state</p>')],
      classes: 'empty-collection',
    })

    // Act
    const result = await collectionBlock.render(block as any)

    // Assert
    expect(result).toBe('<div class="empty-collection"><p>Empty state</p></div>')
  })
})
