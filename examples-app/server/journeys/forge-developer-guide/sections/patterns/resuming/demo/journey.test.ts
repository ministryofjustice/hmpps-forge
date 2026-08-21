import { createForgePackage } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { describe, expect, it, vi } from 'vitest'
import type { GuideDeps } from '../../../../effects'
import { resumingDemoJourney } from './journey'

const basePackage = createForgePackage<GuideDeps>({
  journey: resumingDemoJourney,
})

const mockFormDataStore = {
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn(),
  delete: vi.fn(),
}

function createClient() {
  return new ForgeTestHarness()
    .registerPackage(basePackage, { formDataStore: mockFormDataStore } as unknown as GuideDeps)
    .createClient()
}

describe('resumingDemoJourney', () => {
  describe('your-name', () => {
    it('should render the name form on GET', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/resuming/your-name', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.title).toBe('What is your name?')
      }
    })

    it('should redirect to your-role on valid submission', async () => {
      // Arrange
      const client = createClient()
      const session: Record<string, unknown> = {}

      // Act
      const result = await client.post('/resuming/your-name', {
        session,
        body: { fullName: 'Ada Lovelace' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toContain('your-role')
      }
    })

    it('should save draft answers to session on valid submission', async () => {
      // Arrange
      const client = createClient()
      const session: Record<string, unknown> = {}

      // Act
      await client.post('/resuming/your-name', {
        session,
        body: { fullName: 'Ada Lovelace' },
      })

      // Assert
      const drafts = session.patternDrafts as Record<string, Record<string, unknown>> | undefined

      expect(drafts?.resuming?.fullName).toBe('Ada Lovelace')
    })

    it('should re-render with validation errors when name is missing', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.post('/resuming/your-name', {
        session: {},
        body: {},
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)

        const errors = result.getValidationErrorsByFieldCode('fullName')

        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0].message).toBe('Enter your name')
      }
    })
  })

  describe('your-role', () => {
    it('should render the role form on GET', async () => {
      // Arrange
      const client = createClient()
      const session = {
        patternDrafts: { resuming: { fullName: 'Ada Lovelace' } },
      }

      // Act
      const result = await client.get('/resuming/your-role', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.step.title).toBe('What is your role?')
      }
    })

    it('should redirect to check-answers on valid submission', async () => {
      // Arrange
      const client = createClient()
      const session: Record<string, unknown> = {
        patternDrafts: { resuming: { fullName: 'Ada Lovelace' } },
      }

      // Act
      const result = await client.post('/resuming/your-role', {
        session,
        body: { role: 'Developer' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toContain('check-answers')
      }
    })

    it('should re-render with validation errors when role is missing', async () => {
      // Arrange
      const client = createClient()
      const session = {
        patternDrafts: { resuming: { fullName: 'Ada Lovelace' } },
      }

      // Act
      const result = await client.post('/resuming/your-role', {
        session,
        body: {},
      })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.showValidationFailures).toBe(true)

        const errors = result.getValidationErrorsByFieldCode('role')

        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0].message).toBe('Enter your role')
      }
    })
  })

  describe('onAccess', () => {
    it('should load draft answers from session into the render context', async () => {
      // Arrange
      const client = createClient()
      const session = {
        patternDrafts: { resuming: { fullName: 'Ada Lovelace' } },
      }

      // Act
      const result = await client.get('/resuming/your-name', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.answers.fullName).toMatchObject({ current: 'Ada Lovelace' })
      }
    })
  })

  describe('resume', () => {
    it('should redirect to your-name when no progress exists', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/resuming/your-name', {
        session: {},
        query: { resume: 'true' },
      })

      // Assert - your-name is the first unanswered step, so it renders here
      expect(result.type).toBe('render')
    })

    it('should redirect to your-role when only name has been answered', async () => {
      // Arrange
      const client = createClient()
      const session = {
        patternDrafts: { resuming: { fullName: 'Ada Lovelace' } },
      }

      // Act
      const result = await client.get('/resuming/your-name', {
        session,
        query: { resume: 'true' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toContain('your-role')
      }
    })

    it('should redirect to check-answers when all questions have been answered', async () => {
      // Arrange
      const client = createClient()
      const session = {
        patternDrafts: {
          resuming: { fullName: 'Ada Lovelace', role: 'Developer' },
        },
      }

      // Act
      const result = await client.get('/resuming/your-name', {
        session,
        query: { resume: 'true' },
      })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toContain('check-answers')
      }
    })

    it('should not skip past your-name when resume is not active', async () => {
      // Arrange
      const client = createClient()
      const session = {
        patternDrafts: { resuming: { fullName: 'Ada Lovelace' } },
      }

      // Act - no ?resume=true, so the step renders normally
      const result = await client.get('/resuming/your-name', { session })

      // Assert
      expect(result.type).toBe('render')
    })
  })

  describe('check-answers', () => {
    it('should render the summary with answers from the session', async () => {
      // Arrange
      const client = createClient()
      const session = {
        patternDrafts: {
          resuming: { fullName: 'Ada Lovelace', role: 'Developer' },
        },
      }

      // Act
      const result = await client.get('/resuming/check-answers', { session })

      // Assert
      expect(result.type).toBe('render')

      if (result.type === 'render') {
        expect(result.context.answers.fullName).toMatchObject({ current: 'Ada Lovelace' })
        expect(result.context.answers.role).toMatchObject({ current: 'Developer' })
      }
    })

    it('should persist answers and redirect to confirmation on submit', async () => {
      // Arrange
      const client = createClient()
      const session: Record<string, unknown> = {
        id: 'test-session-id',
        patternDrafts: {
          resuming: { fullName: 'Ada Lovelace', role: 'Developer' },
        },
      }

      // Act
      const result = await client.post('/resuming/check-answers', { session })

      // Assert
      expect(result.type).toBe('redirect')

      if (result.type === 'redirect') {
        expect(result.url).toContain('confirmation')
      }

      expect(mockFormDataStore.set).toHaveBeenCalled()

      const submitted = session.patternSubmitted as Record<string, boolean> | undefined

      expect(submitted?.resuming).toBe(true)
    })
  })

  describe('confirmation', () => {
    it('should render when the journey has been submitted', async () => {
      // Arrange
      const client = createClient()
      const session = { patternSubmitted: { resuming: true } }

      // Act
      const result = await client.get('/resuming/confirmation', { session })

      // Assert
      expect(result.type).toBe('render')
    })

    it('should redirect away when the journey has not been submitted', async () => {
      // Arrange
      const client = createClient()

      // Act
      const result = await client.get('/resuming/confirmation', { session: {} })

      // Assert
      expect(result.type).toBe('redirect')
    })
  })
})
