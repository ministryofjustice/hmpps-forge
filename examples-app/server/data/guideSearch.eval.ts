/* eslint-disable no-console */
import { join } from 'node:path'
import { createEmbeddingBatchPlan } from './embeddings/embeddingBatchPlanner'
import type { ScoredMatch } from './embeddings/embeddingIndex'
import type EmbeddingIndex from './embeddings/embeddingIndex'
import GuideContentStore from './guideContentStore'
import GuideSearch from './guideSearch'
import type { SearchResult } from './guideSearch'

// Replicates embeddingWorker.ts in-process so the eval can measure hybrid search
// without the compiled worker file (absent under vitest) or the /opt/models dir.
// It deliberately does NOT call configureTransformersLocalModelSource, so the model
// is downloaded from the hub and cached for offline repeat runs.

const MAX_BATCH_SIZE = 8
const MAX_BATCH_CHARACTERS = 5_000
const TRANSFORMERS_PACKAGE = '@huggingface/transformers'

interface FeatureExtractionOutput {
  data: Float32Array
  dims: number[]
  dispose(): void
}

interface FeatureExtractionPipeline {
  (
    texts: string | string[],
    options: { pooling: 'mean'; normalize: boolean },
  ): Promise<FeatureExtractionOutput>
}

interface TransformersModule {
  pipeline(
    task: 'feature-extraction',
    model: string,
    options: { dtype: 'q8' },
  ): Promise<FeatureExtractionPipeline>
}

function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0

  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i]
  }

  return sum
}

class EvalEmbeddingIndex {
  private readonly extractorPromise: Promise<FeatureExtractionPipeline>

  private state: 'idle' | 'loading' | 'ready' = 'idle'

  private vectors: Float32Array[] = []

  private readyPromise: Promise<void> = Promise.resolve()

  constructor() {
    this.extractorPromise = this.createPipeline()
  }

  get isReady(): boolean {
    return this.state === 'ready'
  }

  buildIndex(texts: string[]): void {
    if (this.state !== 'idle') {
      return
    }

    this.state = 'loading'

    if (texts.length === 0) {
      this.state = 'ready'

      return
    }

    this.readyPromise = this.embedAll(texts)
  }

  async whenReady(): Promise<void> {
    await this.readyPromise
  }

  async search(query: string, topK = 10, minScore = 0.2): Promise<ScoredMatch[]> {
    if (!this.isReady) {
      return []
    }

    const queryVector = await this.embedQuery(query)

    return this.vectors
      .map((vector, index) => ({ index, score: dotProduct(queryVector, vector) }))
      .filter(match => match.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  shutdown(): void {
    // No worker thread to terminate in the in-process replica.
  }

  private async createPipeline(): Promise<FeatureExtractionPipeline> {
    const { pipeline } = (await import(TRANSFORMERS_PACKAGE)) as unknown as TransformersModule

    return pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { dtype: 'q8' })
  }

  private async embedAll(texts: string[]): Promise<void> {
    const extractor = await this.extractorPromise
    const vectors = new Array<Float32Array>(texts.length)
    const batchPlan = createEmbeddingBatchPlan(texts, MAX_BATCH_SIZE, MAX_BATCH_CHARACTERS)

    for (let i = 0; i < batchPlan.length; i += 1) {
      const batch = batchPlan[i]
      const batchTexts = batch.map(item => item.text)
      // eslint-disable-next-line no-await-in-loop
      const batchVectors = await this.embedBatch(extractor, batchTexts)

      batchVectors.forEach((vector, batchIndex) => {
        vectors[batch[batchIndex].index] = vector
      })
    }

    this.vectors = vectors
    this.state = 'ready'
  }

  private async embedBatch(
    extractor: FeatureExtractionPipeline,
    texts: string[],
  ): Promise<Float32Array[]> {
    const output = await extractor(texts, { pooling: 'mean', normalize: true })
    const { data } = output
    const dimensions = output.dims[output.dims.length - 1]

    const vectors = texts.map((_, i) => {
      const start = i * dimensions

      return new Float32Array(data.slice(start, start + dimensions))
    })

    output.dispose()

    return vectors
  }

  private async embedQuery(text: string): Promise<Float32Array> {
    const extractor = await this.extractorPromise
    const output = await extractor(text, { pooling: 'mean', normalize: true })
    const vector = new Float32Array(output.data)

    output.dispose()

    return vector
  }
}

enum QueryCategory {
  IDENTIFIER = 'identifier',
  CONCEPTUAL = 'conceptual',
  TITLE = 'title',
  TYPO = 'typo',
}

interface EvalQuery {
  category: QueryCategory
  query: string
  expected: string[]
}

const EVAL_QUERIES: EvalQuery[] = [
  {
    category: QueryCategory.IDENTIFIER,
    query: 'throwError',
    expected: ['hooks-and-lifecycle', 'patterns-auth-role'],
  },
  {
    category: QueryCategory.IDENTIFIER,
    query: 'visibleWhen',
    expected: ['defining-blocks-and-fields', 'patterns-read-only-mode'],
  },
  {
    category: QueryCategory.IDENTIFIER,
    query: 'dependentWhen',
    expected: ['defining-blocks-and-fields', 'validation', 'patterns-reveal-fields'],
  },
  {
    category: QueryCategory.IDENTIFIER,
    query: 'cleardownFieldCodes',
    expected: ['reachability', 'defining-steps'],
  },
  {
    category: QueryCategory.IDENTIFIER,
    query: 'resumeWhen',
    expected: ['patterns-resuming', 'reachability', 'routing-and-entry-points'],
  },
  {
    category: QueryCategory.IDENTIFIER,
    query: 'buildNunjucksComponent',
    expected: ['express-nunjucks-building-components', 'building-custom-components'],
  },
  {
    category: QueryCategory.IDENTIFIER,
    query: 'createExpressRouter',
    expected: [
      'express-nunjucks',
      'using-forge-in-your-app',
      'using-forge-with-express-and-nunjucks',
    ],
  },
  {
    category: QueryCategory.IDENTIFIER,
    query: 'EffectFunctionContext',
    expected: ['building-custom-effects'],
  },
  {
    category: QueryCategory.IDENTIFIER,
    query: 'GovUKDateInputFull',
    expected: ['govuk-date-input', 'patterns-composite-fields'],
  },
  {
    category: QueryCategory.IDENTIFIER,
    query: 'Iterator.Map',
    expected: ['item-and-iterators', 'patterns-add-another'],
  },
  { category: QueryCategory.IDENTIFIER, query: 'ForgeTestHarness', expected: ['testing'] },
  {
    category: QueryCategory.IDENTIFIER,
    query: 'CollectionBlock',
    expected: ['collection-block', 'item-and-iterators'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'show a field only when a checkbox is ticked',
    expected: ['patterns-reveal-fields', 'govuk-checkbox-input', 'defining-blocks-and-fields'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'make a field required',
    expected: ['validation', 'conditions-general'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'run code when the user submits a page',
    expected: ['hooks-and-lifecycle'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'fetch data from an api before the page loads',
    expected: ['patterns-load-reference-data'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'let the user add another item to a list',
    expected: ['patterns-add-another', 'patterns-repeating-fieldsets'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'go to a different page depending on an answer',
    expected: ['patterns-branching', 'loading-saving-and-redirecting'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'stop users jumping ahead to later steps',
    expected: ['reachability', 'routing-and-entry-points'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'let users come back and finish the form later',
    expected: ['patterns-resuming'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'check your answers page',
    expected: ['patterns-single-question-per-page'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'reject dates in the future',
    expected: ['conditions-date', 'validation'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'restrict a page to certain user roles',
    expected: ['patterns-auth-role'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'dropdown menu of options',
    expected: ['govuk-select-input'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'format a date for display',
    expected: ['transformers-date'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'insert a value into the middle of some text',
    expected: ['format'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'repeat the same group of fields for each item',
    expected: ['patterns-repeating-fieldsets'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'prefill the form with data from another system',
    expected: ['patterns-pre-fill'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'postcode lookup',
    expected: ['patterns-search-and-select'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'task list where sections unlock in order',
    expected: ['patterns-task-list'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'validate one field against the value of another',
    expected: ['validation'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'read parameters from the query string',
    expected: ['query', 'params'],
  },
  {
    category: QueryCategory.CONCEPTUAL,
    query: 'make the whole journey read only',
    expected: ['patterns-read-only-mode'],
  },
  { category: QueryCategory.TITLE, query: 'installing forge', expected: ['installing-forge'] },
  { category: QueryCategory.TITLE, query: 'testing journeys', expected: ['testing'] },
  { category: QueryCategory.TITLE, query: 'custom effects', expected: ['building-custom-effects'] },
  { category: QueryCategory.TITLE, query: 'reachability', expected: ['reachability'] },
  { category: QueryCategory.TYPO, query: 'valdation rules', expected: ['validation'] },
  { category: QueryCategory.TYPO, query: 'transfromers', expected: ['transformers'] },
  { category: QueryCategory.TYPO, query: 'acordion component', expected: ['govuk-accordion'] },
]

interface QueryRankRow {
  category: QueryCategory
  query: string
  keywordRank: number | undefined
  hybridRank: number | undefined
}

interface ModeSummary {
  count: number
  hit1: number
  hit3: number
  mrr: number
}

function rankOf(results: SearchResult[], expected: string[]): number | undefined {
  const index = results.findIndex(result => expected.includes(result.slug))

  return index === -1 ? undefined : index + 1
}

const CATEGORY_WIDTH = 12
const QUERY_WIDTH = 50
const RANK_WIDTH = 8

function pad(value: string, width: number): string {
  const truncated = value.length > width - 1 ? `${value.slice(0, width - 2)}…` : value

  return truncated.padEnd(width)
}

function formatRank(rank: number | undefined): string {
  return rank === undefined ? '-' : String(rank)
}

function summarise(ranks: (number | undefined)[]): ModeSummary {
  const count = ranks.length

  if (count === 0) {
    return { count, hit1: 0, hit3: 0, mrr: 0 }
  }

  const hit1 = ranks.filter(rank => rank === 1).length / count
  const hit3 = ranks.filter(rank => rank !== undefined && rank <= 3).length / count
  const mrr = ranks.reduce<number>((sum, rank) => sum + (rank ? 1 / rank : 0), 0) / count

  return { count, hit1, hit3, mrr }
}

function printTable(rows: QueryRankRow[]): void {
  console.log('\n=== Per-query ranks (1-based; "-" = miss) ===')
  console.log(
    pad('category', CATEGORY_WIDTH) +
      pad('query', QUERY_WIDTH) +
      pad('keyword', RANK_WIDTH + 3) +
      pad('hybrid', RANK_WIDTH),
  )

  rows.forEach(row => {
    console.log(
      pad(row.category, CATEGORY_WIDTH) +
        pad(row.query, QUERY_WIDTH) +
        pad(formatRank(row.keywordRank), RANK_WIDTH + 3) +
        pad(formatRank(row.hybridRank), RANK_WIDTH),
    )
  })
}

function printSummaryRow(label: string, summary: ModeSummary): void {
  console.log(
    pad(label, CATEGORY_WIDTH) +
      pad(String(summary.count), 5) +
      pad(summary.hit1.toFixed(2), 8) +
      pad(summary.hit3.toFixed(2), 8) +
      pad(summary.mrr.toFixed(3), 8),
  )
}

function printSummary(
  rows: QueryRankRow[],
  mode: string,
  pick: (row: QueryRankRow) => number | undefined,
): void {
  console.log(`\n=== Summary: ${mode} ===`)
  console.log(
    pad('category', CATEGORY_WIDTH) +
      pad('n', 5) +
      pad('hit@1', 8) +
      pad('hit@3', 8) +
      pad('MRR', 8),
  )

  Object.values(QueryCategory).forEach(category => {
    const ranks = rows.filter(row => row.category === category).map(pick)

    printSummaryRow(category, summarise(ranks))
  })

  printSummaryRow('overall', summarise(rows.map(pick)))
}

function printMisses(
  rows: QueryRankRow[],
  mode: string,
  pick: (row: QueryRankRow) => number | undefined,
): void {
  const misses = rows.filter(row => pick(row) === undefined)

  console.log(`\n=== Misses: ${mode} (${misses.length}) ===`)

  if (misses.length === 0) {
    console.log('(none)')

    return
  }

  misses.forEach(row => {
    const expected = EVAL_QUERIES.find(q => q.query === row.query)?.expected ?? []

    console.log(`[${row.category}] ${row.query} -> [${expected.join(', ')}]`)
  })
}

function printReport(rows: QueryRankRow[]): void {
  printTable(rows)
  printSummary(rows, 'keyword', row => row.keywordRank)
  printSummary(rows, 'hybrid', row => row.hybridRank)
  printMisses(rows, 'keyword', row => row.keywordRank)
  printMisses(rows, 'hybrid', row => row.hybridRank)
}

const SECTIONS_DIR = join(__dirname, '../journeys/forge-developer-guide/sections')

describe('GuideSearch quality eval', () => {
  it('reports keyword vs hybrid ranking against the V1 content', async () => {
    // Arrange
    const store = new GuideContentStore(SECTIONS_DIR)
    const keywordSearch = new GuideSearch(store)
    const evalIndex = new EvalEmbeddingIndex()
    const hybridSearch = new GuideSearch(store, evalIndex as unknown as EmbeddingIndex)

    await hybridSearch.load()
    await evalIndex.whenReady()

    // Act
    const rows: QueryRankRow[] = []

    for (let i = 0; i < EVAL_QUERIES.length; i += 1) {
      const { category, query, expected } = EVAL_QUERIES[i]
      // eslint-disable-next-line no-await-in-loop
      const [keywordResults, hybridResults] = await Promise.all([
        keywordSearch.search(query),
        hybridSearch.search(query),
      ])

      rows.push({
        category,
        query,
        keywordRank: rankOf(keywordResults, expected),
        hybridRank: rankOf(hybridResults, expected),
      })
    }

    printReport(rows)
    evalIndex.shutdown()

    // Assert
    expect(true).toBe(true)
  }, 600_000)
})
