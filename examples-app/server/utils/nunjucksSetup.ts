import path from 'path'
import nunjucks from 'nunjucks'
import express from 'express'
import fs from 'fs'
import mojFilters from '@ministryofjustice/frontend/moj/filters/all'
import { registerForgeGovUKComponentsGlobals } from '@ministryofjustice/hmpps-forge/govuk-components'
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

  for (const [name, filter] of Object.entries(mojFilters())) {
    njkEnv.addFilter(name, filter)
  }

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

  interface NavNode {
    name: string | undefined
    active: boolean
    items: Record<string, unknown>[]
    children: NavNode[]
  }

  njkEnv.addFilter('buildNavTree', (items: Record<string, unknown>[]) => {
    const root: NavNode = { name: undefined, active: false, items: [], children: [] }

    items.forEach(item => {
      const nav = (item.metadata as Record<string, unknown> | undefined)?.nav as string | undefined
      const isActive = item.active === true

      root.active ||= isActive

      if (!nav) {
        root.items.push(item)

        return
      }

      const target = nav.split('/').reduce((current, segment) => {
        let child = current.children.find(c => c.name === segment)

        if (!child) {
          child = { name: segment, active: false, items: [], children: [] }
          current.children.push(child)
        }

        child.active ||= isActive

        return child
      }, root)

      target.items.push(item)
    })

    return root
  })

  njkEnv.addFilter('injectAfterFirstH1', (block: unknown, htmlToInject: unknown) => {
    const html = String(block)
    const injection = String(htmlToInject)
    const closingTag = '</h1>'
    const index = html.indexOf(closingTag)

    if (index === -1) {
      return injection + html
    }

    const insertAt = index + closingTag.length

    return html.slice(0, insertAt) + injection + html.slice(insertAt)
  })

  registerForgeGovUKComponentsGlobals(njkEnv)

  return njkEnv
}
