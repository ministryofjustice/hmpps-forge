import express from 'express'
import createError from 'http-errors'
import { Forge, type ForgeInstrumentationSink } from '@ministryofjustice/hmpps-forge/core'
import {
  createExpressRouter,
  nunjucksFunctions,
} from '@ministryofjustice/hmpps-forge/express-nunjucks'
import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
import { mojComponents } from '@ministryofjustice/hmpps-forge/moj-components'
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
import type { Services } from './services'

export default function createApp(services: Services): express.Application {
  const app = express()
  const nunjucksEnv = nunjucksSetup(app)

  const forge = new Forge({ logger, instrumentation: { sinks: createForgeInstrumentationSinks() } })
    .registerGlobalComponents(govukComponents)
    .registerGlobalComponents(mojComponents)
    .registerGlobalFunctions(nunjucksFunctions)
    .registerPackage(developerGuidePackage, {
      guideContentStore: services.guideContentStore,
      guideSearch: services.guideSearch,
      formDataStore: services.formDataStore,
      mocksApi: services.mocksApi,
    })

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
  app.use(createExpressRouter(forge, { nunjucksEnv }))

  app.use(llmsTxtRouter(services.guideContentStore, services.llmsTextGenerator))

  app.use((req, res, next) => next(createError(404, 'Not found')))
  app.use(errorHandler(process.env.NODE_ENV === 'production'))

  return app
}

function createForgeInstrumentationSinks(): ForgeInstrumentationSink[] {
  const tracePath = process.env.FORGE_TRACE_PATH
  const tracePathPrefix = process.env.FORGE_TRACE_PATH_PREFIX

  if (!tracePath && !tracePathPrefix) {
    return []
  }

  return [
    {
      onRequestTrace: event => {
        if (!shouldLogForgeTrace(event.snapshot.location.pathname, tracePath, tracePathPrefix)) {
          return
        }

        logger.info(
          {
            forgeTrace: {
              snapshot: {
                nodeId: event.snapshot.nodeId,
                method: event.snapshot.method,
                path: event.snapshot.location.pathname,
              },
              trace: event.trace,
            },
          },
          'Forge request trace',
        )
      },
    },
  ]
}

function shouldLogForgeTrace(
  pathname: string,
  tracePath: string | undefined,
  tracePathPrefix: string | undefined,
): boolean {
  if (tracePath && pathname === tracePath) {
    return true
  }

  return tracePathPrefix ? pathname.startsWith(tracePathPrefix) : false
}
