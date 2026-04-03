import path from 'path'
import nunjucks from 'nunjucks'
import express from 'express'
import fs from 'fs'
import { initialiseName } from './utils'
import config from '../config'
import logger from '../logger'

export default function nunjucksSetup(app: express.Express): nunjucks.Environment {
  app.set('view engine', 'njk')

  const { locals } = app

  locals.asset_path = '/assets/'
  locals.applicationName = 'Forge Examples App'
  locals.environmentName = config.environmentName

  let assetManifest: Record<string, string> = {}

  try {
    const paths = [
      path.join(process.cwd(), 'dist/assets/manifest.json'),
      path.resolve(__dirname, '../../assets/manifest.json'),
    ]

    const validPath = paths.find(p => fs.existsSync(p))

    if (!validPath) {
      throw new Error('Asset manifest not found')
    }

    assetManifest = JSON.parse(fs.readFileSync(validPath, 'utf8'))
  } catch (e) {
    if (process.env.NODE_ENV !== 'test') {
      logger.error(e, 'Could not read asset manifest file')
    }
  }

  const njkEnv = nunjucks.configure(
    [
      path.join(__dirname, 'server/views'),
      path.join(__dirname, '../../server/views'),
      'node_modules/govuk-frontend/dist/',
      'node_modules/@ministryofjustice/frontend/',
      'node_modules/@ministryofjustice/hmpps-forge/dist/govuk-components/',
      'node_modules/@ministryofjustice/hmpps-forge/dist/moj-components/',
    ],
    {
      autoescape: true,
      express: app,
    },
  )

  njkEnv.addFilter('initialiseName', initialiseName)
  njkEnv.addFilter('assetMap', (url: string) => assetManifest[url] || url)

  return njkEnv
}
