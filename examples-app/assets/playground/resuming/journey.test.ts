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

describe('resumingDemoJourney', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    answerStore.save.mockResolvedValue(undefined)
    answerStore.delete.mockResolvedValue(undefined)
  })

  it('should save confirmed answers outside the session when the visitor confirms', async () => {
    // Arrange
    const client = createClient()
    const answers = { fullName: 'Jane Smith', role: 'Developer' }
    const session = { draftAnswers: answers }

    // Act
    const result = await client.post('/resuming/check-answers', { session, body: {} })

    // Assert
    expect(answerStore.save).toHaveBeenCalledWith(answers)
    expect(session).toEqual({})
    expect(result).toMatchObject({ type: 'redirect', url: '/resuming/confirmation' })
  })

  it('should keep draft answers in the session when a question is submitted', async () => {
    // Arrange
    const client = createClient()
    const session = {}

    // Act
    await client.post('/resuming/your-name', { session, body: { fullName: 'Jane Smith' } })

    // Assert
    expect(session).toEqual({ draftAnswers: { fullName: 'Jane Smith' } })
    expect(answerStore.save).not.toHaveBeenCalled()
  })

  it('should delete the saved record when the existing restart action clears answers', async () => {
    // Arrange
    const client = createClient()
    const session = {}

    answerStore.get.mockResolvedValue({ fullName: 'Jane Smith', role: 'Developer' })

    // Act
    await client.post('/resuming/confirmation', { session, body: { action: 'restart' } })

    // Assert
    expect(answerStore.delete).toHaveBeenCalledWith()
    expect(session).not.toHaveProperty('patternSubmitted')
  })

  it('should show confirmation without session data when a saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue({ saved: true })

    // Act
    const result = await client.get('/resuming/confirmation', { session: {} })

    // Assert
    expect(answerStore.get).toHaveBeenCalledWith()
    expect(result).toMatchObject({ type: 'render', context: { step: { code: 'confirmation' } } })
  })

  it('should keep confirmation unreachable when no saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue(undefined)

    // Act
    const result = await client.get('/resuming/confirmation', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect' })
    expect(result).not.toMatchObject({ url: '/resuming/confirmation' })
  })

  it('should preserve drafts when saving the record fails', async () => {
    // Arrange
    const client = createClient()
    const answers = { fullName: 'Jane Smith', role: 'Developer' }
    const session = { draftAnswers: answers }

    answerStore.save.mockRejectedValue(new Error('Store unavailable'))

    // Act
    const result = await client.post('/resuming/check-answers', { session, body: {} })

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
    const restart = await client.post('/resuming/confirmation', { session, body: { action: 'restart' } })
    const confirmation = await client.get('/resuming/confirmation', { session })

    // Assert
    expect(answerStore.delete).toHaveBeenCalledWith()
    expect(restart).toMatchObject({ type: 'redirect', url: '/resuming/overview' })
    expect(confirmation).toMatchObject({ type: 'redirect' })
    expect(confirmation).not.toMatchObject({ url: '/resuming/confirmation' })
  })

  it.each([
    { answers: {}, target: 'overview' },
    { answers: { fullName: 'Ada Lovelace' }, target: 'your-role' },
    { answers: { fullName: 'Ada Lovelace', role: 'Developer' }, target: 'check-answers' },
  ])('should resume at $target when the saved draft is $answers', async ({ answers, target }) => {
    // Arrange
    const client = createClient()
    const session = { draftAnswers: answers }

    // Act
    const result = await client.get('/resuming', { session, query: { resume: 'true' } })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: `/resuming/${target}` })
  })

  it('should render the requested question when resume is not active', async () => {
    // Arrange
    const client = createClient()
    const session = { draftAnswers: { fullName: 'Ada Lovelace' } }

    // Act
    const result = await client.get('/resuming/your-name', { session })

    // Assert
    expect(result).toMatchObject({ type: 'render', context: { answers: { fullName: { current: 'Ada Lovelace' } } } })
  })
})
