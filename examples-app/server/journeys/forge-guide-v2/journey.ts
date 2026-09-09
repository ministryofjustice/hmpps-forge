import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  journey,
  step,
  access,
  redirect,
  Condition,
  Request,
} from '@ministryofjustice/hmpps-forge/core/authoring'
import { MarkdownSectionFactory } from './MarkdownSectionFactory'
import { loadContentV2 } from './effects'
import { contentBlock } from './contentBlock'

// The content markdown is copied into dist/journeys/forge-guide-v2/content at
// build time (see rolldown/configs.js copyPlugin, which mirrors server/**/*.md
// into dist). The bundle itself sits at dist/server.js, so __dirname is dist/ in
// production and dev (both bundled via rolldown). Unbundled runs (vitest, tsx)
// keep __dirname at this source folder. We probe the likely roots and fall back
// to cwd-based paths for other runners, mirroring sourceReader's shape.
const CONTENT_SUBPATH = join('journeys', 'forge-guide-v2', 'content')

const candidateContentRoots = [
  join(__dirname, 'content'),
  join(__dirname, CONTENT_SUBPATH),
  join(process.cwd(), 'dist', CONTENT_SUBPATH),
  join(process.cwd(), 'server', CONTENT_SUBPATH),
  join(process.cwd(), 'examples-app/dist', CONTENT_SUBPATH),
  join(process.cwd(), 'examples-app/server', CONTENT_SUBPATH),
]

const contentRoot = candidateContentRoots.find(candidate => existsSync(candidate))

if (!contentRoot) {
  throw new Error(
    `Could not locate forge-guide-v2 content root. Tried: ${candidateContentRoots.join(', ')}. ` +
      `Make sure the build copies server/**/*.md into dist (see rolldown/configs.js copyPlugin).`,
  )
}

// TODO: The Learn section returns when the ForgeCon tutorial port lands -
// its stub pages promised chapters that didn't exist yet, so they were pulled.
const getStartedJourney = new MarkdownSectionFactory(join(contentRoot, 'get-started'), {
  code: 'get-started',
  title: 'Get started',
  path: '/get-started',
}).build()

const howToGuidesJourney = new MarkdownSectionFactory(join(contentRoot, 'how-to-guides'), {
  code: 'how-to-guides',
  title: 'How-to guides',
  path: '/how-to-guides',
}).build()

const conceptsJourney = new MarkdownSectionFactory(join(contentRoot, 'concepts'), {
  code: 'concepts',
  title: 'Concepts',
  path: '/concepts',
}).build()

const referenceJourney = new MarkdownSectionFactory(join(contentRoot, 'reference'), {
  code: 'reference',
  title: 'Reference',
  path: '/reference',
}).build()

const patternsJourney = new MarkdownSectionFactory(join(contentRoot, 'patterns'), {
  code: 'patterns',
  title: 'Patterns',
  path: '/patterns',
}).build()

// Hand-authored in code (not generated from a folder) to prove generated and
// hand-authored steps coexist in one journey. Its content still comes from
// home.md via the shared content store.
const homeStep = step({
  path: '/home',
  title: 'Home',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  onAccess: [loadContentV2('home')],
  blocks: [contentBlock],
})

export const forgeGuideV2Journey = journey({
  code: 'forge-guide-v2',
  title: 'Forge guide (v2)',
  path: '/forge-guide-v2',
  view: {
    template: 'partials/guide-step-v2',
  },
  reachability: {
    disableReachabilityChecks: true,
  },
  onAccess: [
    access({
      when: Request.Path().match(Condition.Equals('/forge-guide-v2')),
      next: [redirect({ goto: 'home' })],
    }),
  ],
  children: [
    getStartedJourney,
    howToGuidesJourney,
    conceptsJourney,
    referenceJourney,
    patternsJourney,
  ],
  steps: [homeStep],
})
