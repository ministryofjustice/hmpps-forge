import { component } from '@ministryofjustice/hmpps-forge/core/components'

export interface LotteryBall {
  number: string
  color?: 'blue' | 'green'
  classes?: string
}

export const LotteryBall = component<LotteryBall>('lotteryBall', {
  factory: () => props => {
    const num = Number(props.number)
    const colorClass = `lottery-ball--${props.color ?? 'blue'}`
    const extraClasses = props.classes ? ` ${props.classes}` : ''

    const background = props.color === 'green' ? '#00703c' : '#1d70b8'

    return `<div class="lottery-ball ${colorClass}${extraClasses}" style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:${background}">
    <span class="lottery-ball__number" style="color:white;font-size:24px;font-weight:bold">${num}</span>
  </div>`
  },
})
