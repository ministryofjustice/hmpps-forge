import * as govukFrontend from 'govuk-frontend'
import nunjucks from 'nunjucks'
import 'virtual:browser-forge-demo-templates'
import { registerForgeGovUKComponentsGlobals } from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  NunjucksBrowserRenderer,
  createBrowserApp,
} from '@ministryofjustice/hmpps-forge/browser'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import { browserDemoPackage } from './journey.mjs'
import { addAnotherPackage } from './journeys/addAnother.mjs'
import { branchingPackage } from './journeys/branching.mjs'

const container = document.getElementById('browser-forge-app')

if (container) {
  const templateEnv = new nunjucks.Environment(undefined, { autoescape: true })

  registerForgeGovUKComponentsGlobals(templateEnv)

  const forge = new Forge({ logger: console })
    .registerPackage(browserDemoPackage)
    .registerPackage(branchingPackage)
    .registerPackage(addAnotherPackage)

  const app = createBrowserApp(forge, {
    renderingEngine: new NunjucksBrowserRenderer({ templateEnv, defaultTemplate: 'browser-app-step' }),
    container,
    onRender: ({ html, container: renderContainer }) => {
      renderContainer.innerHTML = html
      govukFrontend.initAll({ scope: renderContainer })
    },
    onError: ({ error, container: renderContainer }) => {
      console.error(error)
      renderContainer.innerHTML = templateEnv.render('browser-app-error.njk')
      govukFrontend.initAll({ scope: renderContainer })
    },
  })

  app.start({ fallbackPath: '/browser-demo/your-name' })
}
