import { collectionBlock, EvaluatedCollectionBlock } from './collectionBlock'
import { StructureType } from '../../form/types/enums'
import { RenderedBlock } from '../../form/types/structures.type'

describe('collectionBlock component', () => {
  const mockEvaluatedBlock = (overrides?: Partial<EvaluatedCollectionBlock>): EvaluatedCollectionBlock =>
    ({
      type: StructureType.BLOCK,
      blockType: 'basic',
      variant: 'collection-block',
      ...overrides,
    }) as EvaluatedCollectionBlock

  const mockRenderedBlock = (html: string): RenderedBlock => ({
    block: {
      type: StructureType.BLOCK,
      blockType: 'basic',
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
})
