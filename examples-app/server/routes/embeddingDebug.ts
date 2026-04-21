import type { Request, Response, NextFunction } from 'express'
import EmbeddingDebugStore from '../data/embeddings/embeddingDebugStore'

const store = new EmbeddingDebugStore()

export default async function embeddingDebug(req: Request, res: Response, next: NextFunction) {
  try {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).render('pages/not-found')
      return
    }

    const payload = await store.load()

    res.render('pages/embeddings', {
      pageTitle: 'Embedding debug',
      payload,
      rowsJson: JSON.stringify(payload?.rows ?? []).replaceAll('</', '<\\/'),
    })
  } catch (error) {
    next(error)
  }
}
