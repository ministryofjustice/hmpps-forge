import { describe } from 'vitest'

import { runJourneyCases } from '../../contractRunner'
import { cases } from './reachability.cases'

describe('reachability contracts', () => {
  runJourneyCases(cases)
})
