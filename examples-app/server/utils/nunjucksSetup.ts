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
  locals.applicationName = 'Forge Developer Guide'
  locals.environmentName = config.environmentName

  let assetManifest: Record<string, string> = {}

  try {
    const paths = [
      path.join(__dirname, 'assets/manifest.json'),
      path.join(process.cwd(), 'dist/assets/manifest.json'),
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
      path.join(__dirname, 'views'),
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
  njkEnv.addFilter('groupByMetadata', (items: Record<string, unknown>[], key: string) => {
    const groups: { name: string | undefined; items: Record<string, unknown>[] }[] = []
    const groupMap = new Map<string | undefined, Record<string, unknown>[]>()

    for (const item of items) {
      const groupName = (item.metadata as Record<string, unknown> | undefined)?.[key] as
        | string
        | undefined
      const existing = groupMap.get(groupName)

      if (existing) {
        existing.push(item)
      } else {
        const newItems = [item]

        groupMap.set(groupName, newItems)
        groups.push({ name: groupName, items: newItems })
      }
    }

    return groups
  })

  interface ValidationError {
    message: string
    blockCode?: string
  }

  njkEnv.addGlobal(
    'toErrorList',
    (fieldErrors?: ValidationError[], domainErrors?: ValidationError[]) => {
      const allErrors = [...(domainErrors ?? []), ...(fieldErrors ?? [])]
      const seen = new Set<string>()

      return allErrors.flatMap((error): { text: string; href?: string }[] => {
        const key = error.blockCode ?? error.message

        if (seen.has(key)) {
          return []
        }

        seen.add(key)

        return [
          error.blockCode
            ? { text: error.message, href: `#${error.blockCode}` }
            : { text: error.message },
        ]
      })
    },
  )

  return njkEnv
}
