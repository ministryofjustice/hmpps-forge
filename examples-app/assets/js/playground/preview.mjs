import '../../scss/playground-preview.scss'
import qs from 'qs'
import nunjucks from 'nunjucks'
import { Radios } from 'govuk-frontend'
import 'virtual:playground-templates'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import * as authoring from '@ministryofjustice/hmpps-forge/core/authoring'
import * as coreComponents from '@ministryofjustice/hmpps-forge/core/components'
import * as components from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  NunjucksBrowserRenderer,
  createBrowserApp,
} from '@ministryofjustice/hmpps-forge/browser'

class PlaygroundHost {
  constructor(startPath) {
    this.location = new URL(startPath, 'https://playground.invalid')
  }

  getLocation() {
    return { href: this.location.href }
  }
  pushUrl(url) {
    this.location = new URL(url, this.location)
  }
  replaceUrl(url) {
    this.pushUrl(url)
  }
  assign() {
    throw new Error('This example cannot leave the preview')
  }
  subscribe(listener) {
    const submit = (event) => {
      if (!(event.target instanceof HTMLFormElement)) {
        return
      }
      event.preventDefault()
      const fields = Object.create(null)
      new FormData(event.target, event.submitter).forEach((value, key) => {
        fields[key] = key in fields ? [fields[key], value].flat() : value
      })
      // Match Express form parsing for composite inputs such as dateOfBirth[day].
      const body = qs.parse(fields)
      listener({ kind: 'submit', url: `${this.location.pathname}${this.location.search}`, body })
    }
    const follow = (event) => {
      const anchor = event.target.closest?.('a[href]')
      if (!anchor) {
        return
      }
      event.preventDefault()
      const href = anchor.getAttribute('href')
      if (href.startsWith('#')) {
        document.getElementById(href.slice(1))?.focus()
        return
      }
      const url = new URL(href, this.location)
      if (url.origin !== this.location.origin) {
        return
      }
      listener({ kind: 'follow', url: `${url.pathname}${url.search}${url.hash}` })
    }
    document.addEventListener('submit', submit)
    document.addEventListener('click', follow)
    return () => {
      document.removeEventListener('submit', submit)
      document.removeEventListener('click', follow)
    }
  }
}

const parentOrigin = new URL(document.referrer).origin
const container = document.querySelector('main')
const modules = new Map([
  ['@ministryofjustice/hmpps-forge/core/authoring', authoring],
  ['@ministryofjustice/hmpps-forge/core/components', coreComponents],
  ['@ministryofjustice/hmpps-forge/govuk-components', components],
])

function resolveModule(id, importer, sources) {
  if (!id.startsWith('./') && !id.startsWith('../')) {
    return id
  }

  const segments = importer.split('/').slice(1, -1)
  id.split('/').forEach((segment) => {
    if (segment === '.' || segment === '') {
      return
    }
    if (segment === '..') {
      if (!segments.length) {
        throw new Error(`Import leaves the playground: ${id}`)
      }

      segments.pop()
      return
    }

    segments.push(segment)
  })
  const name = `./${segments.join('/')}`.replace(/\.js$/, '')

  return Object.hasOwn(sources, name) ? name : `${name}/index`
}

function loadModule(name, sources) {
  if (modules.has(name)) {
    return modules.get(name)
  }
  if (!Object.hasOwn(sources, name)) {
    throw new Error(`Unsupported import: ${name}`)
  }
  const exports = {}
  modules.set(name, exports)
  // Only the opaque-origin preview evaluates emitted CommonJS modules.
  new Function('require', 'exports', sources[name])((id) => loadModule(resolveModule(id, name, sources), sources), exports)
  return exports
}

async function runExample(event) {
  if (
    event.source !== window.parent ||
    event.origin !== parentOrigin ||
    event.data?.type !== 'run'
  ) {
    return
  }
  const { sources, entryFile, startPath } = event.data
  if (
    typeof entryFile !== 'string' || !entryFile.endsWith('.ts') ||
    typeof startPath !== 'string' || !/^\/(?!\/)/.test(startPath) ||
    !sources ||
    typeof sources !== 'object' ||
    !Object.values(sources).every((source) => typeof source === 'string')
  ) {
    return
  }
  window.removeEventListener('message', runExample)
  try {
    const templateEnv = new nunjucks.Environment(undefined, {
      autoescape: true,
    })
    components.registerForgeGovUKComponentsGlobals(templateEnv)
    const example = loadModule(`./${entryFile.slice(0, -3)}`, sources)
    const forge = new Forge().registerPackage(example.default, example.dependencies)
    const app = createBrowserApp(forge, {
      container,
      host: new PlaygroundHost(startPath),
      renderingEngine: new NunjucksBrowserRenderer({ templateEnv, defaultTemplate: 'playground-step' }),
      onRender: ({ html }) => {
        container.innerHTML = html
        document.body.classList.add('js-enabled', 'govuk-frontend-supported')
        container.querySelectorAll('[data-module="govuk-radios"]').forEach(element => new Radios(element))
        window.parent.postMessage({ type: 'rendered' }, parentOrigin)
      },
      onError: ({ error }) =>
        window.parent.postMessage({ type: 'error', text: error.message }, parentOrigin),
    })
    await app.start({ fallbackPath: startPath })
  } catch (error) {
    window.parent.postMessage(
      { type: 'error', text: error instanceof Error ? error.message : String(error) },
      parentOrigin,
    )
  }
}
window.addEventListener('message', runExample)
window.parent.postMessage({ type: 'ready' }, parentOrigin)
