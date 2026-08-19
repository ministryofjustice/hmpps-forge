import { access, createForgePackage, field, journey, step, submit, validation } from '../../src/authoring'
import { buildComponent } from '../../src/components'
import { ForgeTestHarness } from '../../src/testing'
import type { PredicateExpr } from '../../src/authoring/types/expressions.type'

export const testInput = buildComponent('test-input', () => '<input />')

export function fieldWithRule(code: string, rule: PredicateExpr, message: string) {
  return field({
    variant: 'test-input',
    code,
    validWhen: [validation({ condition: rule, message })],
  })
}

export function journeyWithFields(fields: ReturnType<typeof field>[], onAccess?: ReturnType<typeof access>[]) {
  return journey({
    code: 'entries',
    title: 'Entries Journey',
    path: '/entries',
    reachability: { disableReachabilityChecks: true },
    steps: [
      step({
        code: 'step-one',
        title: 'Step One',
        path: '/step-one',
        ...(onAccess ? { onAccess } : {}),
        onSubmission: [submit({ validate: true })],
        blocks: fields,
      }),
    ],
  })
}

export function createEntriesClient(fields: ReturnType<typeof field>[], onAccess?: ReturnType<typeof access>[]) {
  return new ForgeTestHarness()
    .registerPackage(createForgePackage({ journey: journeyWithFields(fields, onAccess), components: [testInput] }))
    .createClient()
}
