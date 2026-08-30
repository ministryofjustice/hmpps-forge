import { describe, expect, it } from 'vitest'

import { createClient, type ContractSession } from '../../contractHelpers'
import { runJourneyCases, runStepCases } from '../../contractRunner'
import { journeyCases, stepCases } from './references.cases'
import {
  crossStepAnswerJourney,
  requestMetadataJourney,
  selfOutsideValidationJourney,
  storedAnswerJourney,
} from './references.fixtures'

describe('reference contracts', () => {
  runJourneyCases(journeyCases)
  runStepCases(stepCases)

  describe('stored answer reads outside submit hooks', () => {
    it('should resolve Answer() on GET to the answer stored in the session', async () => {
      // Arrange
      const client = createClient(storedAnswerJourney)
      const session: ContractSession = { answers: { 'ref-stored': { name: 'Jo' } } }

      // Act
      const result = await client.get('/ref-stored/display', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.getBlocksByVariant('testStaticText')[0]?.properties.text).toBe('Jo')
      }
    })

    it('should resolve Answer() in a block property to an answer stored by an earlier step', async () => {
      // Arrange
      const client = createClient(crossStepAnswerJourney)
      const session: ContractSession = {}

      // Act
      const submitted = await client.post('/ref-cross-step/first', { session, body: { name: 'Ada' } })
      const result = await client.get('/ref-cross-step/second', { session })

      // Assert
      expect(submitted.type).toBe('redirect')
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.getBlocksByVariant('testStaticText')[0]?.properties.text).toBe('Ada')
      }
    })
  })

  // Self() is not confined to validWhen: the resolve compiler binds it for
  // every field property, so a field's visibleWhen can read the field's own
  // stored answer. A hidden block stays in the render context with
  // `visibleWhen: false` and none of its remaining properties materialised.
  describe('Self() outside validWhen', () => {
    it('should resolve Self() in a field visibleWhen to the declaring field answer', async () => {
      // Arrange
      const client = createClient(selfOutsideValidationJourney)
      const session: ContractSession = { answers: { 'ref-self-visible': { secret: 'show' } } }

      // Act
      const result = await client.get('/ref-self-visible/form', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const [field] = result.getBlocksByVariant('testTextField')

        expect(field?.properties.visibleWhen).toBe(true)
        expect(field?.properties.value).toBe('show')
      }
    })

    it('should mark the field hidden without materialising props when the Self() visibleWhen answer does not match', async () => {
      // Arrange
      const client = createClient(selfOutsideValidationJourney)
      const session: ContractSession = { answers: { 'ref-self-visible': { secret: 'hide' } } }

      // Act
      const result = await client.get('/ref-self-visible/form', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        const [field] = result.getBlocksByVariant('testTextField')

        expect(field?.properties.visibleWhen).toBe(false)
        expect(field?.properties).not.toHaveProperty('value')
      }
    })
  })

  describe('request metadata references', () => {
    it('should resolve Request.Url(), Request.Path() and Request.Method() from the request line', async () => {
      // Arrange
      const client = createClient(requestMetadataJourney)

      // Act
      const result = await client.get('/ref-request/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.capturedUrl).toBe('http://localhost/ref-request/form')
        expect(result.context.data.capturedPath).toBe('/ref-request/form')
        expect(result.context.data.capturedMethod).toBe('GET')
      }
    })

    it('should resolve Request.Headers() by lowercased name when the header is sent with mixed casing', async () => {
      // Arrange
      const client = createClient(requestMetadataJourney)

      // Act
      const result = await client.get('/ref-request/form', {
        session: {},
        headers: { 'X-Client': 'forge-tests' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.capturedHeader).toBe('forge-tests')
      }
    })

    it('should resolve Request.Cookies() from the named request cookie', async () => {
      // Arrange
      const client = createClient(requestMetadataJourney)

      // Act
      const result = await client.get('/ref-request/form', {
        session: {},
        cookies: { theme: 'dark' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.capturedCookie).toBe('dark')
        expect(result.context.data.capturedMissingCookie).toBeUndefined()
      }
    })

    it('should resolve Request.State() through a dotted key into the request state', async () => {
      // Arrange
      const client = createClient(requestMetadataJourney)

      // Act
      const result = await client.get('/ref-request/form', {
        session: {},
        state: { user: { name: 'Ada' } },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.capturedStateName).toBe('Ada')
      }
    })

    it('should resolve Query() from the request query parameters', async () => {
      // Arrange
      const client = createClient(requestMetadataJourney)

      // Act
      const result = await client.get('/ref-request/form', {
        session: {},
        query: { tab: 'summary' },
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.capturedTab).toBe('summary')
      }
    })

    it('should resolve Query() to undefined when the parameter is absent', async () => {
      // Arrange
      const client = createClient(requestMetadataJourney)

      // Act
      const result = await client.get('/ref-request/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.data.capturedMethod).toBe('GET')
        expect(result.context.data.capturedTab).toBeUndefined()
        expect(result.context.data.capturedMissingQuery).toBeUndefined()
      }
    })
  })
})
