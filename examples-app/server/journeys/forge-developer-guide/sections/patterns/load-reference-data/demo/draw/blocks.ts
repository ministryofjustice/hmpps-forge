import { Data, Format } from '@ministryofjustice/hmpps-forge/core/authoring'
import { TemplateWrapper } from '@ministryofjustice/hmpps-forge/core/components'
import {
  GovUKHeading,
  GovUKBody,
  GovUKLinkButton,
  GovUKSectionBreak,
} from '@ministryofjustice/hmpps-forge/govuk-components'
import { LotteryBall } from '../../../../../components/lotteryBall'

export const heading = GovUKHeading({ text: 'Your lottery draw', size: 'l' })

export const drawDate = GovUKBody({
  text: Format('Drawn on %1', Data('drawDate')),
})

export const numbersRow = TemplateWrapper({
  template: '<div class="lottery-ball-row">{{slot:balls}}</div>',
  slots: {
    balls: [
      LotteryBall({ number: Data('ball1') }),
      LotteryBall({ number: Data('ball2') }),
      LotteryBall({ number: Data('ball3') }),
      LotteryBall({ number: Data('ball4') }),
      LotteryBall({ number: Data('ball5') }),
      LotteryBall({ number: Data('ball6') }),
    ],
  },
})

export const sectionBreak = GovUKSectionBreak({ size: 'm', visible: true })

export const bonusBallLabel = GovUKHeading({ text: 'Bonus ball', size: 'm' })

export const bonusBall = LotteryBall({
  number: Data('bonusBall'),
  color: 'green',
  classes: 'lottery-ball--block',
})

export const drawAgainButton = GovUKLinkButton({
  text: 'Draw again',
  href: '/forge-developer-guide/patterns/demos/load-reference-data/draw',
  classes: 'govuk-button--secondary',
})
