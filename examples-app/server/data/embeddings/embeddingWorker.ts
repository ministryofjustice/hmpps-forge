import { parentPort } from 'node:worker_threads'
import { createEmbeddingBatchPlan } from './embeddingBatchPlanner'
import { configureTransformersLocalModelSource } from './embeddingRuntimeConfig'

interface EmbedMessage {
  type: 'embed'
  texts: string[]
}

interface QueryMessage {
  type: 'query'
  text: string
}

type WorkerMessage = EmbedMessage | QueryMessage

const MAX_BATCH_SIZE = 8
const MAX_BATCH_CHARACTERS = 5_000

async function createPipeline() {
  const { env, pipeline } = await import('@huggingface/transformers')

  configureTransformersLocalModelSource(env)

  return pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', {
    dtype: 'q8',
  })
}

// Eagerly start model loading when the worker spawns, rather than waiting for the first message
const extractorPromise = createPipeline()

async function embedBatch(
  extractor: Awaited<ReturnType<typeof createPipeline>>,
  texts: string[],
): Promise<number[][]> {
  const output = await extractor(texts, { pooling: 'mean', normalize: true })
  const data = output.data as Float32Array
  const dimensions = output.dims[output.dims.length - 1]

  const vectors = texts.map((_, i) => {
    const start = i * dimensions

    return Array.from(data.slice(start, start + dimensions))
  })

  output.dispose()

  return vectors
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const extractor = await extractorPromise
  const vectors = new Array<number[]>(texts.length)
  const batchPlan = createEmbeddingBatchPlan(texts, MAX_BATCH_SIZE, MAX_BATCH_CHARACTERS)

  for (let i = 0; i < batchPlan.length; i += 1) {
    const batch = batchPlan[i]
    const batchTexts = batch.map(item => item.text)
    // eslint-disable-next-line no-await-in-loop
    const batchVectors = await embedBatch(extractor, batchTexts)

    batchVectors.forEach((vector, batchIndex) => {
      vectors[batch[batchIndex].index] = vector
    })
  }

  return vectors
}

async function embedSingle(text: string): Promise<number[]> {
  const extractor = await extractorPromise
  const output = await extractor(text, { pooling: 'mean', normalize: true })
  const vector = Array.from(output.data as Float32Array)

  output.dispose()

  return vector
}

parentPort?.on('message', async (message: WorkerMessage) => {
  try {
    if (message.type === 'embed') {
      const vectors = await embedTexts(message.texts)
      parentPort?.postMessage({ type: 'embedded', vectors })

      return
    }

    if (message.type === 'query') {
      const vector = await embedSingle(message.text)
      parentPort?.postMessage({ type: 'queryResult', vector })
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    parentPort?.postMessage({ type: 'error', message: errorMessage })
  }
})
