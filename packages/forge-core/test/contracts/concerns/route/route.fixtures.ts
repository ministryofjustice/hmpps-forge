import { journey, step, access, submit, redirect, Data, Format, Params } from '../../../../src/authoring'
import type { ResolvableValue } from '../../../../src/authoring/types/expressions.type'
import { Effects } from '../../contractHelpers'
import { TextField, StaticText } from '../../testComponents'

/** A step whose only job is to redirect to `goto` on POST. */
function redirectingStep(code: string, goto: string | ResolvableValue) {
  return step({
    code,
    path: `/${code}`,
    title: code,
    blocks: [],
    onSubmission: [submit({ validate: false, onAlways: { next: [redirect({ goto })] } })],
  })
}

export const redirectTargetJourney = journey({
  code: 'redir',
  path: '/redir',
  title: 'Redirect targets',
  reachability: { disableReachabilityChecks: true },
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    redirectingStep('to-segment', 'done'),
    redirectingStep('to-absolute', '/outside/place'),
    redirectingStep('to-query', '/outside/place?tab=summary'),
    redirectingStep('to-external', 'https://example.com/exit'),
    redirectingStep('to-dynamic', Data('target')),
    redirectingStep('to-dynamic-relative', Data('relativeTarget')),
    redirectingStep('to-query-hash', 'done?from=form#summary'),
    redirectingStep('dot-sibling', './done'),
    redirectingStep('dot-parent', '../done'),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [StaticText({ text: 'Done' })] }),
  ],
})

export const parameterizedJourney = journey({
  code: 'cases',
  path: '/cases/:caseId',
  title: 'Cases',
  steps: [
    step({
      code: 'start',
      path: '/start',
      title: 'Start',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'caseName' })],
      onSubmission: [submit({ validate: false, onAlways: { next: [redirect({ goto: 'next' })] } })],
    }),
    step({
      code: 'template',
      path: '/template',
      title: 'Template',
      reachability: { entryWhen: true },
      blocks: [],
      onSubmission: [submit({ validate: false, onAlways: { next: [redirect({ goto: '/cases/:caseId/next' })] } })],
    }),
    step({ code: 'next', path: '/next', title: 'Next', blocks: [StaticText({ text: 'Next' })] }),
  ],
})

export const basePathJourney = journey({
  code: 'based',
  path: '/based',
  title: 'Based',
  steps: [
    step({
      path: '/start',
      title: 'Start',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'Start' })],
      onSubmission: [submit({ validate: false, onAlways: { next: [redirect({ goto: 'done' })] } })],
    }),
    step({ code: 'done', path: '/done', title: 'Done', blocks: [StaticText({ text: 'Done' })] }),
  ],
})

export const routeTreeJourney = journey({
  code: 'route-tree',
  path: '/route-tree',
  title: 'Route Tree',
  steps: [
    step({
      path: '/step-one',
      title: 'Step One',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'firstName' })],
      onSubmission: [submit({ validate: false, onAlways: { next: [redirect({ goto: 'step-two' })] } })],
    }),
    step({
      code: 'step-two',
      path: '/step-two',
      title: 'Step Two',
      blocks: [TextField({ code: 'lastName' })],
    }),
  ],
})

export const metadataTreeJourney = journey({
  code: 'meta-tree',
  path: '/meta/:caseId',
  title: 'Meta Tree',
  description: 'Journey description',
  metadata: { section: 'testing' },
  onAccess: [access({ effects: [Effects.LoadData()] })],
  steps: [
    step({
      code: 'details',
      path: '/details',
      title: Format('Case %1', Params('caseId')),
      description: 'Case details',
      metadata: { navLabel: Data('navLabel'), hideFromNav: true },
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'Details' })],
    }),
    step({ code: 'plain', path: '/plain', title: 'Plain', blocks: [StaticText({ text: 'Plain' })] }),
  ],
})

export const nestedJourney = journey({
  code: 'parent',
  path: '/parent',
  title: 'Parent',
  steps: [
    step({
      path: '/home',
      title: 'Home',
      reachability: { entryWhen: true },
      blocks: [StaticText({ text: 'Home' })],
    }),
  ],
  children: [
    journey({
      code: 'child',
      path: '/sub',
      title: 'Child',
      steps: [
        step({
          path: '/leaf',
          title: 'Leaf',
          reachability: { entryWhen: true },
          blocks: [StaticText({ text: 'Leaf' })],
        }),
      ],
    }),
  ],
})
