import { finaliseBuilders } from './utils/finaliseBuilders'
import { BlockDefinition, FieldBlockDefinition, JourneyDefinition, StepDefinition } from '../types/structures.type'
import { SkipValidationTransition, TransitionExpr, ValidatingTransition } from '../types/expressions.type'

export function block<D extends BlockDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: 'block',
  }) as D
}

export function field<D extends FieldBlockDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: 'block',
  }) as D
}

export function step<D extends StepDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: 'step',
  }) as D
}

export function journey<D extends JourneyDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: 'journey',
  }) as D
}

export function transition(definition: Omit<ValidatingTransition, 'type'>): ValidatingTransition
export function transition(definition: Omit<SkipValidationTransition, 'type'>): SkipValidationTransition
export function transition(definition: Omit<TransitionExpr, 'type'>): TransitionExpr {
  return finaliseBuilders({
    ...definition,
    type: 'transition',
  }) as any
}
