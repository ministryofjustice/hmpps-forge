import {
  CollectionBlockDefinition,
  CompositeBlockDefinition,
  FieldBlockDefinition,
  JourneyDefinition,
  StepDefinition,
} from '../types/structures.type'

export function isJourneyDefinition(obj: any): obj is JourneyDefinition {
  return obj != null && obj.type === 'journey'
}

export function isStepDefinition(obj: any): obj is StepDefinition {
  return obj != null && obj.type === 'step'
}

export function isBlockDefinition(obj: any): obj is StepDefinition {
  return obj != null && obj.type === 'block'
}

export function isFieldBlockDefinition(obj: any): obj is FieldBlockDefinition {
  return isBlockDefinition(obj) && 'code' in obj
}

export function isCollectionBlockDefinition(obj: any): obj is CollectionBlockDefinition<any> {
  return isBlockDefinition(obj) && 'collectionContext' in obj
}

export function isCollectionStepDefinition(obj: any): obj is CollectionBlockDefinition<any> {
  return isStepDefinition(obj) && 'collectionContext' in obj
}

export function isCompositeBlockDefinition(obj: any): obj is CompositeBlockDefinition<any> {
  return isBlockDefinition(obj) && 'blocks' in obj
}
