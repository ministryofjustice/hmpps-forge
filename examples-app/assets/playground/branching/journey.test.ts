import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import patternPackage from './journey'

const answerStore = {
  save: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}

const createClient = () => new ForgeTestHarness()
  .registerPackage(patternPackage, { answerStore })
  .createClient()

describe('branchingDemoJourney', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    answerStore.save.mockResolvedValue(undefined)
    answerStore.delete.mockResolvedValue(undefined)
  })

  it('should save confirmed answers outside the session when the visitor confirms', async () => {
    // Arrange
    const client = createClient()
    const answers = { visitType: 'video', videoEmail: 'visitor@example.com' }
    const session = { patternDrafts: { branching: answers } }

    // Act
    const result = await client.post('/branching/check-answers', { session, body: {} })

    // Assert
    expect(answerStore.save).toHaveBeenCalledWith('branching', answers)
    expect(session).toEqual({ patternDrafts: {}, patternSubmitted: { branching: true } })
    expect(result).toMatchObject({ type: 'redirect', url: '/branching/confirmation' })
  })

  it('should keep draft answers in the session when a question is submitted', async () => {
    // Arrange
    const client = createClient()
    const session = {}

    // Act
    await client.post('/branching/visit-type', { session, body: { visitType: 'video' } })

    // Assert
    expect(session).toEqual({ patternDrafts: { branching: { visitType: 'video' } } })
    expect(answerStore.save).not.toHaveBeenCalled()
  })

  it('should delete the saved record when the existing restart action clears answers', async () => {
    // Arrange
    const client = createClient()
    const session = { patternSubmitted: { branching: true } }

    // Act
    await client.post('/branching/confirmation', { session, body: { action: 'restart' } })

    // Assert
    expect(answerStore.delete).toHaveBeenCalledWith('branching')
    expect(session.patternSubmitted.branching).toBe(false)
  })
})
