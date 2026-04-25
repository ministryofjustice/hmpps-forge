import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { expressionsOverviewStep } from './overview/step'
import { answerAndSelfStep } from './answer-and-self/step'
import { dataStep } from './data/step'
import { paramsStep } from './params/step'
import { queryStep } from './query/step'
import { postStep } from './post/step'
import { sessionStep } from './session/step'
import { requestStep } from './request/step'
import { itemStep } from './item/step'
import { loopStep } from './loop/step'
import { iteratorsStep } from './item-and-iterators/step'
import { formatStep } from './format/step'
import { literalStep } from './literal/step'
import { generatorsStep } from './generators/step'
import { transformersStep } from './transformers/step'
import { conditionsStep } from './conditions/step'
import { effectsStep } from './effects/step'
import { combinatorsStep } from './combinators/step'
import { conditionalsStep } from './conditionals/step'

export const expressionsJourney = journey({
  code: 'authoring-language',
  title: 'Authoring language',
  path: '/authoring-language',
  view: {
    locals: { showBackToTop: true },
  },
  steps: [
    expressionsOverviewStep,
    answerAndSelfStep,
    dataStep,
    paramsStep,
    queryStep,
    postStep,
    sessionStep,
    requestStep,
    itemStep,
    loopStep,
    iteratorsStep,
    formatStep,
    literalStep,
    generatorsStep,
    transformersStep,
    conditionsStep,
    effectsStep,
    combinatorsStep,
    conditionalsStep,
  ],
})
