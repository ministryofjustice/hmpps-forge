export interface IndexedEmbeddingText {
  readonly index: number
  readonly text: string
}

export function createEmbeddingBatchPlan(
  texts: readonly string[],
  maxBatchSize: number,
  maxBatchCharacters: number,
): IndexedEmbeddingText[][] {
  const indexedTexts = texts
    .map((text, index) => ({ index, text }))
    .sort((left, right) => left.text.length - right.text.length)

  return indexedTexts.reduce<IndexedEmbeddingText[][]>((batches, item) => {
    const currentBatch = batches.at(-1)

    if (!currentBatch) {
      batches.push([item])

      return batches
    }

    const currentBatchCharacters = currentBatch.reduce(
      (sum, batchItem) => sum + batchItem.text.length,
      0,
    )
    const exceedsBatchSize = currentBatch.length >= maxBatchSize
    const exceedsCharacterBudget = currentBatchCharacters + item.text.length > maxBatchCharacters

    if (exceedsBatchSize || exceedsCharacterBudget) {
      batches.push([item])

      return batches
    }

    currentBatch.push(item)

    return batches
  }, [])
}
