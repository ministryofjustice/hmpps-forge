import { field, journey, step } from '../../../../src/authoring'
import type { FieldBlockDefinition } from '../../../../src/components/types/structures.type'
import { TextField } from '../../testComponents'

export const traceJourney = journey({
  code: 'compilation-trace',
  path: '/compilation-trace',
  title: 'Compilation Trace',
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [TextField({ code: 'name' })],
    }),
  ],
})

/** Fails compilation after the AST is built: the variant has no registered component. */
export const failingJourney = journey({
  code: 'failing-trace',
  path: '/failing-trace',
  title: 'Failing Trace',
  steps: [
    step({
      path: '/name',
      title: 'Name',
      reachability: { entryWhen: true },
      blocks: [field<FieldBlockDefinition & { variant: string }>({ code: 'fullName', variant: 'UnregisteredInput' })],
    }),
  ],
})

/** Two journeys with steps in one package, for per-journey/per-step codegen coverage. */
export const nestedStepsJourney = journey({
  code: 'nested-parent',
  path: '/nested-parent',
  title: 'Nested Parent',
  steps: [step({ code: 'start', path: '/start', title: 'Start', reachability: { entryWhen: true }, blocks: [] })],
  children: [
    journey({
      code: 'nested-child',
      path: '/child',
      title: 'Nested Child',
      steps: [
        step({ code: 'one', path: '/one', title: 'One', reachability: { entryWhen: true }, blocks: [] }),
        step({ code: 'two', path: '/two', title: 'Two', blocks: [] }),
      ],
    }),
  ],
})
