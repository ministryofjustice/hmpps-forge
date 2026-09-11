import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import patternPackage from './journey'

const answerStore = { save: vi.fn(), get: vi.fn(), delete: vi.fn() }
const createClient = () => new ForgeTestHarness().registerPackage(patternPackage, { answerStore }).createClient()

describe('reveal-fields', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    answerStore.save.mockResolvedValue(undefined)
    answerStore.delete.mockResolvedValue(undefined)
  })

  it('should require the follow-up answer when its option is selected', async () => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.post('/reveal-fields/heard-from', { session: {}, body: { heardFrom: 'social-media' } })

    // Assert
    expect(result).toMatchObject({ type: 'render', context: { fieldValidationErrors: [{ message: 'Enter the platform where you saw us' }] } })
  })

  it('should ignore the follow-up validation when another option is selected', async () => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.post('/reveal-fields/heard-from', { session: {}, body: { heardFrom: 'search-engine' } })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/reveal-fields/check-answers' })
  })

  it('should save the answers outside the session when the visitor confirms', async () => {
    // Arrange
    const client = createClient()
    const session = { draftAnswers: { heardFrom: 'social-media', socialMediaSource: 'LinkedIn' } }

    // Act
    const result = await client.post('/reveal-fields/check-answers', { session, body: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/reveal-fields/confirmation' })
    expect(answerStore.save).toHaveBeenCalledWith({ heardFrom: 'social-media', socialMediaSource: 'LinkedIn' })
    expect(session).toEqual({})
  })

  it('should show confirmation without session data when a saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue({ saved: true })

    // Act
    const result = await client.get('/reveal-fields/confirmation', { session: {} })

    // Assert
    expect(answerStore.get).toHaveBeenCalledWith()
    expect(result).toMatchObject({ type: 'render', context: { step: { code: 'confirmation' } } })
  })

  it('should keep confirmation unreachable when no saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue(undefined)

    // Act
    const result = await client.get('/reveal-fields/confirmation', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect' })
    expect(result).not.toMatchObject({ url: '/reveal-fields/confirmation' })
  })

  it('should preserve drafts when saving the record fails', async () => {
    // Arrange
    const client = createClient()
    const answers = { heardFrom: 'search-engine' }
    const session = { draftAnswers: answers }

    answerStore.save.mockRejectedValue(new Error('Store unavailable'))

    // Act
    const result = await client.post('/reveal-fields/check-answers', { session, body: {} })

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
    const restart = await client.post('/reveal-fields/confirmation', { session, body: { action: 'restart' } })
    const confirmation = await client.get('/reveal-fields/confirmation', { session })

    // Assert
    expect(answerStore.delete).toHaveBeenCalledWith()
    expect(restart).toMatchObject({ type: 'redirect', url: '/reveal-fields/overview' })
    expect(confirmation).toMatchObject({ type: 'redirect' })
    expect(confirmation).not.toMatchObject({ url: '/reveal-fields/confirmation' })
  })

})
