import { describe, expect, it } from 'vitest'
import { createClient, type ContractSession } from './contractHelpers'
import {
  basicRedirectJourney,
  validationBranchJourney,
  onAlwaysHaltsJourney,
  conditionalCascadeJourney,
  throwErrorCascadeJourney,
  dynamicGotoJourney,
  unreachableStepJourney,
  accessRedirectJourney,
  accessErrorJourney,
  multiSubmitHooksJourney,
  onValidEffectsJourney,
  dynamicErrorMessageJourney,
  conditionalEntryJourney,
  resumeJourney,
  unreachableFrontierJourney,
  queryStringRedirectJourney,
  paramRedirectJourney,
  guardsJourney,
  tieBreakerJourney,
} from './navigation.fixtures'

describe('navigation contracts', () => {
  describe('POST outcomes', () => {
    it('should redirect to goto target on POST', async () => {
      // Arrange
      const client = createClient(basicRedirectJourney)

      // Act
      const result = await client.post('/basic-redirect/form', {
        session: {},
        body: { name: 'Ada' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/basic-redirect/done')
      }
    })

    it('should redirect to onValid target when validation passes', async () => {
      // Arrange
      const client = createClient(validationBranchJourney)

      // Act
      const result = await client.post('/val-branch/form', {
        session: {},
        body: { name: 'Ada' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/val-branch/success')
      }
    })

    it('should redirect to onInvalid target when validation fails', async () => {
      // Arrange
      const client = createClient(validationBranchJourney)

      // Act
      const result = await client.post('/val-branch/form', {
        session: {},
        body: { name: '' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/val-branch/error')
      }
    })

    it('should redirect from onAlways before validation runs', async () => {
      // Arrange
      const client = createClient(onAlwaysHaltsJourney)
      const session: ContractSession = {
        data: { skipValidation: true },
      }

      // Act
      const result = await client.post('/always-halts/form', {
        session,
        body: { name: '' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/always-halts/exit')
      }
    })
  })

  describe('conditional routing', () => {
    it('should redirect to first matching conditional target', async () => {
      // Arrange
      const client = createClient(conditionalCascadeJourney)

      // Act
      const result = await client.post('/cascade/form', {
        session: {},
        body: { choice: 'a' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/cascade/path-a')
      }
    })

    it('should skip non-matching conditions and use fallback', async () => {
      // Arrange
      const client = createClient(conditionalCascadeJourney)

      // Act
      const result = await client.post('/cascade/form', {
        session: {},
        body: { choice: 'c' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/cascade/default')
      }
    })
  })

  describe('error outcomes', () => {
    it('should return error when throwError condition is met', async () => {
      // Arrange
      const client = createClient(throwErrorCascadeJourney)

      // Act
      const result = await client.post('/throw-error/form', {
        session: {},
        body: { confirm: 'no' },
      })

      // Assert
      expect(result.type).toBe('error')

      if (result.type === 'error') {
        expect(result.status).toBe(400)
        expect(result.message).toBe('Must confirm before continuing')
      }
    })

    it('should fall through to redirect when throwError condition is not met', async () => {
      // Arrange
      const client = createClient(throwErrorCascadeJourney)

      // Act
      const result = await client.post('/throw-error/form', {
        session: {},
        body: { confirm: 'yes' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/throw-error/done')
      }
    })
  })

  describe('dynamic destinations', () => {
    it('should resolve Data() reference in goto target', async () => {
      // Arrange
      const client = createClient(dynamicGotoJourney)
      const session: ContractSession = {
        data: { destination: 'step-a' },
      }

      // Act
      const result = await client.post('/dynamic-goto/form', {
        session,
        body: { name: 'Ada' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/dynamic-goto/step-a')
      }
    })
  })

  describe('journey entry', () => {
    it('should redirect to entry step when accessing journey root', async () => {
      // Arrange
      const client = createClient(basicRedirectJourney)

      // Act
      const result = await client.get('/basic-redirect', { session: {} })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/basic-redirect/form')
      }
    })

    it('should redirect to entry step when step is unreachable', async () => {
      // Arrange
      const client = createClient(unreachableStepJourney)

      // Act
      const result = await client.get('/unreachable/step-two', { session: {} })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/unreachable/step-one')
      }
    })

    it('should redirect to frontier when unreachableRedirect is frontier', async () => {
      // Arrange
      const client = createClient(unreachableFrontierJourney)
      const session: ContractSession = {
        answers: { frontier: { firstName: 'Ada' } },
      }

      // Act
      const result = await client.get('/frontier/step-three', { session })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/frontier/step-two')
      }
    })

    it('should redirect to higher-priority entry when tie-breakers are set', async () => {
      // Arrange
      const client = createClient(tieBreakerJourney)

      // Act
      const result = await client.get('/tie-breaker', { session: {} })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/tie-breaker/high-priority')
      }
    })
  })

  describe('access hook outcomes', () => {
    it('should redirect when access hook condition is met', async () => {
      // Arrange
      const client = createClient(accessRedirectJourney)
      const session: ContractSession = {
        data: { blocked: true },
      }

      // Act
      const result = await client.get('/access-redirect/protected', { session })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/access-redirect/denied')
      }
    })

    it('should render step when access hook condition is not met', async () => {
      // Arrange
      const client = createClient(accessRedirectJourney)
      const session: ContractSession = {
        data: { blocked: false },
      }

      // Act
      const result = await client.get('/access-redirect/protected', { session })

      // Assert
      expect(result.type).toBe('render')
    })

    it('should return error when access hook throws', async () => {
      // Arrange
      const client = createClient(accessErrorJourney)
      const session: ContractSession = {
        data: { notFound: true },
      }

      // Act
      const result = await client.get('/access-error/resource', { session })

      // Assert
      expect(result.type).toBe('error')

      if (result.type === 'error') {
        expect(result.status).toBe(404)
        expect(result.message).toBe('Resource not found')
      }
    })
  })

  describe('submit hook selection', () => {
    it('should route to the submit hook whose when guard matches', async () => {
      // Arrange
      const client = createClient(multiSubmitHooksJourney)

      // Act
      const result = await client.post('/multi-hooks/form', {
        session: {},
        body: { action: 'search', query: 'test' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/multi-hooks/results')
      }
    })

    it('should skip non-matching hooks and fire the matching one', async () => {
      // Arrange
      const client = createClient(multiSubmitHooksJourney)

      // Act
      const result = await client.post('/multi-hooks/form', {
        session: {},
        body: { action: 'reset' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/multi-hooks/cleared')
      }
    })

    it('should skip submit hook when guards condition fails', async () => {
      // Arrange
      const client = createClient(guardsJourney)
      const session: ContractSession = {
        data: { sessionValid: false },
      }

      // Act
      const result = await client.post('/guards/form', {
        session,
        body: { name: 'Ada' },
      })

      // Assert
      expect(result.type).toBe('render')
    })

    it('should execute submit hook when guards condition passes', async () => {
      // Arrange
      const client = createClient(guardsJourney)
      const session: ContractSession = {
        data: { sessionValid: true },
      }

      // Act
      const result = await client.post('/guards/form', {
        session,
        body: { name: 'Ada' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/guards/done')
      }
    })
  })

  describe('submission effects', () => {
    it('should execute onValid effects before redirect', async () => {
      // Arrange
      const client = createClient(onValidEffectsJourney)
      const session: ContractSession = {}

      // Act
      const result = await client.post('/valid-effects/form', {
        session,
        body: { name: 'Ada' },
      })

      // Assert
      expect(result.type).toBe('redirect')
      expect(session.answers?.['valid-effects']?.name).toBe('Ada')
    })

    it('should not execute onValid effects when validation fails', async () => {
      // Arrange
      const client = createClient(onValidEffectsJourney)
      const session: ContractSession = {}

      // Act
      const result = await client.post('/valid-effects/form', {
        session,
        body: { name: '' },
      })

      // Assert
      expect(result.type).toBe('render')
      expect(session.answers).toBeUndefined()
    })
  })

  describe('conditional entry', () => {
    it('should treat conditional entry as reachable when condition is true', async () => {
      // Arrange
      const client = createClient(conditionalEntryJourney)
      const session: ContractSession = {
        data: { isPremium: true },
      }

      // Act
      const result = await client.get('/cond-entry/premium', { session })

      // Assert
      expect(result.type).toBe('render')
    })

    it('should redirect to default entry when conditional entry is false', async () => {
      // Arrange
      const client = createClient(conditionalEntryJourney)
      const session: ContractSession = {
        data: { isPremium: false },
      }

      // Act
      const result = await client.get('/cond-entry/premium', { session })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/cond-entry/standard')
      }
    })
  })

  describe('resume', () => {
    it('should redirect completed step to frontier when resume is active', async () => {
      // Arrange
      const client = createClient(resumeJourney)
      const session: ContractSession = {
        answers: { resume: { firstName: 'Ada' } },
      }

      // Act
      const result = await client.get('/resume/step-one', { session })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/resume/step-two')
      }
    })

    it('should render frontier step normally when resume is active', async () => {
      // Arrange
      const client = createClient(resumeJourney)
      const session: ContractSession = {
        answers: { resume: { firstName: 'Ada' } },
      }

      // Act
      const result = await client.get('/resume/step-two', { session })

      // Assert
      expect(result.type).toBe('render')
    })
  })

  describe('path resolution', () => {
    it('should preserve query string and hash in redirect URL', async () => {
      // Arrange
      const client = createClient(queryStringRedirectJourney)

      // Act
      const result = await client.post('/query-redirect/form', {
        session: {},
        body: { name: 'Ada' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/query-redirect/review?from=form#summary')
      }
    })

    it('should interpolate path parameters in redirect URL', async () => {
      // Arrange
      const client = createClient(paramRedirectJourney)

      // Act
      const result = await client.post('/param-redirect/123/form', {
        session: {},
        body: { name: 'Ada' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toBe('/param-redirect/123/done')
      }
    })

    it('should resolve dynamic error message from data', async () => {
      // Arrange
      const client = createClient(dynamicErrorMessageJourney)
      const session: ContractSession = {
        data: { errorDetail: 'connection timeout' },
      }

      // Act
      const result = await client.post('/dynamic-error-msg/form', {
        session,
        body: { name: 'Ada' },
      })

      // Assert
      expect(result.type).toBe('error')

      if (result.type === 'error') {
        expect(result.status).toBe(500)
        expect(result.message).toBe('Save failed: connection timeout')
      }
    })
  })
})
