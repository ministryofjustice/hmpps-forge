import { Router } from 'express'
import type GuideContentStore from '../data/guideContentStore'
import type LlmsTextGenerator from '../data/llmsTextGenerator'

export default function llmsTxtRouter(
  contentStore: GuideContentStore,
  generator: LlmsTextGenerator,
): Router {
  const router = Router()

  async function loadedEntries() {
    await contentStore.load()

    return contentStore.allEntries()
  }

  router.get('/llms.txt', async (req, res, next) => {
    try {
      const entries = await loadedEntries()

      res.type('text/plain; charset=utf-8').send(generator.buildIndex(entries))
    } catch (error) {
      next(error)
    }
  })

  router.get('/llms-full.txt', async (req, res, next) => {
    try {
      const entries = await loadedEntries()

      res.type('text/plain; charset=utf-8').send(generator.buildFull(entries))
    } catch (error) {
      next(error)
    }
  })

  router.get('/llms/forge-developer-guide{/*path}', async (req, res, next) => {
    try {
      const entries = await loadedEntries()
      const rawPath = Array.isArray(req.params.path) ? req.params.path.join('/') : req.params.path
      const entry = generator.findEntry(entries, rawPath)

      if (!entry) {
        res.status(404).type('text/plain').send('Not found')

        return
      }

      res.type('text/markdown; charset=utf-8').send(generator.buildContentPage(entry, entries))
    } catch (error) {
      next(error)
    }
  })

  return router
}
