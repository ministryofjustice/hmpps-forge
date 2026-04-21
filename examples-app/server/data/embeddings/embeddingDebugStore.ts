import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface EmbeddingDebugChunkRow {
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
  x: number
  y: number
}

export interface EmbeddingDebugQueryRow {
  type: 'query'
  requestId: string
  label: string
  text: string
  vector: number[]
  x: number
  y: number
}

export type EmbeddingDebugRow = EmbeddingDebugChunkRow | EmbeddingDebugQueryRow

export interface EmbeddingDebugPayload {
  generatedAt: string
  model: string
  chunkCount: number
  queryCount: number
  rows: EmbeddingDebugRow[]
}

export default class EmbeddingDebugStore {
  constructor(private readonly path = join(process.cwd(), 'tmp', 'embeddings-debug.json')) {}

  async load(): Promise<EmbeddingDebugPayload | null> {
    try {
      const contents = await readFile(this.path, 'utf-8')

      return JSON.parse(contents) as EmbeddingDebugPayload
    } catch {
      return null
    }
  }
}
