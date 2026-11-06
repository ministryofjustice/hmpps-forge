#![allow(unused_imports)]
//! `Condition.*` builders: function call expressions for the built-in conditions.
//! Generated from the TS registrations; argument order matches the TS builders.

use crate::authoring::IntoValue;
use crate::value::Value;

/// A call to any registered condition by name (custom registries included).
pub fn call(name: &str, arguments: Vec<Value>) -> Value {
    let mut arguments = arguments;
    while arguments.last().is_some_and(Value::is_undefined) {
        arguments.pop();
    }
    crate::authoring::function_call("FunctionType.Condition", name, arguments)
}

/// `Condition.IsRequired`
pub fn is_required() -> Value {
    call("IsRequired", vec![])
}

/// `Condition.Equals`
pub fn equals(expected: impl IntoValue) -> Value {
    call("Equals", vec![expected.into_value()])
}

/// `Condition.Address.*`
pub mod address {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Condition.Address.IsValidPostcode`
    pub fn is_valid_postcode() -> Value {
        super::call("Address.IsValidPostcode", vec![])
    }
}

/// `Condition.Array.*`
pub mod array {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Condition.Array.IsArray`
    pub fn is_array() -> Value {
        super::call("Array.IsArray", vec![])
    }

    /// `Condition.Array.IsIn`
    pub fn is_in(expected: impl IntoValue) -> Value {
        super::call("Array.IsIn", vec![expected.into_value()])
    }

    /// `Condition.Array.Contains`
    pub fn contains(expected: impl IntoValue) -> Value {
        super::call("Array.Contains", vec![expected.into_value()])
    }

    /// `Condition.Array.ContainsAny`
    pub fn contains_any(expected: impl IntoValue) -> Value {
        super::call("Array.ContainsAny", vec![expected.into_value()])
    }

    /// `Condition.Array.ContainsAll`
    pub fn contains_all(expected: impl IntoValue) -> Value {
        super::call("Array.ContainsAll", vec![expected.into_value()])
    }
}

/// `Condition.Date.*`
pub mod date {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Condition.Date.IsValid`
    pub fn is_valid() -> Value {
        super::call("Date.IsValid", vec![])
    }

    /// `Condition.Date.IsValidYear`
    pub fn is_valid_year() -> Value {
        super::call("Date.IsValidYear", vec![])
    }

    /// `Condition.Date.IsValidMonth`
    pub fn is_valid_month() -> Value {
        super::call("Date.IsValidMonth", vec![])
    }

    /// `Condition.Date.IsValidDay`
    pub fn is_valid_day() -> Value {
        super::call("Date.IsValidDay", vec![])
    }

    /// `Condition.Date.IsBefore`
    pub fn is_before(date_str: impl IntoValue) -> Value {
        super::call("Date.IsBefore", vec![date_str.into_value()])
    }

    /// `Condition.Date.IsAfter`
    pub fn is_after(date_str: impl IntoValue) -> Value {
        super::call("Date.IsAfter", vec![date_str.into_value()])
    }

    /// `Condition.Date.IsFutureDate`
    pub fn is_future_date() -> Value {
        super::call("Date.IsFutureDate", vec![])
    }

    /// `Condition.Date.IsPastDate`
    pub fn is_past_date() -> Value {
        super::call("Date.IsPastDate", vec![])
    }

    /// `Condition.Date.IsToday`
    pub fn is_today() -> Value {
        super::call("Date.IsToday", vec![])
    }
}

/// `Condition.Email.*`
pub mod email {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Condition.Email.IsValidEmail`
    pub fn is_valid_email() -> Value {
        super::call("Email.IsValidEmail", vec![])
    }
}

/// `Condition.Number.*`
pub mod number {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Condition.Number.IsNumber`
    pub fn is_number() -> Value {
        super::call("Number.IsNumber", vec![])
    }

    /// `Condition.Number.IsInteger`
    pub fn is_integer() -> Value {
        super::call("Number.IsInteger", vec![])
    }

    /// `Condition.Number.GreaterThan`
    pub fn greater_than(threshold: impl IntoValue) -> Value {
        super::call("Number.GreaterThan", vec![threshold.into_value()])
    }

    /// `Condition.Number.GreaterThanOrEqual`
    pub fn greater_than_or_equal(threshold: impl IntoValue) -> Value {
        super::call("Number.GreaterThanOrEqual", vec![threshold.into_value()])
    }

    /// `Condition.Number.LessThan`
    pub fn less_than(threshold: impl IntoValue) -> Value {
        super::call("Number.LessThan", vec![threshold.into_value()])
    }

    /// `Condition.Number.LessThanOrEqual`
    pub fn less_than_or_equal(threshold: impl IntoValue) -> Value {
        super::call("Number.LessThanOrEqual", vec![threshold.into_value()])
    }

    /// `Condition.Number.Between`
    pub fn between(min: impl IntoValue, max: impl IntoValue) -> Value {
        super::call("Number.Between", vec![min.into_value(), max.into_value()])
    }
}

/// `Condition.Object.*`
pub mod object {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Condition.Object.IsObject`
    pub fn is_object() -> Value {
        super::call("Object.IsObject", vec![])
    }

    /// `Condition.Object.HasProperty`
    pub fn has_property(path: impl IntoValue) -> Value {
        super::call("Object.HasProperty", vec![path.into_value()])
    }

    /// `Condition.Object.PropertyIsEmpty`
    pub fn property_is_empty(path: impl IntoValue) -> Value {
        super::call("Object.PropertyIsEmpty", vec![path.into_value()])
    }

    /// `Condition.Object.PropertyHasValue`
    pub fn property_has_value(path: impl IntoValue) -> Value {
        super::call("Object.PropertyHasValue", vec![path.into_value()])
    }
}

/// `Condition.Phone.*`
pub mod phone {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Condition.Phone.IsValidPhoneNumber`
    pub fn is_valid_phone_number() -> Value {
        super::call("Phone.IsValidPhoneNumber", vec![])
    }

    /// `Condition.Phone.IsValidUKMobile`
    pub fn is_valid_uk_mobile() -> Value {
        super::call("Phone.IsValidUKMobile", vec![])
    }
}

/// `Condition.String.*`
pub mod string {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Condition.String.MatchesRegex`
    pub fn matches_regex(pattern: impl IntoValue) -> Value {
        super::call("String.MatchesRegex", vec![pattern.into_value()])
    }

    /// `Condition.String.HasMinLength`
    pub fn has_min_length(min: impl IntoValue) -> Value {
        super::call("String.HasMinLength", vec![min.into_value()])
    }

    /// `Condition.String.HasMaxLength`
    pub fn has_max_length(max: impl IntoValue) -> Value {
        super::call("String.HasMaxLength", vec![max.into_value()])
    }

    /// `Condition.String.HasExactLength`
    pub fn has_exact_length(len: impl IntoValue) -> Value {
        super::call("String.HasExactLength", vec![len.into_value()])
    }

    /// `Condition.String.HasMaxWords`
    pub fn has_max_words(max_words: impl IntoValue) -> Value {
        super::call("String.HasMaxWords", vec![max_words.into_value()])
    }

    /// `Condition.String.LettersOnly`
    pub fn letters_only() -> Value {
        super::call("String.LettersOnly", vec![])
    }

    /// `Condition.String.DigitsOnly`
    pub fn digits_only() -> Value {
        super::call("String.DigitsOnly", vec![])
    }

    /// `Condition.String.LettersWithCommonPunctuation`
    pub fn letters_with_common_punctuation() -> Value {
        super::call("String.LettersWithCommonPunctuation", vec![])
    }

    /// `Condition.String.LettersWithSpaceDashApostrophe`
    pub fn letters_with_space_dash_apostrophe() -> Value {
        super::call("String.LettersWithSpaceDashApostrophe", vec![])
    }

    /// `Condition.String.LettersAndDigitsOnly`
    pub fn letters_and_digits_only() -> Value {
        super::call("String.LettersAndDigitsOnly", vec![])
    }

    /// `Condition.String.AlphanumericWithCommonPunctuation`
    pub fn alphanumeric_with_common_punctuation() -> Value {
        super::call("String.AlphanumericWithCommonPunctuation", vec![])
    }

    /// `Condition.String.AlphanumericWithAllSafeSymbols`
    pub fn alphanumeric_with_all_safe_symbols() -> Value {
        super::call("String.AlphanumericWithAllSafeSymbols", vec![])
    }

    /// `Condition.String.StartsWith`
    pub fn starts_with(prefix: impl IntoValue) -> Value {
        super::call("String.StartsWith", vec![prefix.into_value()])
    }

    /// `Condition.String.EndsWith`
    pub fn ends_with(suffix: impl IntoValue) -> Value {
        super::call("String.EndsWith", vec![suffix.into_value()])
    }

    /// `Condition.String.Contains`
    pub fn contains(substring: impl IntoValue) -> Value {
        super::call("String.Contains", vec![substring.into_value()])
    }
}
