import { collectionBlock, EvaluatedCollectionBlock } from './collectionBlock'
import { ExpressionType, StructureType } from '../../../../form/types/enums'
import { RenderedBlock } from '../../../../form/types/structures.type'
import { ASTTestFactory } from '../../../../test-utils/ASTTestFactory'

describe('collectionBlock component', () => {
  const mockEvaluatedBlock = (overrides?: Partial<EvaluatedCollectionBlock>): EvaluatedCollectionBlock =>
    ({
      type: StructureType.BLOCK,
      variant: 'collection-block',
      collection: ASTTestFactory.expression(ExpressionType.COLLECTION).withCollection([]).withTemplate([]),
      ...overrides,
    }) as EvaluatedCollectionBlock

  const mockRenderedBlock = (html: string): RenderedBlock => ({
    block: {
      type: StructureType.BLOCK,
      variant: 'test',
    },
    html,
  })

  it('should render blocks when collection has items', async () => {
    const block = mockEvaluatedBlock({
      blocks: [
        mockRenderedBlock('<div>Item 1</div>'),
        mockRenderedBlock('<div>Item 2</div>'),
        mockRenderedBlock('<div>Item 3</div>'),
      ],
    })

    const result = await collectionBlock.spec.render(block as any)

    expect(result).toBe('<div>Item 1</div><div>Item 2</div><div>Item 3</div>')
  })

  it('should render fallback block when collection is empty', async () => {
    const block = mockEvaluatedBlock({
      blocks: [],
      fallbackBlock: mockRenderedBlock('<p>No items available</p>'),
    })

    const result = await collectionBlock.spec.render(block as any)

    expect(result).toBe('<p>No items available</p>')
  })

  it('should render empty string when no blocks and no fallback', async () => {
    const block = mockEvaluatedBlock({
      blocks: [],
    })

    const result = await collectionBlock.spec.render(block as any)

    expect(result).toBe('')
  })

  it('should render with wrapper div when classes are provided', async () => {
    const block = mockEvaluatedBlock({
      blocks: [mockRenderedBlock('<div>Item 1</div>'), mockRenderedBlock('<div>Item 2</div>')],
      classes: 'collection-wrapper custom-class',
    })

    const result = await collectionBlock.spec.render(block as any)

    expect(result).toBe('<div class="collection-wrapper custom-class"><div>Item 1</div><div>Item 2</div></div>')
  })

  it('should render with wrapper div when attributes are provided', async () => {
    const block = mockEvaluatedBlock({
      blocks: [mockRenderedBlock('<div>Item 1</div>')],
      attributes: {
        'data-collection': 'items',
        id: 'item-list',
      },
    })

    const result = await collectionBlock.spec.render(block as any)

    expect(result).toBe('<div data-collection="items" id="item-list"><div>Item 1</div></div>')
  })

  it('should render with wrapper div when both classes and attributes are provided', async () => {
    const block = mockEvaluatedBlock({
      blocks: [mockRenderedBlock('<div>Item 1</div>'), mockRenderedBlock('<div>Item 2</div>')],
      classes: 'styled-collection',
      attributes: {
        'data-count': '2',
        role: 'list',
      },
    })

    const result = await collectionBlock.spec.render(block as any)

    expect(result).toBe(
      '<div class="styled-collection" data-count="2" role="list"><div>Item 1</div><div>Item 2</div></div>',
    )
  })

  it('should render fallback with wrapper when classes are provided and collection is empty', async () => {
    const block = mockEvaluatedBlock({
      blocks: [],
      fallbackBlock: mockRenderedBlock('<p>No items</p>'),
      classes: 'empty-collection',
    })

    const result = await collectionBlock.spec.render(block as any)

    expect(result).toBe('<div class="empty-collection"><p>No items</p></div>')
  })

  it('should prioritize blocks over fallback when both are present', async () => {
    const block = mockEvaluatedBlock({
      blocks: [mockRenderedBlock('<div>Item exists</div>')],
      fallbackBlock: mockRenderedBlock('<p>This should not render</p>'),
    })

    const result = await collectionBlock.spec.render(block as any)

    expect(result).toBe('<div>Item exists</div>')
  })

  it('should handle complex nested HTML in blocks', async () => {
    const block = mockEvaluatedBlock({
      blocks: [
        mockRenderedBlock(`
          <div class="card">
            <h3>Title 1</h3>
            <p>Description for item 1</p>
          </div>
        `),
        mockRenderedBlock(`
          <div class="card">
            <h3>Title 2</h3>
            <p>Description for item 2</p>
          </div>
        `),
      ],
    })

    const result = await collectionBlock.spec.render(block as any)

    expect(result).toBe(`
          <div class="card">
            <h3>Title 1</h3>
            <p>Description for item 1</p>
          </div>
        
          <div class="card">
            <h3>Title 2</h3>
            <p>Description for item 2</p>
          </div>
        `)
  })

  it('should have the correct variant', () => {
    expect(collectionBlock.spec.variant).toBe('collection-block')
  })

  it('should handle undefined blocks array', async () => {
    const block = mockEvaluatedBlock({
      blocks: undefined,
    })

    const result = await collectionBlock.spec.render(block as any)

    expect(result).toBe('')
  })

  it('should handle undefined fallbackBlock', async () => {
    const block = mockEvaluatedBlock({
      blocks: [],
      fallbackBlock: undefined,
    })

    const result = await collectionBlock.spec.render(block as any)

    expect(result).toBe('')
  })
})
