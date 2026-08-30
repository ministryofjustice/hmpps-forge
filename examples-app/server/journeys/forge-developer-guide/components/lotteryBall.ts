import { component } from '@ministryofjustice/hmpps-forge/core/components'

export interface LotteryBall {
  number: string
  color?: 'blue' | 'green'
  classes?: string
}

export const LotteryBall = component<LotteryBall>('lotteryBall', {
  factory:
    () =>
    ({ props }) => {
      const num = String(props.number ?? '')
      const colorClass = `lottery-ball--${props.color ?? 'blue'}`
      const extraClasses = props.classes ? ` ${props.classes}` : ''

      return `<div class="lottery-ball ${colorClass}${extraClasses}">
    <span class="lottery-ball__number">${num}</span>
  </div>`
    },
})
