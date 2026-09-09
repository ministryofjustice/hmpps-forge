import path from 'path'
import compression from 'compression'
import express, { Router } from 'express'
import noCache from 'nocache'

import config from '../config'

export default function setUpStaticResources(): Router {
  const router = express.Router()

  router.use(compression())

  //  Static Resources Configuration
  const staticResourcesConfig = {
    maxAge: config.staticResourceCacheDuration,
    redirect: false,
  }

  Array.of(
    '/dist/assets',
    '/node_modules/govuk-frontend/dist/govuk/assets',
    '/node_modules/govuk-frontend/dist',
    '/node_modules/@ministryofjustice/frontend/moj/assets',
    '/node_modules/@ministryofjustice/frontend',
  ).forEach(dir => {
    router.use('/assets', express.static(path.join(process.cwd(), dir), staticResourcesConfig))
  })

  router.use('/assets/playground', (req, res, next) => {
    if (!req.path.endsWith('.ts') || /\.(test|spec|d)\.ts$/.test(req.path)) {
      next()

      return
    }

    express.static(path.join(process.cwd(), 'assets/playground'), {
      ...staticResourcesConfig,
      setHeaders: response => response.setHeader('Content-Type', 'text/plain; charset=utf-8'),
    })(req, res, next)
  })

  // Don't cache dynamic resources
  router.use(noCache())

  return router
}
