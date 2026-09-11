import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import patternPackage from './journey'

const answerStore = { save: vi.fn(), get: vi.fn(), delete: vi.fn() }
const createClient = () => new ForgeTestHarness().registerPackage(patternPackage, { answerStore }).createClient()

describe('add-another', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    answerStore.save.mockResolvedValue(undefined)
    answerStore.delete.mockResolvedValue(undefined)
  })

  it('should add, edit and remove contacts when the collection actions are submitted', async () => {
    // Arrange
    const client = createClient()
    const session = {}
    const contact = { contactName: 'Alex Smith', contactRelationship: 'friend', contactPhone: '07700 900982' }

    // Act
    const add = await client.post('/add-another/add-contact', { session, body: contact })
    const edit = await client.post('/add-another/edit-contact/0', { session, body: { ...contact, contactName: 'Alex Jones' } })
    const summary = await client.get('/add-another/your-contacts', { session })
    const remove = await client.post('/add-another/delete-contact/0', { session, body: { action: 'confirm' } })

    // Assert
    expect(add).toMatchObject({ type: 'redirect', url: '/add-another/your-contacts' })
    expect(edit).toMatchObject({ type: 'redirect', url: '/add-another/your-contacts' })
    expect(summary).toMatchObject({ type: 'render', context: { answers: { contacts: { current: [{ ...contact, contactName: 'Alex Jones' }] } } } })
    expect(remove).toMatchObject({ type: 'redirect', url: '/add-another/your-contacts' })
    expect(session).toMatchObject({ draftAnswers: { contacts: [] } })
    expect(answerStore.save).not.toHaveBeenCalled()
  })

  it('should prevent continuing when no contacts have been added', async () => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.post('/add-another/your-contacts', { session: {}, body: { action: 'continue' } })

    // Assert
    expect(result).toMatchObject({ type: 'render', context: { domainValidationErrors: [{ message: 'Add at least one emergency contact' }] } })
  })

  it('should save the collection outside the session when it is confirmed', async () => {
    // Arrange
    const client = createClient()
    const answers = { contacts: [{ contactName: 'Alex Smith', contactRelationship: 'friend', contactPhone: '07700 900982' }] }
    const session = { draftAnswers: answers }

    // Act
    const result = await client.post('/add-another/check-answers', { session, body: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/add-another/confirmation' })
    expect(answerStore.save).toHaveBeenCalledWith(answers)
    expect(session).toEqual({})
  })

  it('should show confirmation without session data when a saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue({ saved: true })

    // Act
    const result = await client.get('/add-another/confirmation', { session: {} })

    // Assert
    expect(answerStore.get).toHaveBeenCalledWith()
    expect(result).toMatchObject({ type: 'render', context: { step: { code: 'confirmation' } } })
  })

  it('should keep confirmation unreachable when no saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue(undefined)

    // Act
    const result = await client.get('/add-another/confirmation', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect' })
    expect(result).not.toMatchObject({ url: '/add-another/confirmation' })
  })

  it('should preserve drafts when saving the record fails', async () => {
    // Arrange
    const client = createClient()
    const answers = { contacts: [{ contactName: 'Alex', contactRelationship: 'friend', contactPhone: '07700 900982' }] }
    const session = { draftAnswers: answers }

    answerStore.save.mockRejectedValue(new Error('Store unavailable'))

    // Act
    const result = await client.post('/add-another/check-answers', { session, body: {} })

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
    const restart = await client.post('/add-another/confirmation', { session, body: { action: 'restart' } })
    const confirmation = await client.get('/add-another/confirmation', { session })

    // Assert
    expect(answerStore.delete).toHaveBeenCalledWith()
    expect(restart).toMatchObject({ type: 'redirect', url: '/add-another/overview' })
    expect(confirmation).toMatchObject({ type: 'redirect' })
    expect(confirmation).not.toMatchObject({ url: '/add-another/confirmation' })
  })

})
