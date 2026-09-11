import { Data, Format, step } from '@ministryofjustice/hmpps-forge/core/authoring'
import { TemplateWrapper } from '@ministryofjustice/hmpps-forge/core/components'
import { GovUKHeading, GovUKBody, GovUKLinkButton, GovUKSectionBreak } from '@ministryofjustice/hmpps-forge/govuk-components'
import { LotteryBall } from './lotteryBall'

const heading = GovUKHeading({ text: 'Your lottery draw', size: 'l' })

const drawDate = GovUKBody({
  text: Format('Drawn on %1', Data('drawDate')),
})

const numbersRow = TemplateWrapper({
  template: '<div class="lottery-ball-row" style="display:flex;gap:15px;flex-wrap:wrap;margin-bottom:20px">{{slot:balls}}</div>',
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

const sectionBreak = GovUKSectionBreak({ size: 'm', visible: true })

const bonusBallLabel = GovUKHeading({ text: 'Bonus ball', size: 'm' })

const bonusBall = LotteryBall({
  number: Data('bonusBall'),
  color: 'green',
  classes: 'lottery-ball--block',
})

const drawAgainButton = GovUKLinkButton({
  text: 'Draw again',
  href: '/load-reference-data/draw',
  classes: 'govuk-button--secondary',
})

export const drawStep = step({
  path: '/draw',
  title: 'Your lottery draw',
  reachability: { entryWhen: true },
  metadata: { hiddenFromNav: true },
  blocks: [heading, drawDate, numbersRow, sectionBreak, bonusBallLabel, bonusBall, drawAgainButton],
})
