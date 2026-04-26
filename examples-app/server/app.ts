import express from 'express'
import createError from 'http-errors'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import {
  ExpressFrameworkAdapter,
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
import config from './config'

export default function createApp(services: Services): express.Application {
  const app = express()
  const nunjucksEnv = nunjucksSetup(app)

  const forge = new Forge({
    logger,
    frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
    lazyStepCompilation: !config.production,
  })
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
  app.use(forge.getRouter() as express.Router)

  app.use(llmsTxtRouter(services.guideContentStore, services.llmsTextGenerator))

  app.use((req, res, next) => next(createError(404, 'Not found')))
  app.use(errorHandler(process.env.NODE_ENV === 'production'))

  return app
}
