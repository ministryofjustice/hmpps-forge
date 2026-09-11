import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import patternPackage from './journey'

const contact = { recordName: 'Jane Smith', recordEmail: 'jane.smith@example.com', recordDepartment: 'Digital Services' }
const answerStore = { get: vi.fn(), getAll: vi.fn(), save: vi.fn() }
const createClient = () => new ForgeTestHarness().registerPackage(patternPackage, { answerStore }).createClient()

describe('readOnlyModeDemoJourney', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    answerStore.get.mockResolvedValue(contact)
    answerStore.getAll.mockResolvedValue([contact])
    answerStore.save.mockResolvedValue(undefined)
  })

  it('should redirect to login when contacts are accessed without a user', async () => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.get('/read-only-mode/contacts', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/read-only-mode/login' })
    expect(answerStore.getAll).not.toHaveBeenCalled()
  })

  it('should load the saved record when a viewer opens a contact', async () => {
    // Arrange
    const client = createClient()
    const session = { demoUser: { name: 'Viewer', role: 'viewer' } }

    // Act
    const result = await client.get('/read-only-mode/record/0', { session })

    // Assert
    expect(answerStore.get).toHaveBeenCalledWith('0')
    expect(result).toMatchObject({ type: 'render', context: { answers: { recordName: { current: contact.recordName } } } })
  })

  it('should save the edited record outside the session when an admin submits', async () => {
    // Arrange
    const client = createClient()
    const session = { demoUser: { name: 'Admin', role: 'admin' } }
    const edited = { ...contact, recordName: 'Alice Smith' }

    // Act
    const result = await client.post('/read-only-mode/record/0', { session, body: edited })

    // Assert
    expect(answerStore.save).toHaveBeenCalledWith('0', edited)
    expect(result).toMatchObject({ type: 'redirect', url: '/read-only-mode/contacts' })
    expect(session).toEqual({ demoUser: { name: 'Admin', role: 'admin' } })
  })

  it('should refuse to save when a viewer submits edited fields', async () => {
    // Arrange
    const client = createClient()
    const session = { demoUser: { name: 'Viewer', role: 'viewer' } }

    // Act
    await client.post('/read-only-mode/record/0', { session, body: { ...contact, recordName: 'Changed' } })

    // Assert
    expect(answerStore.save).not.toHaveBeenCalled()
  })

  it('should keep the saved record when an admin submits an empty name', async () => {
    // Arrange
    const client = createClient()
    const session = { demoUser: { name: 'Admin', role: 'admin' } }

    // Act
    const result = await client.post('/read-only-mode/record/0', { session, body: { ...contact, recordName: '' } })

    // Assert
    expect(result).toMatchObject({ type: 'render' })
    expect(answerStore.save).not.toHaveBeenCalled()
  })

  it('should preserve stored records when the visitor logs out', async () => {
    // Arrange
    const client = createClient()
    const session = { demoUser: { name: 'Admin', role: 'admin' } }

    // Act
    const result = await client.post('/read-only-mode/contacts', { session, body: { action: 'logout' } })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/read-only-mode/login' })
    expect(session).toEqual({})
    expect(answerStore.save).not.toHaveBeenCalled()
  })
})
