import { GeneralConditions, generalConditionsRegistry } from './generalConditions'
import { StringConditions, stringConditionsRegistry } from './stringConditions'
import { AddressConditions, addressConditionsRegistry } from './addressConditions'
import { EmailConditions, emailConditionsRegistry } from './emailConditions'
import { DateConditions, dateConditionsRegistry } from './dateConditions'
import { NumberConditions, numberConditionsRegistry } from './numberConditions'
import { PhoneConditions, phoneConditionsRegistry } from './phoneConditions'
import { ArrayConditions, arrayConditionsRegistry } from './arrayConditions'
import { ObjectConditions, objectConditionsRegistry } from './objectConditions'

export const Condition = {
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
