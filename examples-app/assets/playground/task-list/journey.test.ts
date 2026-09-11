import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import patternPackage from './journey'

const answerStore = { save: vi.fn(), get: vi.fn(), delete: vi.fn() }
const createClient = () => new ForgeTestHarness().registerPackage(patternPackage, { answerStore }).createClient()

describe('task-list', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    answerStore.save.mockResolvedValue(undefined)
    answerStore.delete.mockResolvedValue(undefined)
  })

  it('should record a partially completed section when submitting a name', async () => {
    // Arrange
    const client = createClient()
    const session = {}

    // Act
    const result = await client.post('/task-list/your-details/your-name', { session, body: { visitorName: 'Jane Smith' } })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/task-list/your-details/relationship' })
    expect(session).toMatchObject({ draftAnswers: { visitorName: 'Jane Smith', yourDetailsStatus: 'in-progress' } })
  })

  it('should prevent access to additional needs when prerequisites are incomplete', async () => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.get('/task-list/additional-needs', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect' })
    expect(result).not.toMatchObject({ url: '/task-list/additional-needs' })
  })

  it('should save the answers outside the session when the visitor confirms', async () => {
    // Arrange
    const client = createClient()
    const session = { draftAnswers: { visitorName: 'Jane Smith', relationship: 'friend', preferredDay: 'monday', visitType: 'in-person', additionalNeeds: 'None', yourDetailsStatus: 'completed', visitPreferencesStatus: 'completed', additionalNeedsStatus: 'completed' } }

    // Act
    const result = await client.post('/task-list/check-answers', { session, body: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/task-list/confirmation' })
    expect(answerStore.save).toHaveBeenCalledWith({ visitorName: 'Jane Smith', relationship: 'friend', preferredDay: 'monday', visitType: 'in-person', additionalNeeds: 'None', yourDetailsStatus: 'completed', visitPreferencesStatus: 'completed', additionalNeedsStatus: 'completed' })
    expect(session).toEqual({})
  })

  it('should show confirmation without session data when a saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue({ saved: true })

    // Act
    const result = await client.get('/task-list/confirmation', { session: {} })

    // Assert
    expect(answerStore.get).toHaveBeenCalledWith()
    expect(result).toMatchObject({ type: 'render', context: { step: { code: 'confirmation' } } })
  })

  it('should keep confirmation unreachable when no saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue(undefined)

    // Act
    const result = await client.get('/task-list/confirmation', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect' })
    expect(result).not.toMatchObject({ url: '/task-list/confirmation' })
  })

  it('should preserve drafts when saving the record fails', async () => {
    // Arrange
    const client = createClient()
    const answers = { visitorName: 'Jane Smith', relationship: 'friend', preferredDay: 'monday', visitType: 'in-person', additionalNeeds: 'None', yourDetailsStatus: 'completed', visitPreferencesStatus: 'completed', additionalNeedsStatus: 'completed' }
    const session = { draftAnswers: answers }

    answerStore.save.mockRejectedValue(new Error('Store unavailable'))

    // Act
    const result = await client.post('/task-list/check-answers', { session, body: {} })

    // Assert
    expect(result).toMatchObject({ type: 'error' })
    expect(session).toEqual({ draftAnswers: answers })
  })


  it('should make confirmation unreachable when the saved record is deleted on restart', async () => {
    // Arrange
    const client = createClient()
    const session = {}

    answerStore.get.mockResolvedValue({ saved: true })
    answerStore.delete.mockImplementation(async () => {
      answerStore.get.mockResolvedValue(undefined)
    })

    // Act
    const restart = await client.post('/task-list/confirmation', { session, body: { action: 'restart' } })
    const confirmation = await client.get('/task-list/confirmation', { session })

    // Assert
    expect(answerStore.delete).toHaveBeenCalledWith()
    expect(restart).toMatchObject({ type: 'redirect', url: '/task-list/overview' })
    expect(confirmation).toMatchObject({ type: 'redirect' })
    expect(confirmation).not.toMatchObject({ url: '/task-list/confirmation' })
  })

})
