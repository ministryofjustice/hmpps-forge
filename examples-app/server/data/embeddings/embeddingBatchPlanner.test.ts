import { createEmbeddingBatchPlan } from './embeddingBatchPlanner'

describe('createEmbeddingBatchPlan()', () => {
  it('should include every text exactly once', () => {
    // Arrange
    const texts = ['tiny', 'small text', 'a much longer text block', 'medium']

    // Act
    const batches = createEmbeddingBatchPlan(texts, 2, 1_000)
    const plannedIndexes = batches.flat().map(item => item.index)

    // Assert
    expect(plannedIndexes).toEqual([0, 3, 1, 2])
  })

  it('should respect the batch size limit', () => {
    // Arrange
    const texts = ['one', 'two', 'three', 'four', 'five']

    // Act
    const batches = createEmbeddingBatchPlan(texts, 2, 1_000)

    // Assert
    expect(batches.map(batch => batch.length)).toEqual([2, 2, 1])
  })

  it('should start a new batch when the character budget would overflow', () => {
    // Arrange
    const texts = ['aaaa', 'bbbb', 'cccc', 'dddddddd']

    // Act
    const batches = createEmbeddingBatchPlan(texts, 8, 10)

    // Assert
    expect(batches.map(batch => batch.map(item => item.text))).toEqual([
      ['aaaa', 'bbbb'],
      ['cccc'],
      ['dddddddd'],
    ])
  })

  it('should allow a single oversized text in its own batch', () => {
    // Arrange
    const texts = ['tiny', 'this text is definitely over the budget']

    // Act
    const batches = createEmbeddingBatchPlan(texts, 8, 10)

    // Assert
    expect(batches.map(batch => batch.length)).toEqual([1, 1])
    expect(batches[1][0].text).toBe('this text is definitely over the budget')
  })
})
