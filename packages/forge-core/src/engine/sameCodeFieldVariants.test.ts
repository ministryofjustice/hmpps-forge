import { describe, expect, it } from 'vitest'
import { Answer, Self, createForgePackage, field, journey, step, submit, validation } from '../authoring/builders'
import { Condition } from '../built-ins/functions/conditions'
import { ForgeTestHarness } from '../testing/ForgeTestHarness'
import type { ComponentRegistryEntry } from '../components/types/components.type'
import type { FieldBlockDefinition } from '../components/types/structures.type'
import type { AnswerHistory } from './chassis/contracts/runtime/answerHistory.type'

/**
 * End-to-end coverage for same-code field variants: one logical field rendered
 * as several copies on one step, each copy owned by a different parent answer
 * via `dependentWhen`. The first active copy in declaration order owns answer
 * preparation and validation; the error summary anchor comes from the
 * component's declared `errorAnchor`, so it targets the failing copy.
 */

interface TestInputDefinition extends FieldBlockDefinition {
  idPrefix?: string
}

const testInputComponent: ComponentRegistryEntry<TestInputDefinition, unknown> = {
  variant: 'test-input',
  render: () => '',
  errorAnchor: props => props.idPrefix ?? props.code,
}

function employedVariant(parentValue: string, idPrefix: string) {
  return field<TestInputDefinition>({
    variant: 'test-input',
    code: 'has_been_employed',
    idPrefix,
    dependentWhen: Answer('employment_status').match(Condition.Equals(parentValue)),
    validWhen: [
      validation({
        condition: Self().match(Condition.IsRequired()),
        message: 'Select whether they have been employed before',
      }),
    ],
  })
}

const testJourney = journey({
  code: 'variants',
  title: 'Variants',
  path: '/variants',
  reachability: { disableReachabilityChecks: true },
  steps: [
    step({
      code: 'employment',
      title: 'Employment',
      path: '/employment',
      onSubmission: [submit({ validate: true })],
      blocks: [
        field({ variant: 'test-input', code: 'employment_status' }),
        employedVariant('unavailable', 'employed-unavailable'),
        employedVariant('actively-seeking', 'employed-actively-seeking'),
        employedVariant('not-actively-seeking', 'employed-not-actively-seeking'),
      ],
    }),
  ],
})

function createClient() {
  return new ForgeTestHarness()
    .registerGlobalComponents([testInputComponent])
    .registerPackage(createForgePackage({ journey: testJourney }))
    .createClient()
}

function answerHistory(answers: Record<string, unknown>, code: string): AnswerHistory {
  return answers[code] as AnswerHistory
}

describe('same-code field variants', () => {
  describe('answer preparation', () => {
    it('should keep the submitted value when the active variant is the first declared', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.post('/variants/employment', {
        session: {},
        body: { employment_status: 'unavailable', has_been_employed: 'yes' },
      })

      // Assert
      if (result.type !== 'render') {
        throw new Error(`Expected a render result, got ${result.type}`)
      }

      expect(answerHistory(result.context.answers, 'has_been_employed').current).toBe('yes')
      expect(result.getValidationErrorsByFieldCode('has_been_employed')).toHaveLength(0)
    })

    it('should clear the answer once when no variant is active', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.post('/variants/employment', {
        session: {},
        body: { employment_status: 'employed', has_been_employed: 'yes' },
      })

      // Assert
      if (result.type !== 'render') {
        throw new Error(`Expected a render result, got ${result.type}`)
      }

      const history = answerHistory(result.context.answers, 'has_been_employed')

      expect(history.current).toBeUndefined()
      expect(history.mutations).toEqual([{ value: undefined, source: 'dependentWhen' }])
    })
  })

  describe('validation and anchors', () => {
    it('should fail only the active variant and anchor the error to its idPrefix', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.post('/variants/employment', {
        session: {},
        body: { employment_status: 'not-actively-seeking' },
      })

      // Assert
      if (result.type !== 'render') {
        throw new Error(`Expected a render result, got ${result.type}`)
      }

      const errors = result.getValidationErrorsByFieldCode('has_been_employed')

      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        message: 'Select whether they have been employed before',
        anchor: 'employed-not-actively-seeking',
      })
    })

    it('should pass validation when the active variant has an answer', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.post('/variants/employment', {
        session: {},
        body: { employment_status: 'actively-seeking', has_been_employed: 'no' },
      })

      // Assert
      if (result.type !== 'render') {
        throw new Error(`Expected a render result, got ${result.type}`)
      }

      expect(result.getValidationErrorsByFieldCode('has_been_employed')).toHaveLength(0)
      expect(answerHistory(result.context.answers, 'has_been_employed').current).toBe('no')
    })
  })
})
