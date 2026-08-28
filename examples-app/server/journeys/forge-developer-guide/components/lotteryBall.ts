import { component } from '@ministryofjustice/hmpps-forge/core/components'

export interface LotteryBall {
  number: string
  color?: 'blue' | 'green'
  classes?: string
}

export const LotteryBall = component<LotteryBall>('lotteryBall', {
  render: block => {
    const num = String(block.number ?? '')
    const colorClass = `lottery-ball--${block.color ?? 'blue'}`
    const extraClasses = block.classes ? ` ${block.classes}` : ''

    return `<div class="lottery-ball ${colorClass}${extraClasses}">
    <span class="lottery-ball__number">${num}</span>
  </div>`
  },
})
