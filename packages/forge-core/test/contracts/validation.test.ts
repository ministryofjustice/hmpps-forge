import { describe, expect, it } from 'vitest'
import { createClient, createTracedClient, type ContractSession } from './contractHelpers'
import type { RequestTraceEvent } from '../../src/testing'
import {
  requiredFieldJourney,
  multipleRulesJourney,
  dependentValidationJourney,
  crossFieldJourney,
  domainValidationJourney,
  submissionOnlyJourney,
  validationGroupsJourney,
  iteratorValidationJourney,
  iteratorMultiRuleJourney,
  iteratorFormatterValidationJourney,
  nestedIteratorValidationJourney,
  formatterThenValidationJourney,
  detailsJourney,
  entryValidationJourney,
  onInvalidBranchJourney,
  validateFalseJourney,
  reachabilityDisabledValidationJourney,
  emptyIteratorJourney,
  andCombinatorJourney,
  orCombinatorJourney,
  notCombinatorJourney,
  xorCombinatorJourney,
  visibleWhenValidationJourney,
  entryDomainValidationJourney,
  entryConditionalWhenFalseJourney,
  sameCodeVariantsJourney,
} from './validation.fixtures'

describe('validation contracts', () => {
  describe('field validation', () => {
    it('should fail validation when required field is empty', async () => {
      // Arrange
      const client = createClient(requiredFieldJourney)

      // Act
      const result = await client.post('/required/name', {
        session: {},
        body: { fullName: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)
        expect(result.getValidationErrorsByFieldCode('fullName')).toEqual([
          expect.objectContaining({ message: 'Enter your full name', passed: false }),
        ])
      }
    })

    it('should attach failures to the rendered field block where components read them', async () => {
      // Arrange
      const client = createClient(requiredFieldJourney)

      // Act
      const result = await client.post('/required/name', {
        session: {},
        body: { fullName: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const field = result.getBlocksByVariant('govukTextInput')[0]

        expect(field.properties.errors).toEqual([
          expect.objectContaining({ message: 'Enter your full name', passed: false }),
        ])
      }
    })

    it('should pass validation and redirect when required field is present', async () => {
      // Arrange
      const client = createClient(requiredFieldJourney)

      // Act
      const result = await client.post('/required/name', {
        session: {},
        body: { fullName: 'Ada Lovelace' },
      })

      // Assert
      expect(result.type).toBe('redirect')
    })

    it('should collect all failing rules, not stop at first', async () => {
      // Arrange
      const client = createClient(multipleRulesJourney)

      // Act
      const result = await client.post('/multi-rules/username', {
        session: {},
        body: { username: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('username')

        expect(errors).toEqual([
          expect.objectContaining({ message: 'Enter a username' }),
          expect.objectContaining({ message: 'Username must be at least 3 characters' }),
        ])
      }
    })

    it('should only fail rules whose conditions are not met', async () => {
      // Arrange
      const client = createClient(multipleRulesJourney)

      // Act
      const result = await client.post('/multi-rules/username', {
        session: {},
        body: { username: 'ab' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('username')

        expect(errors).toEqual([expect.objectContaining({ message: 'Username must be at least 3 characters' })])
      }
    })

    it('should validate formatted value, not raw submission', async () => {
      // Arrange
      const client = createClient(formatterThenValidationJourney)

      // Act
      const result = await client.post('/fmt-valid/name', {
        session: {},
        body: { fullName: '  ab  ' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('fullName')

        expect(errors).toEqual([expect.objectContaining({ message: 'Name must be at least 3 characters' })])
      }
    })

    it('should pass validation when formatted value satisfies rule', async () => {
      // Arrange
      const client = createClient(formatterThenValidationJourney)

      // Act
      const result = await client.post('/fmt-valid/name', {
        session: {},
        body: { fullName: '  Ada  ' },
      })

      // Assert
      expect(result.type).toBe('redirect')
    })

    it('should include details property in validation error', async () => {
      // Arrange
      const client = createClient(detailsJourney)

      // Act
      const result = await client.post('/details/date', {
        session: {},
        body: { dateOfBirth: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('dateOfBirth')

        expect(errors).toEqual([
          expect.objectContaining({
            message: 'Enter your date of birth',
            details: { field: 'day' },
          }),
        ])
      }
    })
  })

  describe('dependentWhen interaction', () => {
    it('should skip validation for hidden dependent fields', async () => {
      // Arrange
      const client = createClient(dependentValidationJourney)

      // Act
      const result = await client.post('/dep-valid/contact', {
        session: {},
        body: { contactMethod: 'phone', emailAddress: '' },
      })

      // Assert
      expect(result.type).toBe('redirect')
    })

    it('should validate visible dependent fields', async () => {
      // Arrange
      const client = createClient(dependentValidationJourney)

      // Act
      const result = await client.post('/dep-valid/contact', {
        session: {},
        body: { contactMethod: 'email', emailAddress: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('emailAddress')

        expect(errors).toEqual([expect.objectContaining({ message: 'Enter an email address' })])
      }
    })
  })

  describe('same-code field variants', () => {
    it('should fail only the active copy and anchor the error to its id', async () => {
      // Arrange
      const client = createClient(sameCodeVariantsJourney)

      // Act
      const result = await client.post('/same-code/employment', {
        session: {},
        body: { employment_status: 'not-actively-seeking' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('has_been_employed')

        expect(errors).toEqual([
          expect.objectContaining({
            message: 'Select whether they have been employed before',
            anchor: 'employed-not-actively-seeking',
          }),
        ])
      }
    })

    it('should pass validation and redirect when the active copy has an answer', async () => {
      // Arrange
      const client = createClient(sameCodeVariantsJourney)

      // Act
      const result = await client.post('/same-code/employment', {
        session: {},
        body: { employment_status: 'actively-seeking', has_been_employed: 'no' },
      })

      // Assert
      expect(result.type).toBe('redirect')
    })
  })

  describe('reachability disabled', () => {
    it('should not eagerly validate other steps', async () => {
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
  })

  describe('cross-field validation', () => {
    it('should validate a field against another field value', async () => {
      // Arrange
      const client = createClient(crossFieldJourney)

      // Act
      const result = await client.post('/cross-field/passwords', {
        session: {},
        body: { password: 'secret', confirmPassword: 'different' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('confirmPassword')

        expect(errors).toEqual([expect.objectContaining({ message: 'Passwords must match' })])
      }
    })

    it('should pass when cross-field values match', async () => {
      // Arrange
      const client = createClient(crossFieldJourney)

      // Act
      const result = await client.post('/cross-field/passwords', {
        session: {},
        body: { password: 'secret', confirmPassword: 'secret' },
      })

      // Assert
      expect(result.type).toBe('redirect')
    })
  })

  describe('domain validation', () => {
    it('should surface step-level validation as domain errors', async () => {
      // Arrange
      const client = createClient(domainValidationJourney)

      // Act
      const result = await client.post('/domain/range', {
        session: {},
        body: { minValue: '10', maxValue: '10' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.domainValidationErrors).toEqual([
          expect.objectContaining({ message: 'Minimum and maximum must be different' }),
        ])
        expect(result.context.fieldValidationErrors).toEqual([])
      }
    })

    it('should pass domain validation when step-level condition is met', async () => {
      // Arrange
      const client = createClient(domainValidationJourney)

      // Act
      const result = await client.post('/domain/range', {
        session: {},
        body: { minValue: '5', maxValue: '10' },
      })

      // Assert
      expect(result.type).toBe('redirect')
    })
  })

  describe('submissionOnly rules', () => {
    it('should skip submissionOnly rules on entry validation', async () => {
      // Arrange
      const client = createClient(submissionOnlyJourney)
      const session: ContractSession = {
        answers: { 'sub-only': { fullName: 'AB' } },
      }

      // Act
      const result = await client.get('/sub-only/name', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)

        const errors = result.getValidationErrorsByFieldCode('fullName')

        expect(errors).toEqual([])
      }
    })

    it('should show only non-submissionOnly failures on entry validation', async () => {
      // Arrange
      const client = createClient(submissionOnlyJourney)
      const session: ContractSession = {
        answers: { 'sub-only': { fullName: '' } },
      }

      // Act
      const result = await client.get('/sub-only/name', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)

        const errors = result.getValidationErrorsByFieldCode('fullName')

        expect(errors).toEqual([expect.objectContaining({ message: 'Enter your full name' })])
      }
    })

    it('should run submissionOnly rules on POST', async () => {
      // Arrange
      const client = createClient(submissionOnlyJourney)

      // Act
      const result = await client.post('/sub-only/name', {
        session: {},
        body: { fullName: 'AB' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('fullName')

        expect(errors).toEqual([expect.objectContaining({ message: 'Name must be at least 3 characters' })])
      }
    })
  })

  describe('validation groups', () => {
    it('should only validate fields in the triggered group', async () => {
      // Arrange
      const client = createClient(validationGroupsJourney)

      // Act
      const result = await client.post('/groups/search', {
        session: {},
        body: { action: 'search', searchQuery: '', filterTag: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const searchErrors = result.getValidationErrorsByFieldCode('searchQuery')
        const filterErrors = result.getValidationErrorsByFieldCode('filterTag')

        expect(searchErrors).toEqual([expect.objectContaining({ message: 'Enter a search term' })])
        expect(filterErrors).toEqual([])
      }
    })

    it('should validate a different group when triggered by its hook', async () => {
      // Arrange
      const client = createClient(validationGroupsJourney)

      // Act
      const result = await client.post('/groups/search', {
        session: {},
        body: { action: 'filter', searchQuery: '', filterTag: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const searchErrors = result.getValidationErrorsByFieldCode('searchQuery')
        const filterErrors = result.getValidationErrorsByFieldCode('filterTag')

        expect(searchErrors).toEqual([])
        expect(filterErrors).toEqual([expect.objectContaining({ message: 'Enter a filter tag' })])
      }
    })
  })

  describe('entry validation', () => {
    it('should show validation failures on GET when validateOnEntry is set', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(entryValidationJourney, traces)

      // Act
      const result = await client.get('/entry-valid/name', {
        session: {},
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)

        const errors = result.getValidationErrorsByFieldCode('fullName')

        expect(errors).toEqual([expect.objectContaining({ message: 'Enter your full name' })])

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

    it('should not show validation failures on GET without validateOnEntry', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(requiredFieldJourney, traces)

      // Act
      const result = await client.get('/required/name', {
        session: {},
      })

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

    it('should produce validation errors on POST for the same journey without validateOnEntry', async () => {
      // Arrange
      const client = createClient(requiredFieldJourney)

      // Act
      const result = await client.post('/required/name', {
        session: {},
        body: { fullName: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)
        expect(result.getValidationErrorsByFieldCode('fullName')).toEqual([
          expect.objectContaining({ message: 'Enter your full name', passed: false }),
        ])
      }
    })

    it('should show domain validation errors on GET when validateOnEntry is set', async () => {
      // Arrange
      const client = createClient(entryDomainValidationJourney)
      const session: ContractSession = {
        answers: { 'entry-domain': { minValue: '10', maxValue: '10' } },
      }

      // Act
      const result = await client.get('/entry-domain/range', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)
        expect(result.context.domainValidationErrors).toEqual([
          expect.objectContaining({ message: 'Minimum and maximum must be different' }),
        ])
        expect(result.context.fieldValidationErrors).toEqual([])
      }
    })

    it('should skip entry validation when validateOnEntry when predicate is false', async () => {
      // Arrange
      const client = createClient(entryConditionalWhenFalseJourney)
      const session: ContractSession = {
        data: { shouldValidate: false },
        answers: { 'entry-cond-false': { fullName: '' } },
      }

      // Act
      const result = await client.get('/entry-cond-false/name', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(false)
        expect(result.context.fieldValidationErrors).toEqual([])
      }
    })

    it('should run entry validation when validateOnEntry when predicate is true', async () => {
      // Arrange
      const client = createClient(entryConditionalWhenFalseJourney)
      const session: ContractSession = {
        data: { shouldValidate: true },
        answers: { 'entry-cond-false': { fullName: '' } },
      }

      // Act
      const result = await client.get('/entry-cond-false/name', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)
        expect(result.context.fieldValidationErrors).toHaveLength(1)
        expect(result.context.fieldValidationErrors[0].message).toBe('Enter your full name')
      }
    })
  })

  describe('iterator validation', () => {
    it('should validate each iterator field independently', async () => {
      // Arrange
      const client = createClient(iteratorValidationJourney)
      const session: ContractSession = {
        data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
      }

      // Act
      const result = await client.post('/iter-valid/members', {
        session,
        body: { memberName_0: 'Alice', memberName_1: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors0 = result.getValidationErrorsByFieldCode('memberName_0')
        const errors1 = result.getValidationErrorsByFieldCode('memberName_1')

        expect(errors0).toEqual([])
        expect(errors1).toEqual([expect.objectContaining({ message: 'Enter a name' })])
      }
    })

    it('should collect multiple failures per iterator field', async () => {
      // Arrange
      const client = createClient(iteratorMultiRuleJourney)
      const session: ContractSession = {
        data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
      }

      // Act
      const result = await client.post('/iter-multi/members', {
        session,
        body: { memberName_0: '', memberName_1: 'A' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors0 = result.getValidationErrorsByFieldCode('memberName_0')
        const errors1 = result.getValidationErrorsByFieldCode('memberName_1')

        expect(errors0).toEqual([
          expect.objectContaining({ message: 'Enter a name' }),
          expect.objectContaining({ message: 'Name must be at least 2 characters' }),
        ])
        expect(errors1).toEqual([expect.objectContaining({ message: 'Name must be at least 2 characters' })])
      }
    })

    it('should validate the formatted value inside an iterator', async () => {
      // Arrange
      const client = createClient(iteratorFormatterValidationJourney)
      const session: ContractSession = {
        data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
      }

      // Act
      const result = await client.post('/iter-fmt-valid/members', {
        session,
        body: { memberName_0: '  ab  ', memberName_1: '  Ada  ' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors0 = result.getValidationErrorsByFieldCode('memberName_0')
        const errors1 = result.getValidationErrorsByFieldCode('memberName_1')

        expect(errors0).toEqual([expect.objectContaining({ message: 'Name must be at least 3 characters' })])
        expect(errors1).toEqual([])
      }
    })

    it('should validate fields in nested iterators independently', async () => {
      // Arrange
      const client = createClient(nestedIteratorValidationJourney)
      const session: ContractSession = {
        data: {
          teams: [
            { name: 'Alpha', members: [{ name: 'Ada' }, { name: 'Grace' }] },
            { name: 'Beta', members: [{ name: 'Linus' }] },
          ],
        },
      }

      // Act
      const result = await client.post('/nested-iter-valid/teams', {
        session,
        body: {
          team_0_member_0: 'Alice',
          team_0_member_1: '',
          team_1_member_0: '',
        },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.getValidationErrorsByFieldCode('team_0_member_0')).toEqual([])
        expect(result.getValidationErrorsByFieldCode('team_0_member_1')).toEqual([
          expect.objectContaining({ message: 'Enter a name' }),
        ])
        expect(result.getValidationErrorsByFieldCode('team_1_member_0')).toEqual([
          expect.objectContaining({ message: 'Enter a name' }),
        ])
      }
    })

    it('should pass when all iterator fields are valid', async () => {
      // Arrange
      const client = createClient(iteratorValidationJourney)
      const session: ContractSession = {
        data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
      }

      // Act
      const result = await client.post('/iter-valid/members', {
        session,
        body: { memberName_0: 'Alice', memberName_1: 'Bob' },
      })

      // Assert
      expect(result.type).toBe('redirect')
    })
  })

  describe('validation result shape', () => {
    it('should include blockCode, passed, message, and submissionOnly in error', async () => {
      // Arrange
      const client = createClient(requiredFieldJourney)

      // Act
      const result = await client.post('/required/name', {
        session: {},
        body: { fullName: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.context.fieldValidationErrors

        expect(errors[0]).toEqual(
          expect.objectContaining({
            blockCode: 'fullName',
            passed: false,
            message: 'Enter your full name',
            submissionOnly: false,
          }),
        )
      }
    })
  })

  describe('onInvalid branch', () => {
    it('should follow onInvalid redirect when validation fails', async () => {
      // Arrange
      const client = createClient(onInvalidBranchJourney)

      // Act
      const result = await client.post('/on-invalid/name', {
        session: {},
        body: { fullName: '' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toContain('/error')
      }
    })

    it('should follow onValid redirect when validation passes', async () => {
      // Arrange
      const client = createClient(onInvalidBranchJourney)

      // Act
      const result = await client.post('/on-invalid/name', {
        session: {},
        body: { fullName: 'Ada' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toContain('/done')
      }
    })
  })

  describe('validate: false', () => {
    it('should skip validation and redirect even when fields are invalid', async () => {
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

  describe('empty iterator collections', () => {
    it('should pass validation when iterator collection is empty', async () => {
      // Arrange
      const client = createClient(emptyIteratorJourney)
      const session: ContractSession = {
        data: { members: [] },
      }

      // Act
      const result = await client.post('/empty-iter/members', {
        session,
        body: {},
      })

      // Assert
      expect(result.type).toBe('redirect')
    })

    it('should fail validation when iterator collection is non-empty and fields are invalid', async () => {
      // Arrange
      const client = createClient(emptyIteratorJourney)
      const session: ContractSession = {
        data: { members: [{ name: 'Ada' }] },
      }

      // Act
      const result = await client.post('/empty-iter/members', {
        session,
        body: { memberName_0: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)

        const errors = result.getValidationErrorsByFieldCode('memberName_0')

        expect(errors).toEqual([expect.objectContaining({ message: 'Enter a name', passed: false })])
      }
    })
  })

  describe('condition combinators', () => {
    it('should fail when and() combinator has any false condition', async () => {
      // Arrange
      const client = createClient(andCombinatorJourney)

      // Act
      const result = await client.post('/and-comb/username', {
        session: {},
        body: { username: 'ab' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('username')

        expect(errors).toEqual([expect.objectContaining({ message: 'Username must be 3-10 characters' })])
      }
    })

    it('should pass when and() combinator has all true conditions', async () => {
      // Arrange
      const client = createClient(andCombinatorJourney)

      // Act
      const result = await client.post('/and-comb/username', {
        session: {},
        body: { username: 'hello' },
      })

      // Assert
      expect(result.type).toBe('redirect')
    })

    it('should pass domain validation when or() combinator has any true condition', async () => {
      // Arrange
      const client = createClient(orCombinatorJourney)

      // Act
      const result = await client.post('/or-comb/contact', {
        session: {},
        body: { email: 'ada@example.com', phone: '' },
      })

      // Assert
      expect(result.type).toBe('redirect')
    })

    it('should fail domain validation when or() combinator has all false conditions', async () => {
      // Arrange
      const client = createClient(orCombinatorJourney)

      // Act
      const result = await client.post('/or-comb/contact', {
        session: {},
        body: { email: '', phone: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.domainValidationErrors).toEqual([
          expect.objectContaining({ message: 'Enter either an email or phone number' }),
        ])
      }
    })

    it('should fail when not() negates a true condition', async () => {
      // Arrange
      const client = createClient(notCombinatorJourney)

      // Act
      const result = await client.post('/not-comb/value', {
        session: {},
        body: { keyword: 'forbidden' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('keyword')

        expect(errors).toEqual([expect.objectContaining({ message: 'Cannot use forbidden value' })])
      }
    })

    it('should pass when not() negates a false condition', async () => {
      // Arrange
      const client = createClient(notCombinatorJourney)

      // Act
      const result = await client.post('/not-comb/value', {
        session: {},
        body: { keyword: 'allowed' },
      })

      // Assert
      expect(result.type).toBe('redirect')
    })

    it('should pass when xor() has exactly one true condition', async () => {
      // Arrange
      const client = createClient(xorCombinatorJourney)

      // Act
      const result = await client.post('/xor-comb/contact', {
        session: {},
        body: { email: 'ada@example.com', phone: '' },
      })

      // Assert
      expect(result.type).toBe('redirect')
    })

    it('should fail when xor() has all true conditions', async () => {
      // Arrange
      const client = createClient(xorCombinatorJourney)

      // Act
      const result = await client.post('/xor-comb/contact', {
        session: {},
        body: { email: 'ada@example.com', phone: '07700900000' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.domainValidationErrors).toEqual([
          expect.objectContaining({ message: 'Enter either email or phone, but not both' }),
        ])
      }
    })

    it('should fail when xor() has no true conditions', async () => {
      // Arrange
      const client = createClient(xorCombinatorJourney)

      // Act
      const result = await client.post('/xor-comb/contact', {
        session: {},
        body: { email: '', phone: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.domainValidationErrors).toEqual([
          expect.objectContaining({ message: 'Enter either email or phone, but not both' }),
        ])
      }
    })
  })

  describe('visibleWhen and validation', () => {
    it('should still run validation for fields hidden by visibleWhen', async () => {
      // Arrange
      const client = createClient(visibleWhenValidationJourney)

      // Act
      const result = await client.post('/visible-valid/form', {
        session: {},
        body: { hiddenField: '' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)

        const errors = result.getValidationErrorsByFieldCode('hiddenField')

        expect(errors).toEqual([expect.objectContaining({ message: 'This field is required' })])
      }
    })
  })
})
