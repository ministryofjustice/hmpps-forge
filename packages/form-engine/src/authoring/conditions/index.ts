import { GeneralConditions, GeneralConditionsRegistry } from './generalConditions'
import { StringConditions, StringConditionsRegistry } from './stringConditions'
import { AddressConditions, AddressConditionsRegistry } from './addressConditions'
import { EmailConditions, EmailConditionsRegistry } from './emailConditions'
import { DateConditions, DateConditionsRegistry } from './dateConditions'
import { NumberConditions, NumberConditionsRegistry } from './numberConditions'
import { PhoneConditions, PhoneConditionsRegistry } from './phoneConditions'
import { ArrayConditions, ArrayConditionsRegistry } from './arrayConditions'
import { ObjectConditions, ObjectConditionsRegistry } from './objectConditions'
import { createFunctionsRegistry } from '../utils/defineFunction'

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

export const ConditionsRegistry = createFunctionsRegistry({
  ...GeneralConditionsRegistry,
  ...StringConditionsRegistry,
  ...EmailConditionsRegistry,
  ...PhoneConditionsRegistry,
  ...AddressConditionsRegistry,
  ...DateConditionsRegistry,
  ...NumberConditionsRegistry,
  ...ArrayConditionsRegistry,
  ...ObjectConditionsRegistry,
})
