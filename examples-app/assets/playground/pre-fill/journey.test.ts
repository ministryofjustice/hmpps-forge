import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import patternPackage from './journey'

const answerStore = {
  save: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
}

const addressLookup = { lookupAddress: vi.fn() }

const createClient = () => new ForgeTestHarness()
  .registerPackage(patternPackage, { answerStore, addressLookup })
  .createClient()

describe('preFillDemoJourney', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    answerStore.save.mockResolvedValue(undefined)
    answerStore.delete.mockResolvedValue(undefined)
  })

  it('should save confirmed answers outside the session when the visitor confirms', async () => {
    // Arrange
    const client = createClient()
    const answers = { addressLine1: 'Buckingham Palace', addressTown: 'London', addressPostcode: 'SW1A 1AA' }
    const session = { draftAnswers: answers }

    // Act
    const result = await client.post('/pre-fill/check-answers', { session, body: {} })

    // Assert
    expect(answerStore.save).toHaveBeenCalledWith(answers)
    expect(session).toEqual({})
    expect(result).toMatchObject({ type: 'redirect', url: '/pre-fill/confirmation' })
  })

  it('should keep draft answers in the session when a question is submitted', async () => {
    // Arrange
    const client = createClient()
    const session = {}

    // Act
    await client.post('/pre-fill/find-address', { session, body: { action: 'continue', addressLine1: 'Buckingham Palace', addressTown: 'London', addressPostcode: 'SW1A 1AA' } })

    // Assert
    expect(session).toEqual({ draftAnswers: { addressLine1: 'Buckingham Palace', addressTown: 'London', addressPostcode: 'SW1A 1AA' } })
    expect(answerStore.save).not.toHaveBeenCalled()
  })

  it('should delete the saved record when the existing restart action clears answers', async () => {
    // Arrange
    const client = createClient()
    const session = {}

    answerStore.get.mockResolvedValue({ addressLine1: 'Buckingham Palace', addressTown: 'London', addressPostcode: 'SW1A 1AA' })

    // Act
    await client.post('/pre-fill/confirmation', { session, body: { action: 'restart' } })

    // Assert
    expect(answerStore.delete).toHaveBeenCalledWith()
    expect(session).not.toHaveProperty('patternSubmitted')
  })

  it('should show confirmation without session data when a saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue({ saved: true })

    // Act
    const result = await client.get('/pre-fill/confirmation', { session: {} })

    // Assert
    expect(answerStore.get).toHaveBeenCalledWith()
    expect(result).toMatchObject({ type: 'render', context: { step: { code: 'confirmation' } } })
  })

  it('should keep confirmation unreachable when no saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue(undefined)

    // Act
    const result = await client.get('/pre-fill/confirmation', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect' })
    expect(result).not.toMatchObject({ url: '/pre-fill/confirmation' })
  })

  it('should preserve drafts when saving the record fails', async () => {
    // Arrange
    const client = createClient()
    const answers = { addressLine1: 'Buckingham Palace', addressTown: 'London', addressPostcode: 'SW1A 1AA' }
    const session = { draftAnswers: answers }

    answerStore.save.mockRejectedValue(new Error('Store unavailable'))

    // Act
    const result = await client.post('/pre-fill/check-answers', { session, body: {} })

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
    const restart = await client.post('/pre-fill/confirmation', { session, body: { action: 'restart' } })
    const confirmation = await client.get('/pre-fill/confirmation', { session })

    // Assert
    expect(answerStore.delete).toHaveBeenCalledWith()
    expect(restart).toMatchObject({ type: 'redirect', url: '/pre-fill/overview' })
    expect(confirmation).toMatchObject({ type: 'redirect' })
    expect(confirmation).not.toMatchObject({ url: '/pre-fill/confirmation' })
  })

  it('should pre-fill fields without saving a record when the visitor looks up a postcode', async () => {
    // Arrange
    const client = createClient()
    const address = { line1: 'A sample address', line2: '', town: 'London', county: '', postcode: 'SW1A 1AA' }

    addressLookup.lookupAddress.mockResolvedValue(address)

    // Act
    const result = await client.post('/pre-fill/find-address', {
      session: {},
      body: { action: 'find-address', postcode: 'SW1A 1AA' },
    })

    // Assert
    expect(addressLookup.lookupAddress).toHaveBeenCalledWith('SW1A 1AA')
    expect(result).toMatchObject({
      type: 'render',
      context: {
        step: { code: 'find-address' },
        answers: {
          addressLine1: { current: address.line1 },
          addressLine2: { current: address.line2 },
          addressTown: { current: address.town },
          addressCounty: { current: address.county },
          addressPostcode: { current: address.postcode },
        },
      },
    })
    expect(answerStore.save).not.toHaveBeenCalled()
  })

  it('should skip the lookup when the submitted postcode is invalid', async () => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.post('/pre-fill/find-address', {
      session: {},
      body: { action: 'find-address', postcode: 'not-a-postcode' },
    })

    // Assert
    expect(result).toMatchObject({ type: 'render', context: { step: { code: 'find-address' } } })
    expect(addressLookup.lookupAddress).not.toHaveBeenCalled()
  })
})
