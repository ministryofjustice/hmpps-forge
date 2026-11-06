#![allow(unused_imports)]
//! `Transformer.*` builders: function call expressions for the built-in transformers.
//! Generated from the TS registrations; argument order matches the TS builders.

use crate::authoring::IntoValue;
use crate::value::Value;

/// A call to any registered transformer by name (custom registries included).
pub fn call(name: &str, arguments: Vec<Value>) -> Value {
    let mut arguments = arguments;
    while arguments.last().is_some_and(Value::is_undefined) {
        arguments.pop();
    }
    crate::authoring::function_call("FunctionType.Transformer", name, arguments)
}

/// `Transformer.Array.*`
pub mod array {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Transformer.Array.Length`
    pub fn length() -> Value {
        super::call("Array.Length", vec![])
    }

    /// `Transformer.Array.First`
    pub fn first() -> Value {
        super::call("Array.First", vec![])
    }

    /// `Transformer.Array.Last`
    pub fn last() -> Value {
        super::call("Array.Last", vec![])
    }

    /// `Transformer.Array.Reverse`
    pub fn reverse() -> Value {
        super::call("Array.Reverse", vec![])
    }

    /// `Transformer.Array.Join`
    pub fn join(separator: impl IntoValue) -> Value {
        super::call("Array.Join", vec![separator.into_value()])
    }

    /// `Transformer.Array.Slice`
    pub fn slice(start: impl IntoValue, end: impl IntoValue) -> Value {
        super::call("Array.Slice", vec![start.into_value(), end.into_value()])
    }

    /// `Transformer.Array.Concat`
    pub fn concat(rest: Vec<Value>) -> Value {
        let mut arguments: Vec<Value> = vec![];
        arguments.extend(rest);
        super::call("Array.Concat", arguments)
    }

    /// `Transformer.Array.Unique`
    pub fn unique() -> Value {
        super::call("Array.Unique", vec![])
    }

    /// `Transformer.Array.Sort`
    pub fn sort() -> Value {
        super::call("Array.Sort", vec![])
    }

    /// `Transformer.Array.Filter`
    pub fn filter(filter_value: impl IntoValue) -> Value {
        super::call("Array.Filter", vec![filter_value.into_value()])
    }

    /// `Transformer.Array.Map`
    pub fn map(property: impl IntoValue) -> Value {
        super::call("Array.Map", vec![property.into_value()])
    }

    /// `Transformer.Array.Flatten`
    pub fn flatten() -> Value {
        super::call("Array.Flatten", vec![])
    }
}

/// `Transformer.Date.*`
pub mod date {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Transformer.Date.Format`
    pub fn format(format: impl IntoValue) -> Value {
        super::call("Date.Format", vec![format.into_value()])
    }

    /// `Transformer.Date.AddDays`
    pub fn add_days(days: impl IntoValue) -> Value {
        super::call("Date.AddDays", vec![days.into_value()])
    }

    /// `Transformer.Date.SubtractDays`
    pub fn subtract_days(days: impl IntoValue) -> Value {
        super::call("Date.SubtractDays", vec![days.into_value()])
    }

    /// `Transformer.Date.AddMonths`
    pub fn add_months(months: impl IntoValue) -> Value {
        super::call("Date.AddMonths", vec![months.into_value()])
    }

    /// `Transformer.Date.AddYears`
    pub fn add_years(years: impl IntoValue) -> Value {
        super::call("Date.AddYears", vec![years.into_value()])
    }

    /// `Transformer.Date.StartOfDay`
    pub fn start_of_day() -> Value {
        super::call("Date.StartOfDay", vec![])
    }

    /// `Transformer.Date.EndOfDay`
    pub fn end_of_day() -> Value {
        super::call("Date.EndOfDay", vec![])
    }

    /// `Transformer.Date.ToISOString`
    pub fn to_iso_string() -> Value {
        super::call("Date.ToISOString", vec![])
    }

    /// `Transformer.Date.ToLocaleString`
    pub fn to_locale_string(locale: impl IntoValue) -> Value {
        super::call("Date.ToLocaleString", vec![locale.into_value()])
    }

    /// `Transformer.Date.ToUKLongDate`
    pub fn to_uk_long_date() -> Value {
        super::call("Date.ToUKLongDate", vec![])
    }
}

/// `Transformer.Number.*`
pub mod number {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Transformer.Number.Add`
    pub fn add(addend: impl IntoValue) -> Value {
        super::call("Number.Add", vec![addend.into_value()])
    }

    /// `Transformer.Number.Subtract`
    pub fn subtract(subtrahend: impl IntoValue) -> Value {
        super::call("Number.Subtract", vec![subtrahend.into_value()])
    }

    /// `Transformer.Number.Multiply`
    pub fn multiply(multiplier: impl IntoValue) -> Value {
        super::call("Number.Multiply", vec![multiplier.into_value()])
    }

    /// `Transformer.Number.Divide`
    pub fn divide(divisor: impl IntoValue) -> Value {
        super::call("Number.Divide", vec![divisor.into_value()])
    }

    /// `Transformer.Number.Abs`
    pub fn abs() -> Value {
        super::call("Number.Abs", vec![])
    }

    /// `Transformer.Number.Round`
    pub fn round() -> Value {
        super::call("Number.Round", vec![])
    }

    /// `Transformer.Number.Floor`
    pub fn floor() -> Value {
        super::call("Number.Floor", vec![])
    }

    /// `Transformer.Number.Ceil`
    pub fn ceil() -> Value {
        super::call("Number.Ceil", vec![])
    }

    /// `Transformer.Number.ToFixed`
    pub fn to_fixed(decimals: impl IntoValue) -> Value {
        super::call("Number.ToFixed", vec![decimals.into_value()])
    }

    /// `Transformer.Number.Max`
    pub fn max(comparison: impl IntoValue) -> Value {
        super::call("Number.Max", vec![comparison.into_value()])
    }

    /// `Transformer.Number.Min`
    pub fn min(comparison: impl IntoValue) -> Value {
        super::call("Number.Min", vec![comparison.into_value()])
    }

    /// `Transformer.Number.Power`
    pub fn power(exponent: impl IntoValue) -> Value {
        super::call("Number.Power", vec![exponent.into_value()])
    }

    /// `Transformer.Number.Sqrt`
    pub fn sqrt() -> Value {
        super::call("Number.Sqrt", vec![])
    }

    /// `Transformer.Number.Clamp`
    pub fn clamp(min: impl IntoValue, max: impl IntoValue) -> Value {
        super::call("Number.Clamp", vec![min.into_value(), max.into_value()])
    }
}

/// `Transformer.Object.*`
pub mod object {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Transformer.Object.ToISO`
    pub fn to_iso(paths: impl IntoValue) -> Value {
        super::call("Object.ToISO", vec![paths.into_value()])
    }

    /// `Transformer.Object.FromISO`
    pub fn from_iso(paths: impl IntoValue) -> Value {
        super::call("Object.FromISO", vec![paths.into_value()])
    }
}

/// `Transformer.String.*`
pub mod string {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Transformer.String.Trim`
    pub fn trim() -> Value {
        super::call("String.Trim", vec![])
    }

    /// `Transformer.String.ToUpperCase`
    pub fn to_upper_case() -> Value {
        super::call("String.ToUpperCase", vec![])
    }

    /// `Transformer.String.ToLowerCase`
    pub fn to_lower_case() -> Value {
        super::call("String.ToLowerCase", vec![])
    }

    /// `Transformer.String.ToTitleCase`
    pub fn to_title_case() -> Value {
        super::call("String.ToTitleCase", vec![])
    }

    /// `Transformer.String.Capitalize`
    pub fn capitalize() -> Value {
        super::call("String.Capitalize", vec![])
    }

    /// `Transformer.String.Possessive`
    pub fn possessive() -> Value {
        super::call("String.Possessive", vec![])
    }

    /// `Transformer.String.Substring`
    pub fn substring(start: impl IntoValue, end: impl IntoValue) -> Value {
        super::call("String.Substring", vec![start.into_value(), end.into_value()])
    }

    /// `Transformer.String.Replace`
    pub fn replace(search_value: impl IntoValue, replace_value: impl IntoValue) -> Value {
        super::call("String.Replace", vec![search_value.into_value(), replace_value.into_value()])
    }

    /// `Transformer.String.PadStart`
    pub fn pad_start(target_length: impl IntoValue, pad_string: impl IntoValue) -> Value {
        super::call("String.PadStart", vec![target_length.into_value(), pad_string.into_value()])
    }

    /// `Transformer.String.PadEnd`
    pub fn pad_end(target_length: impl IntoValue, pad_string: impl IntoValue) -> Value {
        super::call("String.PadEnd", vec![target_length.into_value(), pad_string.into_value()])
    }

    /// `Transformer.String.ToInt`
    pub fn to_int() -> Value {
        super::call("String.ToInt", vec![])
    }

    /// `Transformer.String.ToFloat`
    pub fn to_float() -> Value {
        super::call("String.ToFloat", vec![])
    }

    /// `Transformer.String.ToArray`
    pub fn to_array(separator: impl IntoValue) -> Value {
        super::call("String.ToArray", vec![separator.into_value()])
    }

    /// `Transformer.String.ToDate`
    pub fn to_date() -> Value {
        super::call("String.ToDate", vec![])
    }

    /// `Transformer.String.FormatDate`
    pub fn format_date(options: impl IntoValue) -> Value {
        super::call("String.FormatDate", vec![options.into_value()])
    }

    /// `Transformer.String.ToISODate`
    pub fn to_iso_date() -> Value {
        super::call("String.ToISODate", vec![])
    }

    /// `Transformer.String.ToTimestampDate`
    pub fn to_timestamp_date() -> Value {
        super::call("String.ToTimestampDate", vec![])
    }

    /// `Transformer.String.EscapeHtml`
    pub fn escape_html() -> Value {
        super::call("String.EscapeHtml", vec![])
    }
}
