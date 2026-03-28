import { GeneralConditions, GeneralConditionsRegistry } from '@form-engine/registry/conditions/generalConditions'
import { StringConditions, StringConditionsRegistry } from '@form-engine/registry/conditions/stringConditions'
import { AddressConditions, AddressConditionsRegistry } from '@form-engine/registry/conditions/addressConditions'
import { EmailConditions, EmailConditionsRegistry } from '@form-engine/registry/conditions/emailConditions'
import { DateConditions, DateConditionsRegistry } from '@form-engine/registry/conditions/dateConditions'
import { NumberConditions, NumberConditionsRegistry } from './numberConditions'
import { PhoneConditions, PhoneConditionsRegistry } from './phoneConditions'
import { ArrayConditions, ArrayConditionsRegistry } from './arrayConditions'
import { ObjectConditions, ObjectConditionsRegistry } from './objectConditions'

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
  ...GeneralConditionsRegistry,
  ...StringConditionsRegistry,
  ...EmailConditionsRegistry,
  ...PhoneConditionsRegistry,
  ...AddressConditionsRegistry,
  ...DateConditionsRegistry,
  ...NumberConditionsRegistry,
  ...ArrayConditionsRegistry,
  ...ObjectConditionsRegistry,
}
