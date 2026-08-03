import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
import { describe, expect, it, vi } from 'vitest'
import type { GuideDeps } from '../../../../effects'
import { patternEffectRegistry } from '../../effects'
import { branchingDemoJourney } from './journey'

const basePackage = createForgePackage({
  journey: branchingDemoJourney,
  functions: patternEffectRegistry,
})

const mockFormDataStore = {
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn(),
  delete: vi.fn(),
}

function createClient() {
  return new ForgeTestHarness()
    .registerGlobalComponents(govukComponents)
    .registerPackage(basePackage, { formDataStore: mockFormDataStore } as unknown as GuideDeps)
    .createClient()
}

describe('branchingDemoJourney', () => {
  describe('visit-type', () => {
    it('should render the visit type form on GET', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/branching/visit-type', { session: {} })

      // Assert
      expect(result.type).toBe('render')
    })

    it('should redirect to location when visitType is in-person', async () => {
      // Arrange
      const client = createClient()
      const session = {}

      // Act
      const result = await client.post('/branching/visit-type', {
        session,
        body: { visitType: 'in-person' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toContain('location')
      }
    })

    it('should redirect to video-email when visitType is video', async () => {
      // Arrange
      const client = createClient()
      const session = {}

      // Act
      const result = await client.post('/branching/visit-type', {
        session,
        body: { visitType: 'video' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toContain('video-email')
      }
    })

    it('should redirect to phone-number when visitType is phone', async () => {
      // Arrange
      const client = createClient()
      const session = {}

      // Act
      const result = await client.post('/branching/visit-type', {
        session,
        body: { visitType: 'phone' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toContain('phone-number')
      }
    })

    it('should re-render with validation errors when visitType is missing', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.post('/branching/visit-type', {
        session: {},
        body: {},
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)
        expect(result.context.fieldValidationErrors.length).toBeGreaterThan(0)
      }
    })

    it('should save draft answers to session on valid submission', async () => {
      // Arrange
      const client = createClient()
      const session: Record<string, unknown> = {}

      // Act
      await client.post('/branching/visit-type', {
        session,
        body: { visitType: 'in-person' },
      })

      // Assert
      const drafts = session.patternDrafts as Record<string, Record<string, unknown>> | undefined

      expect(drafts?.branching?.visitType).toBe('in-person')
    })
  })

  describe('onAccess', () => {
    it('should load draft answers from session into the render context', async () => {
      // Arrange
      const client = createClient()
      const session = {
        patternDrafts: {
          branching: { visitType: 'video' },
        },
      }

      // Act
      const result = await client.get('/branching/visit-type', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.answers.visitType).toMatchObject({ current: 'video' })
      }
    })
  })

  describe('check-answers', () => {
    it('should render the summary page with answers from the session', async () => {
      // Arrange
      const client = createClient()
      const session = {
        patternDrafts: {
          branching: { visitType: 'in-person', location: 'sheffield' },
        },
      }

      // Act
      const result = await client.get('/branching/check-answers', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.answers.visitType).toMatchObject({ current: 'in-person' })
        expect(result.context.answers.location).toMatchObject({ current: 'sheffield' })
      }
    })

    it('should persist answers and redirect to confirmation on submit', async () => {
      // Arrange
      const client = createClient()
      const session: Record<string, unknown> = {
        id: 'test-session-id',
        patternDrafts: {
          branching: { visitType: 'in-person', location: 'sheffield' },
        },
      }

      // Act
      const result = await client.post('/branching/check-answers', { session })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toContain('confirmation')
      }

      expect(mockFormDataStore.set).toHaveBeenCalled()

      const submitted = session.patternSubmitted as Record<string, boolean> | undefined

      expect(submitted?.branching).toBe(true)
    })
  })
})
