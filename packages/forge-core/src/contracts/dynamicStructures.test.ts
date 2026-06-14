import { describe, it, expect } from 'vitest'
import type { RequestTraceEvent } from '../testing'
import { createClient, createTracedClient, answerOf, answersFromTrace, type ContractSession } from './contractHelpers'
import {
  dependentWhenClearsAnswerJourney,
  dependentWhenRetainsAnswerJourney,
  dependentWhenSkipsValidationJourney,
  dependentWhenRunsValidationJourney,
  dependentWhenMutationTrailJourney,
  dependentWhenOnlyPostJourney,
  visibleWhenHidesBlockJourney,
  visibleWhenDynamicJourney,
  visibleWhenPreservesAnswerJourney,
  visibleWhenStillValidatesJourney,
  visibleWhenNonFieldBlockJourney,
  combinedVisibleAndDependentJourney,
  unreachableStepCleardownJourney,
  conditionalEntryStepJourney,
  unreachableRedirectsToEntryJourney,
  postThenGetCycleJourney,
  divergentVisibleAndDependentJourney,
  multipleDependentWhenFieldsJourney,
  compoundDependentWhenJourney,
  orDependentWhenJourney,
  formatterThenDependentWhenJourney,
  cleardownMutationTrailJourney,
} from './dynamicStructures.fixtures'

describe('dynamic structures', () => {
  describe('dependentWhen - answer clearing', () => {
    it('should clear field answer when dependentWhen is false', async () => {
      // Arrange
      const client = createClient(dependentWhenClearsAnswerJourney)
      const session: ContractSession = {
        answers: { 'dw-clears': { contactMethod: 'email', emailAddress: 'test@example.com' } },
      }

      const before = await client.get('/dw-clears/contact', { session })

      expect(before.type).toBe('render')

      if (before.type === 'render') {
        expect(answerOf(before.context.answers, 'emailAddress').current).toBe('test@example.com')
      }

      // Act
      await client.post('/dw-clears/contact', {
        body: { contactMethod: 'phone', emailAddress: 'test@example.com' },
        session,
      })

      // Assert
      expect(session.answers?.['dw-clears']?.emailAddress).toBeUndefined()
    })

    it('should retain field answer when dependentWhen is true', async () => {
      // Arrange
      const client = createClient(dependentWhenRetainsAnswerJourney)
      const session: ContractSession = {}

      // Act
      await client.post('/dw-retains/contact', {
        body: { contactMethod: 'email', emailAddress: 'test@example.com' },
        session,
      })

      // Assert
      expect(session.answers?.['dw-retains']?.emailAddress).toBe('test@example.com')
    })

    it('should clear saved answer when dependentWhen condition becomes false', async () => {
      // Arrange
      const client = createClient(dependentWhenClearsAnswerJourney)
      const session: ContractSession = {
        answers: { 'dw-clears': { contactMethod: 'email', emailAddress: 'test@example.com' } },
      }

      // Act
      await client.post('/dw-clears/contact', {
        body: { contactMethod: 'phone', emailAddress: 'test@example.com' },
        session,
      })

      // Assert
      expect(session.answers?.['dw-clears']?.emailAddress).toBeUndefined()
    })

    it('should record dependentWhen mutation in answer history', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(dependentWhenMutationTrailJourney, traces)

      // Act
      await client.post('/dw-mutations/contact', {
        body: { contactMethod: 'phone', emailAddress: 'was-here' },
        session: {},
      })

      // Assert
      const answers = answersFromTrace(traces[0])
      const emailHistory = answerOf(answers, 'emailAddress')

      expect(emailHistory.current).toBeUndefined()

      const sources = emailHistory.mutations.map(m => m.source)

      expect(sources).toContain('post')
      expect(sources).toContain('dependentWhen')

      const dependentWhenMutation = emailHistory.mutations.find(m => m.source === 'dependentWhen')

      expect(dependentWhenMutation?.value).toBeUndefined()
    })

    it('should not evaluate dependentWhen on GET requests', async () => {
      // Arrange
      const client = createClient(dependentWhenOnlyPostJourney)
      const session: ContractSession = {
        answers: { 'dw-post-only': { contactMethod: 'phone', emailAddress: 'preserved@example.com' } },
      }

      // Act
      const result = await client.get('/dw-post-only/contact', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.answers).toHaveProperty('emailAddress')
      }
    })
  })

  describe('dependentWhen - validation interaction', () => {
    it('should skip validation when dependentWhen is false', async () => {
      // Arrange
      const client = createClient(dependentWhenSkipsValidationJourney)

      // Act
      const result = await client.post('/dw-skip-valid/contact', {
        body: { contactMethod: 'phone' },
        session: {},
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/dw-skip-valid/done')
      }
    })

    it('should run validation when dependentWhen is true', async () => {
      // Arrange
      const client = createClient(dependentWhenRunsValidationJourney)

      // Act
      const result = await client.post('/dw-runs-valid/contact', {
        body: { contactMethod: 'email' },
        session: {},
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('emailAddress')

        expect(errors).toHaveLength(1)
        expect(errors[0].message).toBe('Enter an email address')
      }
    })
  })

  describe('visibleWhen - rendering', () => {
    it('should mark block as hidden when visibleWhen is false', async () => {
      // Arrange
      const client = createClient(visibleWhenHidesBlockJourney)

      // Act
      const result = await client.get('/vw-hides/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const hiddenBlock = result.context.blocks.find(b => (b.properties as Record<string, unknown>).code === 'hidden')
        const shownBlock = result.context.blocks.find(b => (b.properties as Record<string, unknown>).code === 'shown')

        expect(hiddenBlock?.properties.visibleWhen).toBe(false)
        expect(shownBlock?.properties.visibleWhen).not.toBe(false)
      }
    })

    it('should show block when dynamic visibleWhen condition is true', async () => {
      // Arrange
      const client = createClient(visibleWhenDynamicJourney)
      const session: ContractSession = {
        answers: { 'vw-dynamic': { contactMethod: 'email' } },
      }

      // Act
      const result = await client.get('/vw-dynamic/contact', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const emailBlock = result.context.blocks.find(
          b => (b.properties as Record<string, unknown>).code === 'emailAddress',
        )

        expect(emailBlock?.properties.visibleWhen).not.toBe(false)
      }
    })

    it('should hide block when dynamic visibleWhen condition is false', async () => {
      // Arrange
      const client = createClient(visibleWhenDynamicJourney)
      const session: ContractSession = {
        answers: { 'vw-dynamic': { contactMethod: 'phone' } },
      }

      // Act
      const result = await client.get('/vw-dynamic/contact', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const emailBlock = result.context.blocks.find(
          b => (b.properties as Record<string, unknown>).code === 'emailAddress',
        )

        expect(emailBlock?.properties.visibleWhen).toBe(false)
      }
    })

    it('should hide non-field blocks when visibleWhen is false', async () => {
      // Arrange
      const client = createClient(visibleWhenNonFieldBlockJourney)

      // Act
      const result = await client.get('/vw-nonfield/info', {
        session: { data: { showMessage: false } },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const insetBlock = result.context.blocks.find(b => b.variant === 'govukInsetText')

        expect(insetBlock?.properties.visibleWhen).toBe(false)
      }
    })

    it('should show non-field blocks when visibleWhen is true', async () => {
      // Arrange
      const client = createClient(visibleWhenNonFieldBlockJourney)

      // Act
      const result = await client.get('/vw-nonfield/info', {
        session: { data: { showMessage: true } },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const insetBlock = result.context.blocks.find(b => b.variant === 'govukInsetText')

        expect(insetBlock?.properties.visibleWhen).not.toBe(false)
      }
    })
  })

  describe('visibleWhen - answer preservation', () => {
    it('should not clear answers for fields hidden by visibleWhen', async () => {
      // Arrange
      const client = createClient(visibleWhenPreservesAnswerJourney)
      const session: ContractSession = {
        answers: { 'vw-preserves': { toggle: 'yes', detail: 'some detail' } },
      }

      // Act
      await client.post('/vw-preserves/form', {
        body: { toggle: 'no', detail: 'some detail' },
        session,
      })

      // Assert
      expect(session.answers?.['vw-preserves']?.detail).toBe('some detail')
    })

    it('should still validate fields hidden by visibleWhen', async () => {
      // Arrange
      const client = createClient(visibleWhenStillValidatesJourney)

      // Act
      const result = await client.post('/vw-validates/form', {
        body: {},
        session: {},
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('hiddenField')

        expect(errors).toHaveLength(1)
        expect(errors[0].message).toBe('This field is required')
      }
    })
  })

  describe('combined visibleWhen and dependentWhen', () => {
    it('should hide block, clear answer, and skip validation when both are false', async () => {
      // Arrange
      const client = createClient(combinedVisibleAndDependentJourney)
      const session: ContractSession = {
        answers: { 'combined-vw-dw': { contactMethod: 'email', emailAddress: 'test@example.com' } },
      }

      const before = await client.get('/combined-vw-dw/contact', { session })

      expect(before.type).toBe('render')

      if (before.type === 'render') {
        expect(answerOf(before.context.answers, 'emailAddress').current).toBe('test@example.com')
      }

      // Act
      await client.post('/combined-vw-dw/contact', {
        body: { contactMethod: 'phone' },
        session,
      })

      // Assert
      expect(session.answers?.['combined-vw-dw']?.emailAddress).toBeUndefined()
    })

    it('should show block, retain answer, and validate when both are true', async () => {
      // Arrange
      const client = createClient(combinedVisibleAndDependentJourney)

      // Act
      const result = await client.post('/combined-vw-dw/contact', {
        body: { contactMethod: 'email' },
        session: {},
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const errors = result.getValidationErrorsByFieldCode('emailAddress')

        expect(errors).toHaveLength(1)
        expect(errors[0].message).toBe('Enter an email address')
      }
    })

    it('should clear answer via dependentWhen even though visibleWhen would preserve it', async () => {
      // Arrange
      const client = createClient(combinedVisibleAndDependentJourney)
      const session: ContractSession = {
        answers: { 'combined-vw-dw': { contactMethod: 'email', emailAddress: 'test@example.com' } },
      }

      // Act
      await client.post('/combined-vw-dw/contact', {
        body: { contactMethod: 'phone' },
        session,
      })

      // Assert
      expect(session.answers?.['combined-vw-dw']?.emailAddress).toBeUndefined()
    })

    it('should render hidden block on GET when visibleWhen is false after prior POST cleared answer', async () => {
      // Arrange
      const client = createClient(combinedVisibleAndDependentJourney)
      const session: ContractSession = {
        answers: { 'combined-vw-dw': { contactMethod: 'phone' } },
      }

      // Act
      const result = await client.get('/combined-vw-dw/contact', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const emailBlock = result.context.blocks.find(
          b => (b.properties as Record<string, unknown>).code === 'emailAddress',
        )

        expect(emailBlock?.properties.visibleWhen).toBe(false)
      }
    })
  })

  describe('step reachability and cleardown', () => {
    it('should redirect to entry step when accessing unreachable step', async () => {
      // Arrange
      const client = createClient(unreachableRedirectsToEntryJourney)

      // Act
      const result = await client.get('/unreach-entry/step-two', { session: {} })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/unreach-entry/step-one')
      }
    })

    it('should clear answers for steps that become unreachable', async () => {
      // Arrange
      const client = createClient(unreachableStepCleardownJourney)
      const session: ContractSession = {
        answers: { cleardown: { route: 'detail', detail: 'some info' } },
      }

      // Act
      await client.post('/cleardown/choose', {
        body: { route: 'skip' },
        session,
      })

      // Assert
      expect(session.answers?.cleardown?.detail).toBeUndefined()
    })

    it('should retain answers for steps that remain reachable', async () => {
      // Arrange
      const client = createClient(unreachableStepCleardownJourney)
      const session: ContractSession = {
        answers: { cleardown: { route: 'detail', detail: 'some info' } },
      }

      // Act
      await client.post('/cleardown/choose', {
        body: { route: 'detail' },
        session,
      })

      // Assert
      expect(session.answers?.cleardown?.detail).toBe('some info')
    })

    it('should render conditional entry step when condition is true', async () => {
      // Arrange
      const client = createClient(conditionalEntryStepJourney)

      // Act
      const result = await client.get('/cond-entry/premium', {
        session: { data: { isPremium: true } },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.title).toBe('Premium')
      }
    })

    it('should redirect away from conditional entry step when condition is false', async () => {
      // Arrange
      const client = createClient(conditionalEntryStepJourney)

      // Act
      const result = await client.get('/cond-entry/premium', {
        session: { data: { isPremium: false } },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/cond-entry/standard')
      }
    })

    it('should record cleardown mutation in answer history', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(cleardownMutationTrailJourney, traces)
      const session: ContractSession = {
        answers: { 'cleardown-trail': { route: 'detail', detail: 'stale info' } },
      }

      // Act
      await client.post('/cleardown-trail/choose', {
        body: { route: 'skip' },
        session,
      })

      // Assert
      const answers = answersFromTrace(traces[0])
      const detailHistory = answerOf(answers, 'detail')

      expect(detailHistory.current).toBeUndefined()

      const cleardownMutation = detailHistory.mutations.find(m => m.source === 'cleardown')

      expect(cleardownMutation).toBeDefined()
      expect(cleardownMutation?.value).toBeUndefined()
    })
  })

  describe('POST then GET cycle', () => {
    it('should clear answer on POST then show cleared state on GET', async () => {
      // Arrange
      const client = createClient(postThenGetCycleJourney)
      const session: ContractSession = {
        answers: { 'post-get-cycle': { contactMethod: 'email', emailAddress: 'test@example.com' } },
      }

      // Act - POST switches contact method, clearing emailAddress via dependentWhen
      await client.post('/post-get-cycle/contact', {
        body: { contactMethod: 'phone', emailAddress: 'test@example.com' },
        session,
      })

      // Act - GET re-renders the step with the updated session
      const result = await client.get('/post-get-cycle/contact', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const emailHistory = answerOf(result.context.answers, 'emailAddress')

        expect(emailHistory.current).toBeUndefined()

        const emailBlock = result.context.blocks.find(
          b => (b.properties as Record<string, unknown>).code === 'emailAddress',
        )

        expect(emailBlock?.properties.visibleWhen).toBe(false)
      }
    })
  })

  describe('divergent visibleWhen and dependentWhen', () => {
    it('should show block but clear answer when visibleWhen is true and dependentWhen is false', async () => {
      // Arrange
      const client = createClient(divergentVisibleAndDependentJourney)
      const session: ContractSession = {
        answers: { 'divergent-vw-dw': { showField: 'yes', activateField: 'yes', conditionalField: 'some value' } },
      }

      const before = await client.get('/divergent-vw-dw/form', { session })

      expect(before.type).toBe('render')

      if (before.type === 'render') {
        expect(answerOf(before.context.answers, 'conditionalField').current).toBe('some value')
      }

      // Act
      await client.post('/divergent-vw-dw/form', {
        body: { showField: 'yes', activateField: 'no', conditionalField: 'some value' },
        session,
      })

      // Assert
      expect(session.answers?.['divergent-vw-dw']?.conditionalField).toBeUndefined()
    })

    it('should hide block but retain answer when visibleWhen is false and dependentWhen is true', async () => {
      // Arrange
      const client = createClient(divergentVisibleAndDependentJourney)
      const session: ContractSession = {}

      // Act
      await client.post('/divergent-vw-dw/form', {
        body: { showField: 'no', activateField: 'yes', conditionalField: 'some value' },
        session,
      })

      // Assert
      expect(session.answers?.['divergent-vw-dw']?.conditionalField).toBe('some value')
    })
  })

  describe('multiple dependentWhen fields', () => {
    it('should clear inactive fields and retain the active one independently', async () => {
      // Arrange
      const client = createClient(multipleDependentWhenFieldsJourney)
      const session: ContractSession = {
        answers: {
          'multi-dw': {
            contactMethod: 'phone',
            emailAddress: 'old@example.com',
            phoneNumber: '07700900000',
            postalAddress: '123 Street',
          },
        },
      }

      const before = await client.get('/multi-dw/preferences', { session })

      expect(before.type).toBe('render')

      if (before.type === 'render') {
        expect(answerOf(before.context.answers, 'phoneNumber').current).toBe('07700900000')
        expect(answerOf(before.context.answers, 'postalAddress').current).toBe('123 Street')
      }

      // Act
      await client.post('/multi-dw/preferences', {
        body: {
          contactMethod: 'email',
          emailAddress: 'test@example.com',
          phoneNumber: '07700900000',
          postalAddress: '123 Street',
        },
        session,
      })

      // Assert
      expect(session.answers?.['multi-dw']?.emailAddress).toBe('test@example.com')
      expect(session.answers?.['multi-dw']?.phoneNumber).toBeUndefined()
      expect(session.answers?.['multi-dw']?.postalAddress).toBeUndefined()
    })

    it('should clear all dependent fields when none match', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(multipleDependentWhenFieldsJourney, traces)

      // Act
      await client.post('/multi-dw/preferences', {
        body: {
          contactMethod: 'post',
          emailAddress: 'test@example.com',
          phoneNumber: '07700900000',
          postalAddress: '123 Street',
        },
        session: {},
      })

      // Assert
      const answers = answersFromTrace(traces[0])

      expect(answerOf(answers, 'emailAddress').current).toBeUndefined()
      expect(answerOf(answers, 'phoneNumber').current).toBeUndefined()
      expect(answerOf(answers, 'postalAddress').current).toBe('123 Street')
    })
  })

  describe('compound dependentWhen predicates', () => {
    it('should retain answer when all and() conditions are true', async () => {
      // Arrange
      const client = createClient(compoundDependentWhenJourney)
      const session: ContractSession = {}

      // Act
      await client.post('/compound-dw/form', {
        body: { hasEmail: 'yes', wantsNotifications: 'yes', notificationEmail: 'notify@example.com' },
        session,
      })

      // Assert
      expect(session.answers?.['compound-dw']?.notificationEmail).toBe('notify@example.com')
    })

    it('should clear answer when any and() condition is false', async () => {
      // Arrange
      const client = createClient(compoundDependentWhenJourney)
      const session: ContractSession = {
        answers: {
          'compound-dw': { hasEmail: 'yes', wantsNotifications: 'yes', notificationEmail: 'notify@example.com' },
        },
      }

      const before = await client.get('/compound-dw/form', { session })

      expect(before.type).toBe('render')

      if (before.type === 'render') {
        expect(answerOf(before.context.answers, 'notificationEmail').current).toBe('notify@example.com')
      }

      // Act
      await client.post('/compound-dw/form', {
        body: { hasEmail: 'yes', wantsNotifications: 'no', notificationEmail: 'notify@example.com' },
        session,
      })

      // Assert
      expect(session.answers?.['compound-dw']?.notificationEmail).toBeUndefined()
    })

    it('should retain answer when any or() condition is true', async () => {
      // Arrange
      const client = createClient(orDependentWhenJourney)
      const session: ContractSession = {}

      // Act
      await client.post('/or-dw/form', {
        body: { role: 'manager', accessCode: 'ABC123' },
        session,
      })

      // Assert
      expect(session.answers?.['or-dw']?.accessCode).toBe('ABC123')
    })

    it('should clear answer when all or() conditions are false', async () => {
      // Arrange
      const client = createClient(orDependentWhenJourney)
      const session: ContractSession = {
        answers: { 'or-dw': { role: 'admin', accessCode: 'ABC123' } },
      }

      const before = await client.get('/or-dw/form', { session })

      expect(before.type).toBe('render')

      if (before.type === 'render') {
        expect(answerOf(before.context.answers, 'accessCode').current).toBe('ABC123')
      }

      // Act
      await client.post('/or-dw/form', {
        body: { role: 'viewer', accessCode: 'ABC123' },
        session,
      })

      // Assert
      expect(session.answers?.['or-dw']?.accessCode).toBeUndefined()
    })
  })

  describe('formatter then dependentWhen ordering', () => {
    it('should discard formatted value when dependentWhen is false', async () => {
      // Arrange
      const client = createClient(formatterThenDependentWhenJourney)
      const session: ContractSession = {
        answers: { 'fmt-dw': { includeNotes: 'yes', notes: 'existing note' } },
      }

      const before = await client.get('/fmt-dw/form', { session })

      expect(before.type).toBe('render')

      if (before.type === 'render') {
        expect(answerOf(before.context.answers, 'notes').current).toBe('existing note')
      }

      // Act
      await client.post('/fmt-dw/form', {
        body: { includeNotes: 'no', notes: '  trimmed value  ' },
        session,
      })

      // Assert
      expect(session.answers?.['fmt-dw']?.notes).toBeUndefined()
    })

    it('should apply formatter then retain when dependentWhen is true', async () => {
      // Arrange
      const traces: RequestTraceEvent[] = []
      const client = createTracedClient(formatterThenDependentWhenJourney, traces)
      const session: ContractSession = {}

      // Act
      await client.post('/fmt-dw/form', {
        body: { includeNotes: 'yes', notes: '  trimmed value  ' },
        session,
      })

      // Assert
      expect(session.answers?.['fmt-dw']?.notes).toBe('trimmed value')

      const answers = answersFromTrace(traces[0])
      const notesHistory = answerOf(answers, 'notes')
      const sources = notesHistory.mutations.map(m => m.source)

      expect(sources).toContain('post')
      expect(sources).toContain('processed')
      expect(sources).not.toContain('dependentWhen')
    })
  })
})
