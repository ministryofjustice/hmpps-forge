import { buildComponent } from '@ministryofjustice/hmpps-forge/core/components'
import { block as blockBuilder } from '@ministryofjustice/hmpps-forge/core/authoring'
import type {
  BasicBlockProps,
  BlockDefinition,
  ResolvableString,
} from '@ministryofjustice/hmpps-forge/core/components'

export interface LotteryBallProps extends BasicBlockProps {
  number: ResolvableString
  color?: 'blue' | 'green'
  classes?: string
}

export interface LotteryBall extends BlockDefinition, LotteryBallProps {
  variant: 'lotteryBall'
}

export const lotteryBallComponent = buildComponent<LotteryBall>('lotteryBall', block => {
  const num = String(block.number ?? '')
  const colorClass = `lottery-ball--${block.color ?? 'blue'}`
  const extraClasses = block.classes ? ` ${block.classes}` : ''

  return `<div class="lottery-ball ${colorClass}${extraClasses}">
    <span class="lottery-ball__number">${num}</span>
  </div>`
})

export function LotteryBall(props: LotteryBallProps): LotteryBall {
  return blockBuilder<LotteryBall>({ ...props, variant: 'lotteryBall' })
}
