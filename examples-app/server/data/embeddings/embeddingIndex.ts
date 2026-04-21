import { Worker } from 'node:worker_threads'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { PCA } from 'ml-pca'
import TSNE from 'tsne-js'
import { UMAP } from 'umap-js'
import logger from '../../logger'

export interface ScoredMatch {
  index: number
  score: number
}

type EmbeddingState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'failed'; error: string }

interface WorkerEmbeddedMessage {
  type: 'embedded'
  vectors: number[][]
}

interface WorkerQueryResultMessage {
  type: 'queryResult'
  vector: number[]
}

interface WorkerErrorMessage {
  type: 'error'
  message: string
}

type WorkerResponse = WorkerEmbeddedMessage | WorkerQueryResultMessage | WorkerErrorMessage

interface ProjectedPoint {
  x: number
  y: number
}

interface ProjectionSet {
  pca: ProjectedPoint
  tsne: ProjectedPoint
  umap: ProjectedPoint
}

interface DebugChunkMeta {
  slug: string
  path: string
  title: string
  heading: string
  tags: string[]
  text: string
  embeddingText: string
}

interface DebugExportOptions {
  enabled: boolean
  outputPath?: string
  chunks: DebugChunkMeta[]
  queries?: string[]
}

interface ExportedChunkEmbedding {
  type: 'chunk'
  index: number
  slug: string
  path: string
  title: string
  heading: string
  tags: string[]
  text: string
  embeddingText: string
  vector: number[]
  projections: ProjectionSet
}

interface ExportedQueryEmbedding {
  type: 'query'
  requestId: string
  label: string
  text: string
  vector: number[]
  projections: ProjectionSet
}

interface ExportPayload {
  generatedAt: string
  model: string
  chunkCount: number
  queryCount: number
  rows: Array<ExportedChunkEmbedding | ExportedQueryEmbedding>
}

const INDEX_TIMEOUT_MS = 60_000

function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0

  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i]
  }

  return sum
}

export default class EmbeddingIndex {
  private state: EmbeddingState = { status: 'idle' }

  private vectors: Float32Array[] = []

  private worker: Worker | undefined

  private indexTimeout: ReturnType<typeof setTimeout> | undefined

  private debugExport?: DebugExportOptions

  private queryQueue: Array<{
    resolve: (vector: Float32Array) => void
    reject: (error: Error) => void
  }> = []

  constructor() {
    try {
      this.worker = new Worker(join(__dirname, 'embeddingWorker.js'))
      this.attachWorkerHandlers()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.state = { status: 'failed', error: message }
      logger.warn({ err }, 'Failed to spawn embedding worker')
    }
  }

  get isReady(): boolean {
    return this.state.status === 'ready'
  }

  buildIndex(texts: string[], debug?: DebugExportOptions): void {
    if (this.state.status !== 'idle' || !this.worker) {
      return
    }

    this.debugExport = debug
    this.state = { status: 'loading' }

    if (texts.length === 0) {
      this.state = { status: 'ready' }
      logger.info('No texts to embed')
      return
    }

    this.indexTimeout = setTimeout(() => {
      logger.warn('Embedding indexing timed out after 60s')
      this.state = { status: 'failed', error: 'Indexing timed out' }
      this.worker?.terminate()
      this.worker = undefined
    }, INDEX_TIMEOUT_MS)

    this.worker.postMessage({ type: 'embed', texts })
  }

  projectVectorsPca(vectors: number[][]): ProjectedPoint[] {
    if (vectors.length === 0) {
      return []
    }

    if (vectors.length === 1) {
      return [{ x: 0, y: 0 }]
    }

    const pca = new PCA(vectors, { center: true, scale: false })
    const projected = pca.predict(vectors, { nComponents: 2 }).to2DArray()

    return projected.map(row => ({
      x: row[0] ?? 0,
      y: row[1] ?? 0,
    }))
  }

  projectVectorsTsne(vectors: number[][]): ProjectedPoint[] {
    if (vectors.length === 0) {
      return []
    }

    if (vectors.length === 1) {
      return [{ x: 0, y: 0 }]
    }

    const model = new TSNE({
      dim: 2,
      perplexity: Math.min(30, Math.max(5, Math.floor((vectors.length - 1) / 3))),
      earlyExaggeration: 4.0,
      learningRate: 100,
      nIter: 500,
      metric: 'euclidean',
    })

    model.init({
      data: vectors,
      type: 'dense',
    })

    model.run()

    return model.getOutputScaled().map((row: any[]) => ({
      x: row[0] ?? 0,
      y: row[1] ?? 0,
    }))
  }

  projectVectorsUmap(vectors: number[][]): ProjectedPoint[] {
    if (vectors.length === 0) {
      return []
    }

    if (vectors.length === 1) {
      return [{ x: 0, y: 0 }]
    }

    const umap = new UMAP({
      nComponents: 2,
      nNeighbors: Math.min(15, Math.max(2, vectors.length - 1)),
      minDist: 0.1,
    })

    return umap.fit(vectors).map(row => ({
      x: row[0] ?? 0,
      y: row[1] ?? 0,
    }))
  }

  fallbackProjection(count: number): ProjectedPoint[] {
    return Array.from({ length: count }, () => ({ x: 0, y: 0 }))
  }

  buildAllProjections(vectors: number[][]): ProjectionSet[] {
    const count = vectors.length

    let pca = this.fallbackProjection(count)
    let tsne = this.fallbackProjection(count)
    let umap = this.fallbackProjection(count)

    try {
      pca = this.projectVectorsPca(vectors)
    } catch (err) {
      logger.warn({ err }, 'Failed to build PCA projection')
    }

    try {
      tsne = this.projectVectorsTsne(vectors)
    } catch (err) {
      logger.warn({ err }, 'Failed to build t-SNE projection')
    }

    try {
      umap = this.projectVectorsUmap(vectors)
    } catch (err) {
      logger.warn({ err }, 'Failed to build UMAP projection')
    }

    return vectors.map((_, index) => ({
      pca: pca[index] ?? { x: 0, y: 0 },
      tsne: tsne[index] ?? { x: 0, y: 0 },
      umap: umap[index] ?? { x: 0, y: 0 },
    }))
  }

  private async writeDebugExport(chunkVectors: number[][]): Promise<void> {
    const debug = this.debugExport

    if (!debug?.enabled || !this.worker || debug.chunks.length !== chunkVectors.length) {
      return
    }

    try {
      const queries = debug.queries ?? []
      const queryEmbeddings = []

      for (const [index, text] of queries.entries()) {
        const requestId = `query-${index + 1}`
        // eslint-disable-next-line no-await-in-loop
        const vector = await this.embedQuery(text)

        queryEmbeddings.push({
          requestId,
          label: text,
          text,
          vector: Array.from(vector),
        })
      }

      const allVectors = [...chunkVectors, ...queryEmbeddings.map(query => query.vector)]
      const projections = this.buildAllProjections(allVectors)

      const chunkRows: ExportedChunkEmbedding[] = debug.chunks.map((chunk, index) => ({
        type: 'chunk',
        index,
        ...chunk,
        vector: chunkVectors[index],
        projections: projections[index],
      }))

      const queryRows: ExportedQueryEmbedding[] = queryEmbeddings.map((query, index) => {
        const projectionIndex = chunkRows.length + index

        return {
          type: 'query',
          requestId: query.requestId,
          label: query.label,
          text: query.text,
          vector: query.vector,
          projections: projections[projectionIndex],
        }
      })

      const outputPath = debug.outputPath ?? join(process.cwd(), 'tmp', 'embeddings-debug.json')

      const payload: ExportPayload = {
        generatedAt: new Date().toISOString(),
        model: 'Xenova/bge-small-en-v1.5',
        chunkCount: chunkRows.length,
        queryCount: queryRows.length,
        rows: [...chunkRows, ...queryRows],
      }

      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf-8')

      logger.info({ outputPath }, 'Wrote embedding debug export')
    } catch (err) {
      logger.warn({ err }, 'Failed to write embedding debug export')
    }
  }

  async search(query: string, topK = 10, minScore = 0.2): Promise<ScoredMatch[]> {
    if (!this.isReady || !this.worker) {
      return []
    }

    const queryVector = await this.embedQuery(query)

    const scored = this.vectors
      .map((vector, index) => ({ index, score: dotProduct(queryVector, vector) }))
      .filter(match => match.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    logger.debug(
      {
        query,
        topScores: scored.slice(0, 5).map(s => ({ index: s.index, score: s.score.toFixed(4) })),
      },
      'Semantic search scores',
    )

    return scored
  }

  shutdown(): void {
    clearTimeout(this.indexTimeout)
    this.worker?.terminate()
    this.worker = undefined
  }

  private attachWorkerHandlers(): void {
    if (!this.worker) {
      return
    }

    this.worker.on('message', (response: WorkerResponse) => {
      if (response.type === 'embedded') {
        clearTimeout(this.indexTimeout)
        this.vectors = response.vectors.map(v => new Float32Array(v))
        this.state = { status: 'ready' }
        logger.info({ count: this.vectors.length }, 'Embedding index ready')

        // eslint-disable-next-line no-void
        void this.writeDebugExport(response.vectors)

        return
      }

      if (response.type === 'queryResult') {
        const pending = this.queryQueue.shift()
        pending?.resolve(new Float32Array(response.vector))

        return
      }

      if (response.type === 'error') {
        const pending = this.queryQueue.shift()

        if (pending) {
          pending.reject(new Error(response.message))
        } else {
          clearTimeout(this.indexTimeout)
          this.state = { status: 'failed', error: response.message }
          logger.warn({ error: response.message }, 'Embedding worker failed')
          this.worker?.terminate()
          this.worker = undefined
        }
      }
    })

    this.worker.on('error', (err: Error) => {
      clearTimeout(this.indexTimeout)
      this.state = { status: 'failed', error: err.message }
      logger.warn({ err }, 'Embedding worker crashed')
      this.worker = undefined
    })
  }

  private embedQuery(text: string): Promise<Float32Array> {
    return new Promise((resolve, reject) => {
      this.queryQueue.push({ resolve, reject })
      this.worker!.postMessage({ type: 'query', text })
    })
  }
}
