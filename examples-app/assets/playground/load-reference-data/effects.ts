import { effect, type EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { LotteryService } from './LotteryService'

export type PatternDependencies = {
  lotteryService: Pick<LotteryService, 'getLotteryBalls'>
}

/** Loads fresh reference data before the page renders. */
export const drawLotteryNumbers = effect({
  name: 'DrawLotteryNumbers',
  factory: ({ lotteryService }: PatternDependencies) => async (context: EffectFunctionContext) => {
    const draw = await lotteryService.getLotteryBalls()

    draw.balls.forEach((number, index) => context.setData(`ball${index + 1}`, String(number)))
    context.setData('bonusBall', String(draw.bonusBall))
    context.setData('drawDate', draw.drawDate)
  },
})
