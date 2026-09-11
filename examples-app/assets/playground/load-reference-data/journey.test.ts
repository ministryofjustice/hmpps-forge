import { ForgeTestHarness } from '@ministryofjustice/hmpps-forge/core/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import patternPackage from './journey'

const lotteryService = { getLotteryBalls: vi.fn() }
const createClient = () => new ForgeTestHarness().registerPackage(patternPackage, { lotteryService }).createClient()

describe('loadReferenceDataDemoJourney', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should load fresh draw data when the visitor returns to the draw page', async () => {
    // Arrange
    const client = createClient()

    lotteryService.getLotteryBalls
      .mockResolvedValueOnce({ balls: [1, 2, 3, 4, 5, 6], bonusBall: 7, drawDate: '11/09/2026' })
      .mockResolvedValueOnce({ balls: [10, 20, 30, 40, 50, 59], bonusBall: 9, drawDate: '12/09/2026' })

    // Act
    const firstDraw = await client.get('/load-reference-data/draw')
    const secondDraw = await client.get('/load-reference-data/draw')

    // Assert
    expect(lotteryService.getLotteryBalls).toHaveBeenCalledTimes(2)
    expect(firstDraw).toMatchObject({ type: 'render', context: { data: {
      ball1: '1', ball6: '6', bonusBall: '7', drawDate: '11/09/2026',
    } } })
    expect(secondDraw).toMatchObject({ type: 'render', context: { data: {
      ball1: '10', ball6: '59', bonusBall: '9', drawDate: '12/09/2026',
    } } })
  })

  it('should return an error when the reference service fails', async () => {
    // Arrange
    const client = createClient()

    lotteryService.getLotteryBalls.mockRejectedValue(new Error('Service unavailable'))

    // Act
    const result = await client.get('/load-reference-data/draw')

    // Assert
    expect(result).toMatchObject({ type: 'error' })
  })
})
