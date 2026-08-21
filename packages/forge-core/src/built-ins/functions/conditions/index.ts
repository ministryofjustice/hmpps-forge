import { GeneralConditions } from './generalConditions'
import { StringConditions } from './stringConditions'
import { FunctionEntryRegistry } from '../../../authoring/functions/FunctionEntryRegistry'
import { AddressConditions } from './addressConditions'
import { EmailConditions } from './emailConditions'
import { DateConditions } from './dateConditions'
import { NumberConditions } from './numberConditions'
import { PhoneConditions } from './phoneConditions'
import { ArrayConditions } from './arrayConditions'
import { ObjectConditions } from './objectConditions'

// TypeScript declaration emit drops JSDoc when it structurally expands a type
// imported from another file, so the built .d.ts would lose every per-function
// doc comment. Annotating with `typeof` references makes the emitter print a
// reference instead of expanding, keeping the docs on each group's own declaration.
interface ConditionGroups {
  /** Conditions for handling strings */
  String: typeof StringConditions

  /** Conditions for handling emails */
  Email: typeof EmailConditions

  /** Conditions for handling phone/mobile numbers */
  Phone: typeof PhoneConditions

  /** Conditions for handling addresses */
  Address: typeof AddressConditions

  /** Conditions for handling dates */
  Date: typeof DateConditions

  /** Conditions for handling numbers */
  Number: typeof NumberConditions

  /** Conditions for handling arrays */
  Array: typeof ArrayConditions

  /** Conditions for handling objects */
  Object: typeof ObjectConditions
}

export const Condition: typeof GeneralConditions & ConditionGroups = {
  ...GeneralConditions,

  /** Conditions for handling strings */
  String: StringConditions,

  /** Conditions for handling emails */
  Email: EmailConditions,

  /** Conditions for handling phone/mobile numbers */
  Phone: PhoneConditions,

  /** Conditions for handling addresses */
  Address: AddressConditions,

  /** Conditions for handling dates */
  Date: DateConditions,

  /** Conditions for handling numbers */
  Number: NumberConditions,

  /** Conditions for handling arrays */
  Array: ArrayConditions,

  /** Conditions for handling objects */
  Object: ObjectConditions,
}

export const ConditionsRegistry = (() => {
  const entryRegistry = new FunctionEntryRegistry()
  const conditionGroups = [
    GeneralConditions,
    StringConditions,
    EmailConditions,
    PhoneConditions,
    AddressConditions,
    DateConditions,
    NumberConditions,
    ArrayConditions,
    ObjectConditions,
  ]

  conditionGroups.forEach(entries => Object.values(entries).forEach(entry => entryRegistry.collectListed(entry)))

  return entryRegistry.build()
})()
