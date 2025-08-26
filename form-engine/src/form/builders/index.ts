import { finaliseBuilders } from './utils/finaliseBuilders'
import {
  BlockDefinition,
  FieldBlockDefinition,
  JourneyDefinition,
  StepDefinition,
  ValidationExpr,
} from '../types/structures.type'
import { SkipValidationTransition, TransitionExpr, ValidatingTransition } from '../types/expressions.type'
import { StructureType } from '../types/enums'

export function block<D extends BlockDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.BLOCK,
  }) as D
}

export function field<D extends FieldBlockDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.BLOCK,
  }) as D
}

export function step<D extends StepDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.STEP,
  }) as D
}

export function journey<D extends JourneyDefinition>(definition: Omit<D, 'type'>): D {
  return finaliseBuilders({
    ...definition,
    type: StructureType.JOURNEY,
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

export function validation(definition: Omit<ValidationExpr, 'type'>): ValidationExpr {
  return finaliseBuilders({
    ...definition,
    type: 'validation',
  }) as any
}
