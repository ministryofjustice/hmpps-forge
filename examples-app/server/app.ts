import express from 'express'
import createError from 'http-errors'
import { Forge, type ForgeInstrumentationSink } from '@ministryofjustice/hmpps-forge/core'
import { createExpressRouter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import nunjucksSetup from './utils/nunjucksSetup'
import errorHandler from './errorHandler'
import setUpCsrf from './middleware/setUpCsrf'
import setUpHealthChecks from './middleware/setUpHealthChecks'
import setUpStaticResources from './middleware/setUpStaticResources'
import setUpWebRequestParsing from './middleware/setupRequestParsing'
import setUpWebSession from './middleware/setUpWebSession'
import logger from './logger'
import forgeGuideV2Package from './journeys/forge-guide-v2'
// import setUpWebSecurity from './middleware/setUpWebSecurity'
import llmsTxtRouter from './routes/llmsTxt'
import playgroundRouter from './routes/playground'
import type { Services } from './services'
import { forgeDevToolsInstrumentationSink } from './forgeDevTools'

export default function createApp(services: Services): express.Application {
  const app = express()
  const nunjucksEnv = nunjucksSetup(app)

  const forge = new Forge({
    logger,
    instrumentation: { sinks: createForgeInstrumentationSinks() },
  }).registerPackage(forgeGuideV2Package, {
    guideV2ContentStore: services.guideV2ContentStore,
  })

  app.set('json spaces', 2)
  app.set('trust proxy', true)
  app.set('port', process.env.PORT || 3000)

  app.use((_req, res, next) => {
    res.setHeader('Link', '</llms.txt>; rel="llms-txt", </llms-full.txt>; rel="llms-full-txt"')
    next()
  })
  app.use(setUpHealthChecks(services.applicationInfo))
  // app.use(setUpWebSecurity())
  app.use(setUpWebSession())
  app.use(setUpWebRequestParsing())
  app.use(setUpStaticResources())
  app.use(setUpCsrf())
  app.get('/', (req, res) => res.redirect('/forge-guide-v2'))
  app.get('/browser-demo{/*path}', (_req, res) => {
    res.render('pages/browser-forge-app', { pageTitle: 'Browser Forge demo' })
  })

  app.use('/forge-guide-v2/playground', playgroundRouter())
  app.use(createExpressRouter(forge, { nunjucksEnv }))

  app.use(llmsTxtRouter(services.guideV2ContentStore, services.llmsTextGenerator))

  app.use((req, res, next) => next(createError(404, 'Not found')))
  app.use(errorHandler(process.env.NODE_ENV === 'production'))

  return app
}

function createForgeInstrumentationSinks(): ForgeInstrumentationSink[] {
  return [forgeDevToolsInstrumentationSink]
}
