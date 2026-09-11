import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import patternPackage from './journey'

const answerStore = { save: vi.fn(), get: vi.fn(), delete: vi.fn() }
const createClient = () => new ForgeTestHarness().registerPackage(patternPackage, { answerStore }).createClient()

describe('collection-validation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    answerStore.save.mockResolvedValue(undefined)
    answerStore.delete.mockResolvedValue(undefined)
  })

  it('should report each active goal without actions when agreeing the plan', async () => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.post('/collection-validation/agree-plan', { session: {}, body: { agreePlan: 'yes' } })

    // Assert
    expect(result).toMatchObject({
      type: 'render',
      context: { fieldValidationErrors: expect.arrayContaining([
        expect.objectContaining({ message: "Add actions to 'Find stable housing'" }),
        expect.objectContaining({ message: "Add actions to 'Build employment skills'" }),
      ]) },
    })
    expect(answerStore.save).not.toHaveBeenCalled()
  })

  it.each([false, true])('should require an active goal when the plan has a future goal: %s', async hasFutureGoal => {
    // Arrange
    const client = createClient()
    const goals = hasFutureGoal ? [{ title: 'Future goal', status: 'FUTURE', actions: ['Prepare'] }] : []
    const session = { draftAnswers: { goals } }

    // Act
    const result = await client.post('/collection-validation/agree-plan', { session, body: { agreePlan: 'yes' } })

    // Assert
    expect(result).toMatchObject({
      type: 'render',
      context: { fieldValidationErrors: expect.arrayContaining([
        expect.objectContaining({ message: 'To agree the plan, create a goal to work on now' }),
      ]) },
    })
    expect(answerStore.save).not.toHaveBeenCalled()
  })

  it('should preserve inactive goals when updating active goal actions', async () => {
    // Arrange
    const client = createClient()
    const goals: { title: string; status: string; actions: string[] }[] = [
      { title: 'Active goal', status: 'ACTIVE', actions: [] },
      { title: 'Future goal', status: 'FUTURE', actions: [] },
    ]
    const session = { draftAnswers: { goals } }

    // Act
    const result = await client.post('/collection-validation/manage-plan', {
      session,
      body: { action_0: 'Contact an adviser, Book an appointment' },
    })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/collection-validation/agree-plan' })
    expect(session.draftAnswers).toEqual({ goals: [
      { title: 'Active goal', status: 'ACTIVE', actions: ['Contact an adviser', 'Book an appointment'] },
      { title: 'Future goal', status: 'FUTURE', actions: [] },
    ] })
  })

  it('should save the plan outside the session when all active goals have actions', async () => {
    // Arrange
    const client = createClient()
    const goals = [
      { title: 'Active goal', status: 'ACTIVE', actions: ['Contact an adviser'] },
      { title: 'Future goal', status: 'FUTURE', actions: [] },
    ]
    const session = { draftAnswers: { goals } }

    // Act
    const result = await client.post('/collection-validation/agree-plan', { session, body: { agreePlan: 'yes' } })

    // Assert
    expect(result).toMatchObject({ type: 'redirect', url: '/collection-validation/confirmation' })
    expect(answerStore.save).toHaveBeenCalledWith({ goals, agreePlan: 'yes' })
    expect(session).toEqual({})
  })

  it('should show confirmation without session data when a saved record exists', async () => {
    // Arrange
    const client = createClient()

    answerStore.get.mockResolvedValue({ saved: true })

    // Act
    const result = await client.get('/collection-validation/confirmation', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'render', context: { step: { code: 'confirmation' } } })
  })

  it('should keep confirmation unreachable when no saved record exists', async () => {
    // Arrange
    const client = createClient()

    // Act
    const result = await client.get('/collection-validation/confirmation', { session: {} })

    // Assert
    expect(result).toMatchObject({ type: 'redirect' })
    expect(result).not.toMatchObject({ url: '/collection-validation/confirmation' })
  })

  it('should preserve drafts when saving the plan fails', async () => {
    // Arrange
    const client = createClient()
    const goals = [{ title: 'Active goal', status: 'ACTIVE', actions: ['Contact an adviser'] }]
    const session = { draftAnswers: { goals } }

    answerStore.save.mockRejectedValue(new Error('Store unavailable'))

    // Act
    const result = await client.post('/collection-validation/agree-plan', { session, body: { agreePlan: 'yes' } })

    // Assert
    expect(result).toMatchObject({ type: 'error' })
    expect(session).toEqual({ draftAnswers: { goals } })
  })

  it('should delete the saved record when restarting the pattern', async () => {
    // Arrange
    const client = createClient()
    const session = {}

    answerStore.get.mockResolvedValue({ saved: true })
    answerStore.delete.mockImplementation(async () => {
      answerStore.get.mockResolvedValue(undefined)
    })

    // Act
    const restart = await client.post('/collection-validation/confirmation', { session, body: { action: 'restart' } })
    const confirmation = await client.get('/collection-validation/confirmation', { session })

    // Assert
    expect(answerStore.delete).toHaveBeenCalledWith()
    expect(restart).toMatchObject({ type: 'redirect', url: '/collection-validation/overview' })
    expect(confirmation).toMatchObject({ type: 'redirect' })
    expect(confirmation).not.toMatchObject({ url: '/collection-validation/confirmation' })
  })
})
