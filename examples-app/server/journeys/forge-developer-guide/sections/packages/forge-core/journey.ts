import { journey } from '@ministryofjustice/hmpps-forge/core/authoring'
import { forgeCoreOverviewStep } from './overview/step'
import { collectionBlockStep } from './collection-block/step'
import { htmlBlockStep } from './html-block/step'
import { templateWrapperStep } from './template-wrapper/step'
import { conditionsAddressStep } from './conditions-address/step'
import { conditionsArrayStep } from './conditions-array/step'
import { conditionsDateStep } from './conditions-date/step'
import { conditionsEmailStep } from './conditions-email/step'
import { conditionsGeneralStep } from './conditions-general/step'
import { conditionsNumberStep } from './conditions-number/step'
import { conditionsObjectStep } from './conditions-object/step'
import { conditionsPhoneStep } from './conditions-phone/step'
import { conditionsStringStep } from './conditions-string/step'
import { generatorsDateStep } from './generators-date/step'
import { transformersArrayStep } from './transformers-array/step'
import { transformersDateStep } from './transformers-date/step'
import { transformersNumberStep } from './transformers-number/step'
import { transformersObjectStep } from './transformers-object/step'
import { transformersStringStep } from './transformers-string/step'

export const forgeCoreJourney = journey({
  code: 'forge-core',
  title: 'Forge Core',
  path: '/forge-core',
  view: {
    locals: { showBackToTop: true },
  },
  steps: [
    forgeCoreOverviewStep,
    collectionBlockStep,
    htmlBlockStep,
    templateWrapperStep,
    conditionsAddressStep,
    conditionsArrayStep,
    conditionsDateStep,
    conditionsEmailStep,
    conditionsGeneralStep,
    conditionsNumberStep,
    conditionsObjectStep,
    conditionsPhoneStep,
    conditionsStringStep,
    generatorsDateStep,
    transformersArrayStep,
    transformersDateStep,
    transformersNumberStep,
    transformersObjectStep,
    transformersStringStep,
  ],
})
