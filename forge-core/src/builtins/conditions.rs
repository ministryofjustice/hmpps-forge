//! Built-in conditions (port of `built-ins/functions/conditions`).

use std::sync::LazyLock;

use fancy_regex::Regex;

use super::{arg, js_regex, js_trim};
use crate::engine::errors::ForgeError;
use crate::engine::registries::FunctionEntry;
use crate::jsdate::JsDate;
use crate::schema::Schema;
use crate::value::{utf16_len, Value};

fn re(pattern: &str) -> Regex {
    Regex::new(pattern).expect("built-in regex compiles")
}

fn string_args() -> Schema {
    Schema::Tuple(vec![Schema::String])
}

fn len_args() -> Schema {
    Schema::Tuple(vec![Schema::nonnegative_number()])
}

fn number_args() -> Schema {
    Schema::Tuple(vec![Schema::number()])
}

fn array_args() -> Schema {
    Schema::Tuple(vec![Schema::array(Schema::Any)])
}

fn object_schema() -> Schema {
    Schema::custom("object", |v| matches!(v, Value::Object(_) | Value::Opaque(_)))
}

fn text(v: &Value) -> &str {
    v.as_str().unwrap_or_default()
}

fn len(v: &Value) -> f64 {
    utf16_len(text(v)) as f64
}

/// A condition testing its string input against a fixed regex.
fn pattern_condition(name: &str, regex: &'static LazyLock<Regex>) -> FunctionEntry {
    FunctionEntry::condition(name, move |v, _| Ok(regex.is_match(text(v)).unwrap_or(false))).with_input(Schema::String)
}

macro_rules! regex {
    ($name:ident, $pattern:expr) => {
        static $name: LazyLock<Regex> = LazyLock::new(|| re($pattern));
    };
}

regex!(LETTERS_ONLY, r"^[A-Za-z]+$");
regex!(DIGITS_ONLY, r"^[0-9]+$");
regex!(LETTERS_PUNCT, r#"^[A-Za-z.,'"()\-!? ]+$"#);
regex!(LETTERS_SPACE_DASH_APOS, r"^[A-Za-z\s\-']+$");
regex!(LETTERS_DIGITS, r"^[A-Za-z0-9]+$");
regex!(ALNUM_PUNCT, r#"^[A-Za-z0-9.,'"()\-!? ]+$"#);
regex!(ALNUM_SAFE, r#"^[A-Za-z0-9 .,;:'"()\-!?@#$%^&*]+$"#);
regex!(
    EMAIL,
    r"(?i)^(?!.*\.\.)[a-z0-9_%+-](?:[a-z0-9._%+-]*[a-z0-9_%+-])?@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$"
);
regex!(PHONE, r"^\+?[0-9\s().-]{7,20}$");
regex!(UK_MOBILE, r"^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$");
regex!(POSTCODE, r"(?i)^([A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}| ?0A{2})$");
regex!(ISO_DATE, r"^(\d{4})-(\d{2})-(\d{2})$");

/// `parseISODate` of `dateConditions.ts`.
fn parse_iso_date(v: &Value) -> Option<(i64, i64, i64)> {
    let caps = ISO_DATE.captures(v.as_str()?).ok()??;
    let n = |i: usize| caps.get(i).and_then(|m| m.as_str().parse::<i64>().ok()).unwrap_or(0);
    let (y, m, d) = (n(1), n(2), n(3));
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    Some((y, m, d))
}

fn local_date(y: i64, m: i64, d: i64) -> JsDate {
    JsDate::local(y as f64, (m - 1) as f64, d as f64, 0.0, 0.0, 0.0, 0.0)
}

fn utc_today() -> JsDate {
    let f = JsDate::now().utc_fields().expect("now is valid");
    JsDate::utc(f.year as f64, f64::from(f.month), f64::from(f.day), 0.0, 0.0, 0.0, 0.0)
}

fn utc_date(y: i64, m: i64, d: i64) -> JsDate {
    JsDate::utc(y as f64, (m - 1) as f64, d as f64, 0.0, 0.0, 0.0, 0.0)
}

/// `getByPath` of `objectConditions.ts`.
fn get_by_path(obj: &Value, path: &str) -> Value {
    if obj.is_nullish() {
        return Value::Undefined;
    }
    if path.is_empty() {
        return obj.clone();
    }
    let mut current = obj.clone();
    for key in path.split('.') {
        if !current.is_object_like() {
            return Value::Undefined;
        }
        current = current.get(key);
    }
    current
}

fn is_empty(v: &Value) -> bool {
    v.is_nullish() || v.as_str().is_some_and(|s| js_trim(s).is_empty())
}

/// JS `Array.prototype.includes` (SameValueZero).
fn includes(items: &[Value], needle: &Value) -> bool {
    items.iter().any(|i| i.strict_eq(needle) || (i.as_f64().is_some_and(f64::is_nan) && needle.as_f64().is_some_and(f64::is_nan)))
}

fn date_compare(name: &'static str, cmp: fn(f64, f64) -> bool) -> FunctionEntry {
    FunctionEntry::condition(name, move |v, a| {
        let short = name.trim_start_matches("Date.");
        let value = parse_iso_date(v).ok_or_else(|| ForgeError::evaluation(format!("Condition.Date.{short}: Invalid date string \"{}\"", text(v))))?;
        let other = arg(a, 0);
        let compare = parse_iso_date(&other)
            .ok_or_else(|| ForgeError::evaluation(format!("Condition.Date.{short}: Invalid comparison date string \"{}\"", other.to_js_string())))?;
        Ok(cmp(local_date(value.0, value.1, value.2).ms, local_date(compare.0, compare.1, compare.2).ms))
    })
    .with_input(Schema::String)
    .with_arguments(string_args())
}

fn date_vs_today(name: &'static str, cmp: fn(f64, f64) -> bool) -> FunctionEntry {
    FunctionEntry::condition(name, move |v, _| {
        let short = name.trim_start_matches("Date.");
        let (y, m, d) = parse_iso_date(v).ok_or_else(|| ForgeError::evaluation(format!("Condition.Date.{short}: Invalid date string \"{}\"", text(v))))?;
        Ok(cmp(utc_date(y, m, d).ms, utc_today().ms))
    })
    .with_input(Schema::String)
}

pub fn all() -> Vec<FunctionEntry> {
    vec![
        // General
        FunctionEntry::condition("IsRequired", |v, _| {
            Ok(!(v.is_nullish()
                || v.as_str().is_some_and(|s| js_trim(s).is_empty())
                || v.as_array().is_some_and(|a| a.is_empty())))
        }),
        FunctionEntry::condition("Equals", |v, a| Ok(v.strict_eq(&arg(a, 0)))),
        // String
        FunctionEntry::condition("String.MatchesRegex", |v, a| {
            let pattern = arg(a, 0).to_js_string();
            let regex = js_regex(&pattern, "")
                .map_err(|_| ForgeError::evaluation(format!("Condition.String.MatchesRegex: Invalid regex pattern \"{pattern}\"")))?;
            Ok(regex.is_match(text(v)).unwrap_or(false))
        })
        .with_input(Schema::String)
        .with_arguments(string_args()),
        FunctionEntry::condition("String.HasMinLength", |v, a| Ok(len(v) >= arg(a, 0).to_js_number()))
            .with_input(Schema::String)
            .with_arguments(len_args()),
        FunctionEntry::condition("String.HasMaxLength", |v, a| Ok(len(v) <= arg(a, 0).to_js_number()))
            .with_input(Schema::String)
            .with_arguments(len_args()),
        FunctionEntry::condition("String.HasExactLength", |v, a| Ok(len(v) == arg(a, 0).to_js_number()))
            .with_input(Schema::String)
            .with_arguments(len_args()),
        FunctionEntry::condition("String.HasMaxWords", |v, a| {
            let max = arg(a, 0).to_js_number();
            let trimmed = js_trim(text(v));
            if trimmed.is_empty() {
                return Ok(max >= 0.0);
            }
            Ok(trimmed.split(super::is_js_whitespace).filter(|w| !w.is_empty()).count() as f64 <= max)
        })
        .with_input(Schema::String)
        .with_arguments(len_args()),
        pattern_condition("String.LettersOnly", &LETTERS_ONLY),
        pattern_condition("String.DigitsOnly", &DIGITS_ONLY),
        pattern_condition("String.LettersWithCommonPunctuation", &LETTERS_PUNCT),
        pattern_condition("String.LettersWithSpaceDashApostrophe", &LETTERS_SPACE_DASH_APOS),
        pattern_condition("String.LettersAndDigitsOnly", &LETTERS_DIGITS),
        pattern_condition("String.AlphanumericWithCommonPunctuation", &ALNUM_PUNCT),
        pattern_condition("String.AlphanumericWithAllSafeSymbols", &ALNUM_SAFE),
        FunctionEntry::condition("String.StartsWith", |v, a| Ok(text(v).starts_with(&arg(a, 0).to_js_string())))
            .with_input(Schema::String)
            .with_arguments(string_args()),
        FunctionEntry::condition("String.EndsWith", |v, a| Ok(text(v).ends_with(&arg(a, 0).to_js_string())))
            .with_input(Schema::String)
            .with_arguments(string_args()),
        FunctionEntry::condition("String.Contains", |v, a| Ok(text(v).contains(&arg(a, 0).to_js_string())))
            .with_input(Schema::String)
            .with_arguments(string_args()),
        // Number
        FunctionEntry::condition("Number.IsNumber", |v, _| Ok(matches!(v, Value::Number(n) if !n.is_nan()))),
        FunctionEntry::condition("Number.IsInteger", |v, _| {
            Ok(matches!(v, Value::Number(n) if n.is_finite() && n.fract() == 0.0))
        }),
        FunctionEntry::condition("Number.GreaterThan", |v, a| Ok(v.to_js_number() > arg(a, 0).to_js_number()))
            .with_input(Schema::number())
            .with_arguments(number_args()),
        FunctionEntry::condition("Number.GreaterThanOrEqual", |v, a| Ok(v.to_js_number() >= arg(a, 0).to_js_number()))
            .with_input(Schema::number())
            .with_arguments(number_args()),
        FunctionEntry::condition("Number.LessThan", |v, a| Ok(v.to_js_number() < arg(a, 0).to_js_number()))
            .with_input(Schema::number())
            .with_arguments(number_args()),
        FunctionEntry::condition("Number.LessThanOrEqual", |v, a| Ok(v.to_js_number() <= arg(a, 0).to_js_number()))
            .with_input(Schema::number())
            .with_arguments(number_args()),
        FunctionEntry::condition("Number.Between", |v, a| {
            let n = v.to_js_number();
            Ok(n >= arg(a, 0).to_js_number() && n <= arg(a, 1).to_js_number())
        })
        .with_input(Schema::number())
        .with_arguments(Schema::Tuple(vec![Schema::number(), Schema::number()])),
        // Array
        FunctionEntry::condition("Array.IsArray", |v, _| Ok(matches!(v, Value::Array(_)))),
        FunctionEntry::condition("Array.IsIn", |v, a| Ok(arg(a, 0).as_array().is_some_and(|e| e.iter().any(|i| i.strict_eq(v)))))
            .with_arguments(array_args()),
        FunctionEntry::condition("Array.Contains", |v, a| Ok(v.as_array().is_some_and(|items| includes(items, &arg(a, 0)))))
            .with_input(Schema::array(Schema::Any)),
        FunctionEntry::condition("Array.ContainsAny", |v, a| {
            let (value, expected) = (v.as_array().cloned().unwrap_or_default(), arg(a, 0).as_array().cloned().unwrap_or_default());
            if value.is_empty() && expected.is_empty() {
                return Ok(true);
            }
            Ok(expected.iter().any(|e| includes(&value, e)))
        })
        .with_input(Schema::array(Schema::Any))
        .with_arguments(array_args()),
        FunctionEntry::condition("Array.ContainsAll", |v, a| {
            let (value, expected) = (v.as_array().cloned().unwrap_or_default(), arg(a, 0).as_array().cloned().unwrap_or_default());
            if value.is_empty() && expected.is_empty() {
                return Ok(true);
            }
            Ok(value.iter().all(|i| includes(&expected, i)))
        })
        .with_input(Schema::array(Schema::Any))
        .with_arguments(array_args()),
        // Object
        FunctionEntry::condition("Object.IsObject", |v, _| Ok(matches!(v, Value::Object(_) | Value::Opaque(_)))),
        FunctionEntry::condition("Object.HasProperty", |v, a| Ok(!get_by_path(v, &arg(a, 0).to_js_string()).is_undefined()))
            .with_input(object_schema())
            .with_arguments(string_args()),
        FunctionEntry::condition("Object.PropertyIsEmpty", |v, a| Ok(is_empty(&get_by_path(v, &arg(a, 0).to_js_string()))))
            .with_input(object_schema())
            .with_arguments(string_args()),
        FunctionEntry::condition("Object.PropertyHasValue", |v, a| Ok(!is_empty(&get_by_path(v, &arg(a, 0).to_js_string()))))
            .with_input(object_schema())
            .with_arguments(string_args()),
        // Email, phone, address
        FunctionEntry::condition("Email.IsValidEmail", |v, _| Ok(utf16_len(text(v)) <= 254 && EMAIL.is_match(text(v)).unwrap_or(false)))
            .with_input(Schema::String),
        pattern_condition("Phone.IsValidPhoneNumber", &PHONE),
        pattern_condition("Phone.IsValidUKMobile", &UK_MOBILE),
        pattern_condition("Address.IsValidPostcode", &POSTCODE),
        // Date
        FunctionEntry::condition("Date.IsValid", |v, _| {
            let Some((y, m, d)) = parse_iso_date(v) else { return Ok(false) };
            let f = local_date(y, m, d).local_fields();
            Ok(f.is_some_and(|f| f.year == y && i64::from(f.month) == m - 1 && i64::from(f.day) == d))
        })
        .with_input(Schema::String),
        FunctionEntry::condition("Date.IsValidYear", |v, _| Ok(parse_iso_date(v).is_some_and(|(y, _, _)| (1000..=9999).contains(&y))))
            .with_input(Schema::String),
        FunctionEntry::condition("Date.IsValidMonth", |v, _| Ok(parse_iso_date(v).is_some_and(|(_, m, _)| (1..=12).contains(&m))))
            .with_input(Schema::String),
        FunctionEntry::condition("Date.IsValidDay", |v, _| {
            let Some(caps) = ISO_DATE.captures(text(v)).ok().flatten() else { return Ok(false) };
            let n = |i: usize| caps.get(i).and_then(|m| m.as_str().parse::<i64>().ok()).unwrap_or(0);
            let (y, m, d) = (n(1), n(2), n(3));
            if !(1..=12).contains(&m) {
                return Ok(false);
            }
            let days_in_month = local_date(y, m + 1, 0).local_fields().map_or(0, |f| i64::from(f.day));
            Ok(d >= 1 && d <= days_in_month)
        })
        .with_input(Schema::String),
        date_compare("Date.IsBefore", |a, b| a < b),
        date_compare("Date.IsAfter", |a, b| a > b),
        date_vs_today("Date.IsFutureDate", |a, b| a > b),
        date_vs_today("Date.IsPastDate", |a, b| a < b),
        date_vs_today("Date.IsToday", |a, b| a == b),
    ]
}
