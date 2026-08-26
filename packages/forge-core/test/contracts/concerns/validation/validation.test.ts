import { describe, expect, it } from 'vitest'

import { validation, Condition, Data, Self } from '../../../../src/authoring'
import type { RequestTraceEvent } from '../../../../src/testing'
import { createClient, type ContractSession } from '../../contractHelpers'
import { runStepCases } from '../../contractRunner'
import { stepScaffold } from '../../stepScaffold'
import { TextField } from '../../testComponents'
import { cases } from './validation.cases'
import ForgeRuntimeEvaluationError, {
  getForgeRuntimeEvaluationDiagnostics,
} from '../../../../src/engine/errors/ForgeRuntimeEvaluationError'
import {
  reachabilityDisabledValidationJourney,
  submissionOnlyChainJourney,
  nonDefaultGroupChainJourney,
  iteratorOnlyChainJourney,
  throwingConditionJourney,
  validateFalseJourney,
  MutateState,
  IdentityValue,
  ArgumentsInOrder,
  EqualsValue,
} from './validation.fixtures'

function requiredField(code: string, message: string) {
  return TextField({
    code,
    validWhen: [
      validation({
        condition: Self().match(Condition.IsRequired()),
        message,
      }),
    ],
  })
}

describe('validation contracts', () => {
  runStepCases(cases)

  it('should attach failures to the rendered field block where components read them', async () => {
    // Arrange
    const scaffold = stepScaffold({ blocks: [requiredField('fullName', 'Enter your full name')] })

    // Act
    const result = await scaffold.submit({ fullName: '' })

    // Assert
    expect(result.type).toBe('render')

    if (result.type === 'render') {
      const field = result.getBlocksByVariant('testTextField')[0]

      expect(field.properties.errors).toEqual([
        expect.objectContaining({ message: 'Enter your full name', passed: false }),
      ])
    }
  })

  it('should not eagerly validate other steps when reachability checks are disabled', async () => {
    // Arrange
    const client = createClient(reachabilityDisabledValidationJourney)
    const session: ContractSession = {
      answers: { 'reach-disabled-validation': { targetDate: '28/09/2026' } },
    }

    // Act
    const result = await client.get('/reach-disabled-validation/start', { session })

    // Assert
    expect(result.type).toBe('render')

    if (result.type === 'render') {
      expect(result.context.step.path).toBe('/start')
      expect(result.context.fieldValidationErrors).toEqual([])
    }
  })

  it('should trace validation failures on GET when validateOnEntry is set', async () => {
    // Arrange
    const traces: RequestTraceEvent[] = []
    const scaffold = stepScaffold({
      blocks: [requiredField('fullName', 'Enter your full name')],
      validateOnEntry: [{ groups: ['default'], when: true }],
      traces,
    })

    // Act
    const result = await scaffold.enter()

    // Assert
    expect(result.type).toBe('render')

    if (result.type === 'render') {
      expect(result.context.showValidationFailures).toBe(true)
      expect(result.getValidationErrorsByFieldCode('fullName')).toEqual([
        expect.objectContaining({ message: 'Enter your full name' }),
      ])

      const validitiesPhase = traces[0].trace.phases.find(p => p.phase === 'validities')

      expect(validitiesPhase?.units).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'validation.step',
            children: expect.arrayContaining([
              expect.objectContaining({
                kind: 'validation.field',
                beginFields: expect.objectContaining({ blockCode: 'fullName' }),
              }),
            ]),
          }),
        ]),
      )
    }
  })

  it('should trace no validation failures on GET without validateOnEntry', async () => {
    // Arrange
    const traces: RequestTraceEvent[] = []
    const scaffold = stepScaffold({
      blocks: [requiredField('fullName', 'Enter your full name')],
      traces,
    })

    // Act
    const result = await scaffold.enter()

    // Assert
    expect(result.type).toBe('render')

    if (result.type === 'render') {
      expect(result.context.showValidationFailures).toBe(false)
      expect(result.context.fieldValidationErrors).toEqual([])

      const entryPhase = traces[0].trace.phases.find(p => p.phase === 'entry-validation')

      expect(entryPhase).toBeDefined()
      expect(entryPhase!.units.filter(u => u.kind === 'validation.step')).toEqual([])
    }
  })

  it('should evaluate nested function arguments from left to right', async () => {
    // Arrange
    const scaffold = stepScaffold({
      blocks: [
        TextField({
          code: 'evaluationOrderTrigger',
          validWhen: [
            validation({
              condition: ArgumentsInOrder(
                MutateState(Data('evaluationOrderState')),
                IdentityValue(Data('evaluationOrderState').path('value')),
                Data('evaluationOrderState'),
              ).match(EqualsValue(true)),
              message: 'Function arguments evaluated out of order',
            }),
          ],
        }),
      ],
    })
    const evaluationOrderState = { value: 'before', observedValues: [] }

    // Act
    const result = await scaffold.submit({ evaluationOrderTrigger: 'submitted' }, { data: { evaluationOrderState } })

    // Assert
    expect(evaluationOrderState.value).toBe('after')
    expect(evaluationOrderState.observedValues).toEqual(['after', 'after'])
    expect(result.type).toBe('redirect')
  })

  it('should keep later steps reachable when a step fails only submissionOnly rules', async () => {
    // Arrange
    const client = createClient(submissionOnlyChainJourney)
    const session: ContractSession = {
      answers: { 'sub-only-chain': { fieldA: 'done', fieldB: 'wrong' } },
    }

    // Act
    const result = await client.get('/sub-only-chain/c', { session })

    // Assert
    // The validities round that feeds reachability skips submissionOnly
    // rules, so b counts as valid and c stays reachable.
    expect(result.type).toBe('render')
  })

  it('should keep later steps reachable when a step fails only non-default-group rules', async () => {
    // Arrange
    const client = createClient(nonDefaultGroupChainJourney)
    const session: ContractSession = {
      answers: { 'grouped-chain': { fieldA: 'done', fieldB: 'wrong' } },
    }

    // Act
    const result = await client.get('/grouped-chain/c', { session })

    // Assert
    // The validities round validates the default group only, so a failure
    // confined to a custom group never gates navigation.
    expect(result.type).toBe('render')
  })

  it('should keep later steps reachable when an earlier step has only iterator-template rules failing', async () => {
    // Arrange
    const client = createClient(iteratorOnlyChainJourney)
    const session: ContractSession = {
      data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
      answers: { 'iterator-only-chain': { fieldA: 'done', memberName_0: '', memberName_1: '' } },
    }

    // Act
    const result = await client.get('/iterator-only-chain/c', { session })

    // Assert
    // Fields inside iterator templates are excluded from the validities
    // round, so b carries no compiled step validation and counts as valid
    // for reachability, even though the same per-item answers fail the
    // same rules when b is submitted directly.
    expect(result.type).toBe('render')
  })

  it('should surface an error outcome with diagnostics when a validation condition throws', async () => {
    // Arrange
    const client = createClient(throwingConditionJourney)

    // Act
    const result = await client.post('/throwing-rule/form', { session: {}, body: { name: 'x' } })

    // Assert
    expect(result.type).toBe('error')

    if (result.type === 'error') {
      expect(result.error).toBeInstanceOf(ForgeRuntimeEvaluationError)
      expect(result.error.message).toBe('Failed to evaluate compiled Forge validation function: condition blew up')
      expect(getForgeRuntimeEvaluationDiagnostics(result.error)).toBeDefined()
    }
  })

  it('should skip validation and redirect when the submit hook sets validate: false', async () => {
    // Arrange
    const client = createClient(validateFalseJourney)
    const session: ContractSession = {}

    // Act
    const result = await client.post('/no-validate/name', {
      session,
      body: { fullName: '' },
    })

    // Assert
    expect(result.type).toBe('redirect')
    expect(session.answers?.['no-validate']?.fullName).toBe('')
  })
})
