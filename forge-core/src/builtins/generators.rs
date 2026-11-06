//! Built-in generators (port of `built-ins/functions/generators`).

use std::sync::LazyLock;

use regex::Regex;

use crate::engine::registries::FunctionEntry;
use crate::jsdate::JsDate;
use crate::schema::Schema;
use crate::value::Value;

pub const FORMAT_STRING_GENERATOR_NAME: &str = "FormatString";

static PLACEHOLDER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"%([1-9]\d*)").unwrap());

/// `formatString`: `%1`..`%n` replaced by `String(arg ?? "")`; out-of-range placeholders stay.
pub fn format_string(template: &str, replacements: &[Value]) -> String {
    PLACEHOLDER
        .replace_all(template, |c: &regex::Captures| {
            let index = c[1].parse::<usize>().ok().and_then(|i| i.checked_sub(1));
            match index.and_then(|i| replacements.get(i)) {
                Some(v) if v.is_nullish() => String::new(),
                Some(v) => v.to_js_string(),
                None => c[0].to_string(),
            }
        })
        .into_owned()
}

pub fn all() -> Vec<FunctionEntry> {
    vec![
        FunctionEntry::generator(FORMAT_STRING_GENERATOR_NAME, |args| {
            let template = args.first().and_then(Value::as_str).unwrap_or_default().to_string();
            Ok(Value::from(format_string(&template, args.get(1..).unwrap_or_default())))
        })
        .with_arguments(Schema::TupleRest(vec![Schema::String], Box::new(Schema::Any))),
        FunctionEntry::generator("Date.Now", |_| Ok(JsDate::now().value())).with_arguments(Schema::Tuple(vec![])),
        FunctionEntry::generator("Date.Today", |_| {
            let f = JsDate::now().local_fields().expect("now is valid");
            Ok(JsDate::local(f.year as f64, f64::from(f.month), f64::from(f.day), 0.0, 0.0, 0.0, 0.0).value())
        })
        .with_arguments(Schema::Tuple(vec![])),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::val;

    #[test]
    fn formats() {
        assert_eq!(format_string("a %1 b %2 c %3", &[val!("x"), Value::Null]), "a x b  c %3");
        assert_eq!(format_string("%10", &[val!(1)]), "%10");
    }
}
