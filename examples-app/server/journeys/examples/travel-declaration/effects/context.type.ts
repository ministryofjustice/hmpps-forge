import { EffectFunctionContext } from '@ministryofjustice/hmpps-forge/core/authoring'
import { ExampleJourneySession } from '../../context.type'

export interface Trip {
  country: string
  departureDate: string
  returnDate: string
  reason: 'holiday' | 'work' | 'family' | 'education' | 'medical' | 'other'
  details?: string
}

export interface TravelFormAnswers extends Record<string, unknown> {
  hasTravelled: 'yes' | 'no'
  trips: Trip[]
  tripCountry: string
  tripDepartureDate: string
  tripReturnDate: string
  tripReason: 'holiday' | 'work' | 'family' | 'education' | 'medical' | 'other'
  tripDetails: string
}

export type TravelDeclarationContext = EffectFunctionContext<
  Record<string, unknown>,
  TravelFormAnswers,
  ExampleJourneySession
>
