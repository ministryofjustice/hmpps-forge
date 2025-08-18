import NumberConditions from './numberConditions'
import DateConditions from './dateConditions'
import StringConditions from './stringConditions'
import EmailConditions from './emailConditions'
import PhoneConditions from './phoneConditions'
import AddressConditions from './addressConditions'
import ArrayConditions from './arrayConditions'
import GeneralConditions from './generalConditions'

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
}
