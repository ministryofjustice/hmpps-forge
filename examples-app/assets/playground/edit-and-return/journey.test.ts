import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import patternPackage from './journey'

const answerStore = { save: vi.fn(), get: vi.fn(), delete: vi.fn() }
const createClient = () => new ForgeTestHarness().registerPackage(patternPackage, { answerStore }).createClient()

describe('edit-and-return', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    answerStore.save.mockResolvedValue(undefined)
    answerStore.delete.mockResolvedValue(undefined)
  })

  it('should continue to the next question when the visitor is completing the form', async () => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.post('/edit-and-return/full-name', { session: {}, body: { fullName: 'Sam Jones' } })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/edit-and-return/email-address' })
  })

  it('should return directly to the summary when an answer is changed through a change link', async () => {
    // Arrange
    const client = createClient()
    const answers = { fullName: 'Sam Smith', emailAddress: 'sam@example.com', contactPreference: 'email' }
    const session = { draftAnswers: answers }

    // Act
    const result = await client.post('/edit-and-return/full-name', { session, query: { returnTo: 'check-answers' }, body: { fullName: 'Sam Jones' } })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/edit-and-return/check-answers' })
    expect(session).toMatchObject({ draftAnswers: { ...answers, fullName: 'Sam Jones' } })
    expect(answerStore.save).not.toHaveBeenCalled()
  })

  it('should save the edited answers outside the session when they are confirmed', async () => {
    // Arrange
    const client = createClient()
    const answers = { fullName: 'Sam Jones', emailAddress: 'sam@example.com', contactPreference: 'email' }
    const session = { draftAnswers: answers }

    // Act
    const result = await client.post('/edit-and-return/check-answers', { session, body: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/edit-and-return/confirmation' })
    expect(answerStore.save).toHaveBeenCalledWith(answers)
    expect(session).toEqual({})
  })

  it('should show confirmation without session data when a saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue({ saved: true })

    // Act
    const result = await client.get('/edit-and-return/confirmation', { session: {} })

    // Assert
    expect(answerStore.get).toHaveBeenCalledWith()
    expect(result).toMatchObject({ type: 'render', context: { step: { code: 'confirmation' } } })
  })

  it('should keep confirmation unreachable when no saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue(undefined)

    // Act
    const result = await client.get('/edit-and-return/confirmation', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect' })
    expect(result).not.toMatchObject({ url: '/edit-and-return/confirmation' })
  })

  it('should preserve drafts when saving the record fails', async () => {
    // Arrange
    const client = createClient()
    const answers = { fullName: 'Sam Jones', emailAddress: 'sam@example.com', contactPreference: 'email' }
    const session = { draftAnswers: answers }

    answerStore.save.mockRejectedValue(new Error('Store unavailable'))

    // Act
    const result = await client.post('/edit-and-return/check-answers', { session, body: {} })

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
    const restart = await client.post('/edit-and-return/confirmation', { session, body: { action: 'restart' } })
    const confirmation = await client.get('/edit-and-return/confirmation', { session })

    // Assert
    expect(answerStore.delete).toHaveBeenCalledWith()
    expect(restart).toMatchObject({ type: 'redirect', url: '/edit-and-return/overview' })
    expect(confirmation).toMatchObject({ type: 'redirect' })
    expect(confirmation).not.toMatchObject({ url: '/edit-and-return/confirmation' })
  })

})
