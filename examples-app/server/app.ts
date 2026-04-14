import express from 'express'

import createError from 'http-errors'

import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { ExpressFrameworkAdapter } from '@ministryofjustice/hmpps-forge/express-nunjucks'
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
import exampleJourneysPackage from './journeys/examples'
import developerGuidePackage from './journeys/forge-developer-guide'

import type { Services } from './services'

export default function createApp(services: Services): express.Application {
  const app = express()
  const nunjucksEnv = nunjucksSetup(app)

  // FORGE-EXAMPLE: Initialize Forge with a logger and the Express/Nunjucks framework adapter
  const forge = new Forge({
    logger,
    frameworkAdapter: ExpressFrameworkAdapter.configure({ nunjucksEnv }),
  })
    // FORGE-EXAMPLE: Register component libraries so journeys can use GovUK/MOJ components
    .registerGlobalComponents(govukComponents)
    .registerGlobalComponents(mojComponents)
    // FORGE-EXAMPLE: Register a package, passing runtime dependencies (e.g. data stores, API clients)
    .registerPackage(exampleJourneysPackage, {
      formDataStore: services.formDataStore,
      appointmentApi: services.appointmentApi,
    })
    .registerPackage(developerGuidePackage, {
      guideContentStore: services.guideContentStore,
    })

  app.set('json spaces', 2)
  app.set('trust proxy', true)
  app.set('port', process.env.PORT || 3000)

  app.use(setUpHealthChecks(services.applicationInfo))
  // app.use(setUpWebSecurity())
  app.use(setUpWebSession())
  app.use(setUpWebRequestParsing())
  app.use(setUpStaticResources())
  app.use(setUpCsrf())
  // FORGE-EXAMPLE: Mount the Forge router — this serves all registered journey routes
  app.use(forge.getRouter() as express.Router)

  app.use((req, res, next) => next(createError(404, 'Not found')))
  app.use(errorHandler(process.env.NODE_ENV === 'production'))

  return app
}
