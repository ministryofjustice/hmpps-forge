import { GeneralConditions, generalConditionsRegistry } from './generalConditions'
import { StringConditions, stringConditionsRegistry } from './stringConditions'
import { AddressConditions, addressConditionsRegistry } from './addressConditions'
import { EmailConditions, emailConditionsRegistry } from './emailConditions'
import { DateConditions, dateConditionsRegistry } from './dateConditions'
import { NumberConditions, numberConditionsRegistry } from './numberConditions'
import { PhoneConditions, phoneConditionsRegistry } from './phoneConditions'
import { ArrayConditions, arrayConditionsRegistry } from './arrayConditions'
import { ObjectConditions, objectConditionsRegistry } from './objectConditions'

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

export const ConditionsRegistry = {
  ...generalConditionsRegistry.build(),
  ...stringConditionsRegistry.build(),
  ...emailConditionsRegistry.build(),
  ...phoneConditionsRegistry.build(),
  ...addressConditionsRegistry.build(),
  ...dateConditionsRegistry.build(),
  ...numberConditionsRegistry.build(),
  ...arrayConditionsRegistry.build(),
  ...objectConditionsRegistry.build(),
}
