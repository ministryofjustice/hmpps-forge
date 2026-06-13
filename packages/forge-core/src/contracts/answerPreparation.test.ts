import { describe, expect, it } from 'vitest'
import type { RequestTraceEvent } from '../testing'
import { createClient, createTracedClient, answerOf, answersFromTrace, type ContractSession } from './contractHelpers'
import {
  storeValuesJourney,
  formattersJourney,
  formattersWithValidationJourney,
  parserJourney,
  defaultValueJourney,
  dependentWhenJourney,
  typeErrorJourney,
  iteratorJourney,
  iteratorFormatJourney,
  iteratorDefaultJourney,
  nestedIteratorJourney,
  checkboxJourney,
  checkboxMultiJourney,
  parserAndFormatterJourney,
  defaultValuePostJourney,
  chainedFormatterTypeErrorJourney,
  defaultWithParserJourney,
  iteratorDependentWhenJourney,
} from './answerPreparation.fixtures'

describe('answer preparation contracts', () => {
  it('should store submitted field values', async () => {
    // Arrange
    const client = createClient(storeValuesJourney)
    const session: ContractSession = {}

    // Act
    await client.post('/store-values/name', { session, body: { fullName: 'Ada Lovelace' } })

    // Assert
    expect(session.answers?.['store-values']?.fullName).toBe('Ada Lovelace')
  })

  it('should run formatters on POST', async () => {
    // Arrange
    const client = createClient(formattersJourney)
    const session: ContractSession = {}

    // Act
    await client.post('/formatters/name', { session, body: { fullName: '  ada lovelace  ' } })

    // Assert
    expect(session.answers?.formatters?.fullName).toBe('Ada Lovelace')
  })

  it('should keep formatted value when validation fails after formatting', async () => {
    // Arrange
    const client = createClient(formattersWithValidationJourney)

    // Act
    const result = await client.post('/format-validate/name', {
      session: {},
      body: { fullName: '  hello  ' },
    })

    // Assert
    expect(result.type).toBe('render')

    if (result.type === 'render') {
      expect(result.context.showValidationFailures).toBe(true)
      expect(answerOf(result.context.answers, 'fullName').current).toBe('hello')
    }
  })

  it('should apply parsers on GET without changing stored answers', async () => {
    // Arrange
    const client = createClient(parserJourney)
    const session: ContractSession = {
      answers: { parsers: { fullName: 'ada lovelace' } },
    }

    // Act
    const result = await client.get('/parsers/name', { session })

    // Assert
    expect(result.type).toBe('render')

    if (result.type === 'render') {
      const answer = answerOf(result.context.answers, 'fullName')

      expect(answer.current).toBe('ada lovelace')
      expect(answer.parsed).toBe('ADA LOVELACE')
    }
  })

  it('should use defaultValue when no answer exists', async () => {
    // Arrange
    const client = createClient(defaultValueJourney)

    // Act
    const result = await client.get('/defaults/country', { session: {} })

    // Assert
    expect(result.type).toBe('render')

    if (result.type === 'render') {
      expect(answerOf(result.context.answers, 'country').current).toBe('United Kingdom')
    }
  })

  it('should clear dependent field answers when dependentWhen is false', async () => {
    // Arrange
    const client = createClient(dependentWhenJourney)
    const session: ContractSession = {
      answers: {
        dependent: {
          contactMethod: 'email',
          emailAddress: 'ada@example.com',
        },
      },
    }

    // Act
    await client.post('/dependent/contact', {
      session,
      body: { contactMethod: 'phone', emailAddress: 'ada@example.com' },
    })

    // Assert
    expect(session.answers?.dependent?.contactMethod).toBe('phone')
    expect(session.answers?.dependent?.emailAddress).toBeUndefined()
  })

  it('should store empty string when submitted', async () => {
    // Arrange
    const client = createClient(storeValuesJourney)
    const session: ContractSession = {}

    // Act
    await client.post('/store-values/name', { session, body: { fullName: '' } })

    // Assert
    expect(session.answers?.['store-values']?.fullName).toBe('')
  })

  it('should not overwrite existing answer with defaultValue on GET', async () => {
    // Arrange
    const client = createClient(defaultValueJourney)
    const session: ContractSession = {
      answers: { defaults: { country: 'France' } },
    }

    // Act
    const result = await client.get('/defaults/country', { session })

    // Assert
    expect(result.type).toBe('render')

    if (result.type === 'render') {
      expect(answerOf(result.context.answers, 'country').current).toBe('France')
    }
  })

  it('should preserve original value when formatter throws TypeError', async () => {
    // Arrange
    const client = createClient(typeErrorJourney)
    const session: ContractSession = {}

    // Act
    await client.post('/type-error/age', { session, body: { age: 'not-a-number' } })

    // Assert
    expect(session.answers?.['type-error']?.age).toBe('not-a-number')
  })

  it('should resolve dynamic field codes per item in an iterator', async () => {
    // Arrange
    const client = createClient(iteratorJourney)
    const session: ContractSession = {
      data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
    }

    // Act
    await client.post('/iterator/members', {
      session,
      body: { memberName_0: 'Alice', memberName_1: 'Bob' },
    })

    // Assert
    expect(session.answers?.iterator?.memberName_0).toBe('Alice')
    expect(session.answers?.iterator?.memberName_1).toBe('Bob')
  })

  it('should run formatters per item in an iterator', async () => {
    // Arrange
    const client = createClient(iteratorFormatJourney)
    const session: ContractSession = {
      data: { members: [{ name: 'a' }, { name: 'b' }] },
    }

    // Act
    await client.post('/iter-format/members', {
      session,
      body: { memberName_0: '  alice  ', memberName_1: '  bob  ' },
    })

    // Assert
    expect(session.answers?.['iter-format']?.memberName_0).toBe('Alice')
    expect(session.answers?.['iter-format']?.memberName_1).toBe('Bob')
  })

  it('should seed defaultValue per item in an iterator on GET', async () => {
    // Arrange
    const client = createClient(iteratorDefaultJourney)
    const session: ContractSession = {
      data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
    }

    // Act
    const result = await client.get('/iter-default/members', { session })

    // Assert
    expect(result.type).toBe('render')

    if (result.type === 'render') {
      expect(answerOf(result.context.answers, 'memberName_0').current).toBe('Ada')
      expect(answerOf(result.context.answers, 'memberName_1').current).toBe('Grace')
    }
  })

  it('should resolve multi-level field codes in nested iterators', async () => {
    // Arrange
    const client = createClient(nestedIteratorJourney)
    const session: ContractSession = {
      data: {
        teams: [
          { name: 'Alpha', members: [{ name: 'Ada' }, { name: 'Grace' }] },
          { name: 'Beta', members: [{ name: 'Linus' }] },
        ],
      },
    }

    // Act
    await client.post('/nested-iter/teams', {
      session,
      body: {
        team_0_member_0: 'Ada',
        team_0_member_1: 'Grace',
        team_1_member_0: 'Linus',
      },
    })

    // Assert
    expect(session.answers?.['nested-iter']?.team_0_member_0).toBe('Ada')
    expect(session.answers?.['nested-iter']?.team_0_member_1).toBe('Grace')
    expect(session.answers?.['nested-iter']?.team_1_member_0).toBe('Linus')
    expect(session.answers?.['nested-iter']?.team_1_member_1).toBeUndefined()
  })

  it('should record a post mutation on plain submission', async () => {
    // Arrange
    const traces: RequestTraceEvent[] = []
    const client = createTracedClient(storeValuesJourney, traces)

    // Act
    await client.post('/store-values/name', { session: {}, body: { fullName: 'Ada' } })

    // Assert
    const answers = answersFromTrace(traces[0])

    expect(answerOf(answers, 'fullName').mutations).toEqual([{ value: 'Ada', source: 'post' }])
  })

  it('should record post and processed mutations when formatters change the value', async () => {
    // Arrange
    const traces: RequestTraceEvent[] = []
    const client = createTracedClient(formattersJourney, traces)

    // Act
    await client.post('/formatters/name', { session: {}, body: { fullName: '  ada lovelace  ' } })

    // Assert
    const answers = answersFromTrace(traces[0])

    expect(answerOf(answers, 'fullName').mutations).toEqual([
      { value: '  ada lovelace  ', source: 'post' },
      { value: 'Ada Lovelace', source: 'processed' },
    ])
  })

  it('should record a default mutation when seeding on GET', async () => {
    // Arrange
    const traces: RequestTraceEvent[] = []
    const client = createTracedClient(defaultValueJourney, traces)

    // Act
    await client.get('/defaults/country', { session: {} })

    // Assert
    const answers = answersFromTrace(traces[0])

    expect(answerOf(answers, 'country').mutations).toEqual([{ value: 'United Kingdom', source: 'default' }])
  })

  it('should record a dependentWhen mutation when condition is false', async () => {
    // Arrange
    const traces: RequestTraceEvent[] = []
    const client = createTracedClient(dependentWhenJourney, traces)
    const session: ContractSession = {
      answers: {
        dependent: {
          contactMethod: 'email',
          emailAddress: 'ada@example.com',
        },
      },
    }

    // Act
    await client.post('/dependent/contact', {
      session,
      body: { contactMethod: 'phone', emailAddress: 'ada@example.com' },
    })

    // Assert
    const answers = answersFromTrace(traces[0])
    const answer = answerOf(answers, 'emailAddress')

    expect(answer.mutations).toEqual([
      { value: 'ada@example.com', source: 'access' },
      { value: 'ada@example.com', source: 'post' },
      { value: undefined, source: 'dependentWhen' },
    ])
    expect(answer.current).toBeUndefined()
  })

  it('should normalize single checkbox value to array', async () => {
    // Arrange
    const client = createClient(checkboxJourney)
    const session: ContractSession = {}

    // Act
    await client.post('/checkbox/preferences', { session, body: { colors: 'red' } })

    // Assert
    expect(session.answers?.checkbox?.colors).toEqual(['red'])
  })

  it('should pass checkbox array values through unchanged', async () => {
    // Arrange
    const client = createClient(checkboxMultiJourney)
    const session: ContractSession = {}

    // Act
    await client.post('/checkbox-multi/preferences', {
      session,
      body: { colors: ['red', 'blue'] },
    })

    // Assert
    expect(session.answers?.['checkbox-multi']?.colors).toEqual(['red', 'blue'])
  })

  it('should run formatters on POST and parsers on GET for the same field', async () => {
    // Arrange
    const client = createClient(parserAndFormatterJourney)
    const session: ContractSession = {}

    // Act
    await client.post('/parser-fmt/name', { session, body: { fullName: '  ada lovelace  ' } })
    const result = await client.get('/parser-fmt/name', { session })

    // Assert
    expect(session.answers?.['parser-fmt']?.fullName).toBe('ada lovelace')

    expect(result.type).toBe('render')

    if (result.type === 'render') {
      const answer = answerOf(result.context.answers, 'fullName')

      expect(answer.current).toBe('ada lovelace')
      expect(answer.parsed).toBe('ADA LOVELACE')
    }
  })

  it('should not apply parsers on POST', async () => {
    // Arrange
    const client = createClient(parserAndFormatterJourney)
    const session: ContractSession = {}

    // Act
    await client.post('/parser-fmt/name', { session, body: { fullName: 'hello' } })

    // Assert
    expect(session.answers?.['parser-fmt']?.fullName).toBe('hello')
  })

  it('should not seed defaultValue on POST', async () => {
    // Arrange
    const client = createClient(defaultValuePostJourney)
    const session: ContractSession = {}

    // Act
    await client.post('/default-post/country', { session, body: {} })

    // Assert
    expect(session.answers?.['default-post']?.country).toBeUndefined()
  })

  it('should revert to original value when a later formatter in the chain throws TypeError', async () => {
    // Arrange
    const client = createClient(chainedFormatterTypeErrorJourney)
    const session: ContractSession = {}

    // Act
    await client.post('/chained-err/value', { session, body: { amount: '  not-a-number  ' } })

    // Assert
    expect(session.answers?.['chained-err']?.amount).toBe('  not-a-number  ')
  })

  it('should apply parser to defaultValue when no answer exists on GET', async () => {
    // Arrange
    const client = createClient(defaultWithParserJourney)

    // Act
    const result = await client.get('/default-parser/name', { session: {} })

    // Assert
    expect(result.type).toBe('render')

    if (result.type === 'render') {
      const answer = answerOf(result.context.answers, 'fullName')

      expect(answer.current).toBe('ada lovelace')
      expect(answer.parsed).toBe('ADA LOVELACE')
    }
  })

  it('should clear iterator field answers when dependentWhen is false', async () => {
    // Arrange
    const client = createClient(iteratorDependentWhenJourney)
    const session: ContractSession = {
      data: { members: [{ name: 'Ada' }, { name: 'Grace' }] },
    }

    // Act
    await client.post('/iter-dep/members', {
      session,
      body: { showDetails: 'no', memberName_0: 'Alice', memberName_1: 'Bob' },
    })

    // Assert
    expect(session.answers?.['iter-dep']?.showDetails).toBe('no')
    expect(session.answers?.['iter-dep']?.memberName_0).toBeUndefined()
    expect(session.answers?.['iter-dep']?.memberName_1).toBeUndefined()
  })
})
