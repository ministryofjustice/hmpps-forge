import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import patternPackage from './journey'

const answerStore = { save: vi.fn(), get: vi.fn(), delete: vi.fn() }
const createClient = () => new ForgeTestHarness().registerPackage(patternPackage, { answerStore }).createClient()

describe('composite-fields', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    answerStore.save.mockResolvedValue(undefined)
    answerStore.delete.mockResolvedValue(undefined)
  })

  it('should store an ISO date when all date parts are submitted', async () => {
    // Arrange
    const client = createClient()
    const session = {}

    // Act
    const result = await client.post('/composite-fields/date-of-birth', {
      session,
      body: { dateOfBirth: { day: '27', month: '3', year: '1990' } },
    })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/composite-fields/address' })
    expect(session).toEqual({ draftAnswers: { dateOfBirth: '1990-03-27' } })
  })

  it('should validate all required address fields together when they are empty', async () => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.post('/composite-fields/address', {
      session: { draftAnswers: { dateOfBirth: '1990-03-27' } },
      body: {},
    })

    // Assert
    expect(result).toMatchObject({ type: 'render', context: { fieldValidationErrors: expect.arrayContaining([
      expect.objectContaining({ message: 'Enter the first line of your address' }),
      expect.objectContaining({ message: 'Enter your town or city' }),
      expect.objectContaining({ message: 'Enter your postcode' }),
    ]) } })
  })

  it('should save the answers outside the session when the visitor confirms', async () => {
    // Arrange
    const client = createClient()
    const session = { draftAnswers: { dateOfBirth: '1990-03-27', addressLine1: '10 Downing Street', addressTown: 'London', addressPostcode: 'SW1A 2AA' } }

    // Act
    const result = await client.post('/composite-fields/check-answers', { session, body: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/composite-fields/confirmation' })
    expect(answerStore.save).toHaveBeenCalledWith({ dateOfBirth: '1990-03-27', addressLine1: '10 Downing Street', addressTown: 'London', addressPostcode: 'SW1A 2AA' })
    expect(session).toEqual({})
  })

  it('should show confirmation without session data when a saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue({ saved: true })

    // Act
    const result = await client.get('/composite-fields/confirmation', { session: {} })

    // Assert
    expect(answerStore.get).toHaveBeenCalledWith()
    expect(result).toMatchObject({ type: 'render', context: { step: { code: 'confirmation' } } })
  })

  it('should keep confirmation unreachable when no saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue(undefined)

    // Act
    const result = await client.get('/composite-fields/confirmation', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect' })
    expect(result).not.toMatchObject({ url: '/composite-fields/confirmation' })
  })

  it('should preserve drafts when saving the record fails', async () => {
    // Arrange
    const client = createClient()
    const answers = { dateOfBirth: '1990-03-27', addressLine1: '10 Downing Street', addressTown: 'London', addressPostcode: 'SW1A 2AA' }
    const session = { draftAnswers: answers }

    answerStore.save.mockRejectedValue(new Error('Store unavailable'))

    // Act
    const result = await client.post('/composite-fields/check-answers', { session, body: {} })

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
    const restart = await client.post('/composite-fields/confirmation', { session, body: { action: 'restart' } })
    const confirmation = await client.get('/composite-fields/confirmation', { session })

    // Assert
    expect(answerStore.delete).toHaveBeenCalledWith()
    expect(restart).toMatchObject({ type: 'redirect', url: '/composite-fields/overview' })
    expect(confirmation).toMatchObject({ type: 'redirect' })
    expect(confirmation).not.toMatchObject({ url: '/composite-fields/confirmation' })
  })

})
