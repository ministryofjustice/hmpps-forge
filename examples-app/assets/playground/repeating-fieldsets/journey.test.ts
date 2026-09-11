import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import patternPackage from './journey'

const answerStore = { save: vi.fn(), get: vi.fn(), delete: vi.fn() }
const createClient = () => new ForgeTestHarness().registerPackage(patternPackage, { answerStore }).createClient()

describe('repeating-fieldsets', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    answerStore.save.mockResolvedValue(undefined)
    answerStore.delete.mockResolvedValue(undefined)
  })

  it('should preserve existing inputs when adding another member', async () => {
    // Arrange
    const client = createClient()
    const session = { draftAnswers: { members: [{ memberName: '', memberAge: '' }] } }

    // Act
    const result = await client.post('/repeating-fieldsets/household-members', {
      session,
      body: { action: 'add-another', memberName_0: 'Jane Smith', memberAge_0: '30' },
    })

    // Assert
    expect(result).toMatchObject({ type: 'render' })
    expect(session.draftAnswers.members).toEqual([
      { memberName: 'Jane Smith', memberAge: 30 },
      { memberName: '', memberAge: '' },
    ])
  })

  it('should preserve and re-index the remaining member when removing a group', async () => {
    // Arrange
    const client = createClient()
    const session = { draftAnswers: { members: [
      { memberName: 'Jane Smith', memberAge: 30 },
      { memberName: 'John Doe', memberAge: 25 },
    ] } }

    // Act
    const result = await client.post('/repeating-fieldsets/household-members', {
      session,
      body: { action: 'remove_0', memberName_0: 'Jane Smith', memberAge_0: '30', memberName_1: 'John Doe', memberAge_1: '26' },
    })

    // Assert
    expect(result).toMatchObject({ type: 'render' })
    expect(session.draftAnswers.members).toEqual([{ memberName: 'John Doe', memberAge: 26 }])
  })

  it('should save the answers outside the session when the visitor confirms', async () => {
    // Arrange
    const client = createClient()
    const session = { draftAnswers: { members: [{ memberName: 'Jane Smith', memberAge: 30 }] } }

    // Act
    const result = await client.post('/repeating-fieldsets/check-answers', { session, body: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/repeating-fieldsets/confirmation' })
    expect(answerStore.save).toHaveBeenCalledWith({ members: [{ memberName: 'Jane Smith', memberAge: 30 }] })
    expect(session).toEqual({})
  })

  it('should show confirmation without session data when a saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue({ saved: true })

    // Act
    const result = await client.get('/repeating-fieldsets/confirmation', { session: {} })

    // Assert
    expect(answerStore.get).toHaveBeenCalledWith()
    expect(result).toMatchObject({ type: 'render', context: { step: { code: 'confirmation' } } })
  })

  it('should keep confirmation unreachable when no saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue(undefined)

    // Act
    const result = await client.get('/repeating-fieldsets/confirmation', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect' })
    expect(result).not.toMatchObject({ url: '/repeating-fieldsets/confirmation' })
  })

  it('should preserve drafts when saving the record fails', async () => {
    // Arrange
    const client = createClient()
    const answers = { members: [{ memberName: 'Jane Smith', memberAge: 30 }] }
    const session = { draftAnswers: answers }

    answerStore.save.mockRejectedValue(new Error('Store unavailable'))

    // Act
    const result = await client.post('/repeating-fieldsets/check-answers', { session, body: {} })

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
    const restart = await client.post('/repeating-fieldsets/confirmation', { session, body: { action: 'restart' } })
    const confirmation = await client.get('/repeating-fieldsets/confirmation', { session })

    // Assert
    expect(answerStore.delete).toHaveBeenCalledWith()
    expect(restart).toMatchObject({ type: 'redirect', url: '/repeating-fieldsets/overview' })
    expect(confirmation).toMatchObject({ type: 'redirect' })
    expect(confirmation).not.toMatchObject({ url: '/repeating-fieldsets/confirmation' })
  })

})
