import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { describe, expect, it } from 'vitest'
import patternPackage from './journey'

describe('inlineFunctionsDemoJourney', () => {
  it('should produce matching dashboard blocks when both implementations load the case', async () => {
    // Arrange
    const client = new ForgeTestHarness().registerPackage(patternPackage).createClient()

    // Act
    const before = await client.get('/inline-functions/before')
    const after = await client.get('/inline-functions/after')

    // Assert
    expect(before.type).toBe('render')
    expect(after.type).toBe('render')

    if (before.type !== 'render' || after.type !== 'render') {
      throw new Error('Expected both dashboards to render')
    }

    const beforeContent = before.context.blocks
      .slice(0, -1)
      .map(({ id, ...block }) => block)
    const afterContent = after.context.blocks
      .slice(0, -1)
      .map(({ id, ...block }) => block)

    expect(beforeContent).toEqual(afterContent)
    expect(after.context.data).toMatchObject({ goalsAchieved: 1, goalsTotal: 5, complianceRate: 89 })
  })
})
