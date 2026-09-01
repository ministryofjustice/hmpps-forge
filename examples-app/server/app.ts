import express from 'express'
import createError from 'http-errors'
import { Forge, type ForgeInstrumentationSink } from '@ministryofjustice/hmpps-forge/core'
import { createExpressRouter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { OpenAISupplier } from '@ministryofjustice/hmpps-forge/llm-adapter'
import { llmDemoPackage } from '@ministryofjustice/hmpps-forge/llm-adapter/demo'
import nunjucksSetup from './utils/nunjucksSetup'
import errorHandler from './errorHandler'
import setUpCsrf from './middleware/setUpCsrf'
import setUpHealthChecks from './middleware/setUpHealthChecks'
import setUpStaticResources from './middleware/setUpStaticResources'
import setUpWebRequestParsing from './middleware/setupRequestParsing'
import setUpWebSession from './middleware/setUpWebSession'
import logger from './logger'
import developerGuidePackage from './journeys/forge-developer-guide'
import setUpWebSecurity from './middleware/setUpWebSecurity'
import llmsTxtRouter from './routes/llmsTxt'
import { LlmWebchatRouter } from './routes/llm-webchat/LlmWebchatRouter'
import type { Services } from './services'
import { forgeDevToolsInstrumentationSink } from './forgeDevTools'
import config from './config'

export default function createApp(services: Services): express.Application {
  const app = express()
  const nunjucksEnv = nunjucksSetup(app)

  const forge = new Forge({
    logger,
    instrumentation: { sinks: createForgeInstrumentationSinks() },
  }).registerPackage(developerGuidePackage, {
    guideContentStore: services.guideContentStore,
    guideSearch: services.guideSearch,
    formDataStore: services.formDataStore,
    mocksApi: services.mocksApi,
  })
  const llmForge = new Forge({
    logger,
    instrumentation: { sinks: createForgeInstrumentationSinks() },
  }).registerPackage(llmDemoPackage)
  const llmSupplier = new OpenAISupplier({ apiKey: config.openAiApiKey ?? 'not-configured' })

  app.set('json spaces', 2)
  app.set('trust proxy', true)
  app.set('port', process.env.PORT || 3000)

  app.use((_req, res, next) => {
    res.setHeader('Link', '</llms.txt>; rel="llms-txt", </llms-full.txt>; rel="llms-full-txt"')
    next()
  })
  app.use(setUpHealthChecks(services.applicationInfo))
  app.use(setUpWebSecurity())
  app.use(setUpWebSession())
  app.use(setUpWebRequestParsing())
  app.use(setUpStaticResources())
  app.use(setUpCsrf())
  app.get('/', (req, res) => res.redirect('/forge-developer-guide/get-started'))
  app.use(
    new LlmWebchatRouter({
      forge: llmForge,
      supplier: llmSupplier,
      origin: config.ingressUrl,
      enabled: config.openAiApiKey !== undefined,
    }).create(),
  )
  app.use(createExpressRouter(forge, { nunjucksEnv }))

  app.use(llmsTxtRouter(services.guideContentStore, services.llmsTextGenerator))

  app.use((req, res, next) => next(createError(404, 'Not found')))
  app.use(errorHandler(process.env.NODE_ENV === 'production'))

  return app
}

function createForgeInstrumentationSinks(): ForgeInstrumentationSink[] {
  return [forgeDevToolsInstrumentationSink]
}
