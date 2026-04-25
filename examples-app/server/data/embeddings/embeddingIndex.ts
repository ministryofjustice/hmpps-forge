import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
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

  buildIndex(texts: string[]): void {
    if (this.state.status !== 'idle' || !this.worker) {
      return
    }

    this.state = { status: 'loading' }

    if (texts.length === 0) {
      this.state = { status: 'ready' }
      logger.info('No texts to embed')

      return
    }

    this.worker.postMessage({ type: 'embed', texts })
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
    this.worker?.terminate()
    this.worker = undefined
  }

  private attachWorkerHandlers(): void {
    if (!this.worker) {
      return
    }

    this.worker.on('message', (response: WorkerResponse) => {
      if (response.type === 'embedded') {
        this.vectors = response.vectors.map(v => new Float32Array(v))
        this.state = { status: 'ready' }
        logger.info({ count: this.vectors.length }, 'Embedding index ready')

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
          this.state = { status: 'failed', error: response.message }
          logger.warn({ error: response.message }, 'Embedding worker failed')
          this.worker?.terminate()
          this.worker = undefined
        }
      }
    })

    this.worker.on('error', (err: Error) => {
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
