import { access, createForgePackage, field, journey, step } from '../../../../src/authoring'
import type { StepDefinition, ValidationExpr } from '../../../../src/authoring'
import { component, type FieldBlockDefinition } from '../../../../src/components'
import { ForgeTestHarness } from '../../../../src/testing'

export const testInput = component<object>('test-input', { render: () => '<input />' })

/** A field variant with a spare display prop, for misplacing expressions outside validWhen. */
export interface TestInputBlock extends FieldBlockDefinition {
  hint?: ValidationExpr
}

export interface StepExtras {
  onAccess?: ReturnType<typeof access>[]
  validWhen?: StepDefinition['validWhen']
}

export function journeyWithFields(fields: ReturnType<typeof field>[], extras: StepExtras = {}) {
  return journey({
    code: 'semantic',
    title: 'Semantic Journey',
    path: '/semantic',
    reachability: { disableReachabilityChecks: true },
    steps: [
      step({
        code: 'step-one',
        title: 'Step One',
        path: '/step-one',
        ...(extras.onAccess ? { onAccess: extras.onAccess } : {}),
        ...(extras.validWhen ? { validWhen: extras.validWhen } : {}),
        blocks: fields,
      }),
    ],
  })
}

export function registerJourney(journeyDefinition: ReturnType<typeof journey>): void {
  new ForgeTestHarness().registerPackage(createForgePackage({ journey: journeyDefinition, components: [testInput] }))
}
