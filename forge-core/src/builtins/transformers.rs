//! Built-in transformers (port of `built-ins/functions/transformers`).

use std::sync::LazyLock;

use regex::Regex;

use super::{arg, js_trim};
use crate::engine::errors::ForgeError;
use crate::engine::registries::FunctionEntry;
use crate::jsdate::{as_date, intl_format_date, to_locale_string, DateFormatOptions, JsDate};
use crate::schema::Schema;
use crate::value::{number_to_js_string, Value};

fn type_error(message: String) -> ForgeError {
    ForgeError::Type { message, function_type: Some("FunctionType.Transformer".into()) }
}

fn text(v: &Value) -> String {
    v.as_str().unwrap_or_default().to_string()
}

fn num(v: &Value) -> f64 {
    v.to_js_number()
}

fn number_args() -> Schema {
    Schema::Tuple(vec![Schema::number()])
}

fn date_schema() -> Schema {
    Schema::custom("date", |v| as_date(v).is_some_and(|d| d.is_valid()))
}

fn utf16(s: &str) -> Vec<u16> {
    s.encode_utf16().collect()
}

fn from_utf16(units: &[u16]) -> String {
    String::from_utf16_lossy(units)
}

/// `getByPath` of `objectTransformers.ts`.
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

fn pad(s: &str, target: f64, fill: &str, at_start: bool) -> String {
    let units = utf16(s);
    let target = if target.is_nan() { 0 } else { target.max(0.0) as usize };
    let fill = utf16(fill);
    if units.len() >= target || fill.is_empty() {
        return s.to_string();
    }
    let needed = target - units.len();
    let padding: Vec<u16> = fill.iter().copied().cycle().take(needed).collect();
    if at_start { format!("{}{s}", from_utf16(&padding)) } else { format!("{s}{}", from_utf16(&padding)) }
}

/// JS relative index resolution for `slice`/`substring`-style arguments.
fn relative(index: f64, len: usize) -> usize {
    if index.is_nan() {
        return 0;
    }
    if index < 0.0 { (len as f64 + index.trunc()).max(0.0) as usize } else { (index.trunc() as usize).min(len) }
}

static DIGITS_1_4: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d{1,4}$").unwrap());
static DIGITS_1_2: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d{1,2}$").unwrap());
static WORD: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[A-Za-z0-9_]\S*").unwrap());
static UK_DATE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$").unwrap());
static ISO_DATE_PREFIX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})-(\d{2})-(\d{2})(?:$|T)").unwrap());
static DIGITS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d+$").unwrap());
static FROM_ISO_FULL: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})-(\d{2})-(\d{2})$").unwrap());
static FROM_ISO_YM: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})-(\d{2})$").unwrap());
static FROM_ISO_MD: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(?:--)?(\d{2})-(\d{2})$").unwrap());
static FROM_ISO_Y: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})$").unwrap());
static DATE_TOKENS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"YYYY|MMMM|YY|MM|DD|Do|HH|mm|ss|M|D|H|m|s").unwrap());

fn pad_start(s: &str, width: usize) -> String {
    pad(s, width as f64, "0", true)
}

/// `parseDateString` of `stringTransformers.ts`.
fn parse_date_string(value: &str, function_name: &str) -> Result<JsDate, ForgeError> {
    let trimmed = js_trim(value);
    let invalid = || type_error(format!("{function_name}: \"{value}\" is not a valid date"));
    if trimmed.is_empty() {
        return Err(invalid());
    }
    if let Some(c) = UK_DATE.captures(trimmed) {
        let n = |i: usize| c[i].parse::<f64>().unwrap_or(f64::NAN);
        let (day, month, year) = (n(1), n(2), n(3));
        let date = JsDate::local(year, month - 1.0, day, 0.0, 0.0, 0.0, 0.0);
        let f = date.local_fields().ok_or_else(invalid)?;
        if f.year as f64 != year || f64::from(f.month) != month - 1.0 || f64::from(f.day) != day {
            return Err(invalid());
        }
        return Ok(date);
    }
    if let Some(c) = ISO_DATE_PREFIX.captures(trimmed) {
        let n = |i: usize| c[i].parse::<f64>().unwrap_or(f64::NAN);
        let (year, month, day) = (n(1), n(2), n(3));
        let date_only = JsDate::utc(year, month - 1.0, day, 0.0, 0.0, 0.0, 0.0);
        let f = date_only.utc_fields().ok_or_else(invalid)?;
        if f.year as f64 != year || f64::from(f.month) != month - 1.0 || f64::from(f.day) != day {
            return Err(invalid());
        }
        if !trimmed.contains('T') {
            return Ok(date_only);
        }
        let date_time = JsDate::parse(trimmed);
        if !date_time.is_valid() {
            return Err(type_error(format!("{function_name}: \"{value}\" is not a valid ISO date")));
        }
        return Ok(date_time);
    }
    Err(type_error(format!("{function_name}: \"{value}\" is not a valid date (expected DD/MM/YYYY or YYYY-MM-DD)")))
}

/// `formatDate` of `dateTransformers.ts` (local time).
fn format_date(date: &JsDate, format: &str) -> String {
    let Some(f) = date.local_fields() else { return String::new() };
    let ordinal = |n: u32| {
        let (r10, r100) = (n % 10, n % 100);
        let suffix = if (11..=13).contains(&r100) {
            "th"
        } else {
            match r10 {
                1 => "st",
                2 => "nd",
                3 => "rd",
                _ => "th",
            }
        };
        format!("{n}{suffix}")
    };
    const MONTHS: [&str; 12] =
        ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    DATE_TOKENS
        .replace_all(format, |c: &regex::Captures| match &c[0] {
            "YYYY" => f.year.to_string(),
            "YY" => {
                let y = f.year.to_string();
                y[y.len().saturating_sub(2)..].to_string()
            }
            "MMMM" => MONTHS[f.month as usize].to_string(),
            "MM" => format!("{:02}", f.month + 1),
            "M" => (f.month + 1).to_string(),
            "DD" => format!("{:02}", f.day),
            "Do" => ordinal(f.day),
            "D" => f.day.to_string(),
            "HH" => format!("{:02}", f.hours),
            "H" => f.hours.to_string(),
            "mm" => format!("{:02}", f.minutes),
            "m" => f.minutes.to_string(),
            "ss" => format!("{:02}", f.seconds),
            "s" => f.seconds.to_string(),
            other => other.to_string(),
        })
        .into_owned()
}

fn to_iso(value: &Value, paths: &Value) -> Result<Value, ForgeError> {
    let path = |k: &str| paths.get(k).as_str().filter(|p| !p.is_empty()).map(str::to_string);
    let part = |k: &str| -> Option<String> {
        path(k).and_then(|p| match get_by_path(value, &p) {
            Value::Undefined => None,
            v => Some(v.to_js_string()),
        })
    };
    let (year, month, day) = (part("year"), part("month"), part("day"));
    let truthy = |o: &Option<String>| o.as_deref().is_some_and(|s| !s.is_empty());
    if path("year").is_some() && path("month").is_some() && path("day").is_some() && !(truthy(&year) && truthy(&month) && truthy(&day)) {
        return Err(type_error("Transformer.Object.ToISO: Full date requested but not all fields provided".into()));
    }
    let (year, month, day) = (year.filter(|s| !s.is_empty()), month.filter(|s| !s.is_empty()), day.filter(|s| !s.is_empty()));
    if let Some(y) = &year
        && !DIGITS_1_4.is_match(y)
    {
        return Err(type_error(format!("Transformer.Object.ToISO: Invalid year value \"{y}\"")));
    }
    if let Some(m) = &month
        && !DIGITS_1_2.is_match(m)
    {
        return Err(type_error(format!("Transformer.Object.ToISO: Invalid month value \"{m}\"")));
    }
    if let Some(d) = &day
        && !DIGITS_1_2.is_match(d)
    {
        return Err(type_error(format!("Transformer.Object.ToISO: Invalid day value \"{d}\"")));
    }
    if let Some(m) = &month
        && !(1..=12).contains(&m.parse::<u32>().unwrap_or(0))
    {
        return Err(type_error(format!("Transformer.Object.ToISO: Month must be between 1 and 12, got \"{m}\"")));
    }
    if let Some(d) = &day
        && !(1..=31).contains(&d.parse::<u32>().unwrap_or(0))
    {
        return Err(type_error(format!("Transformer.Object.ToISO: Day must be between 1 and 31, got \"{d}\"")));
    }
    Ok(Value::from(match (&year, &month, &day) {
        (Some(y), Some(m), Some(d)) => format!("{}-{}-{}", pad_start(y, 4), pad_start(m, 2), pad_start(d, 2)),
        (Some(y), Some(m), None) => format!("{}-{}", pad_start(y, 4), pad_start(m, 2)),
        (_, Some(m), Some(d)) => format!("--{}-{}", pad_start(m, 2), pad_start(d, 2)),
        (Some(y), _, _) => pad_start(y, 4),
        _ => return Err(type_error("Transformer.Object.ToISO: No valid date components found in object".into())),
    }))
}

fn from_iso(value: &Value, paths: &Value) -> Value {
    if value.is_object_like() {
        return value.clone();
    }
    let Some(s) = value.as_str().filter(|s| !s.is_empty()) else { return Value::empty_object() };
    let p = |k: &str| paths.get(k).as_str().filter(|p| !p.is_empty()).map(str::to_string);
    let (y, m, d) = (p("year"), p("month"), p("day"));
    let build = |pairs: Vec<(String, String)>| Value::from_pairs(pairs.into_iter().map(|(k, v)| (k, Value::from(v))));
    match (&y, &m, &d) {
        (Some(y), Some(m), Some(d)) => {
            if let Some(c) = FROM_ISO_FULL.captures(s) {
                return build(vec![(y.clone(), c[1].into()), (m.clone(), c[2].into()), (d.clone(), c[3].into())]);
            }
        }
        (Some(y), Some(m), None) => {
            if let Some(c) = FROM_ISO_YM.captures(s) {
                return build(vec![(y.clone(), c[1].into()), (m.clone(), c[2].into())]);
            }
        }
        (None, Some(m), Some(d)) => {
            if let Some(c) = FROM_ISO_MD.captures(s) {
                return build(vec![(m.clone(), c[1].into()), (d.clone(), c[2].into())]);
            }
        }
        (Some(y), None, None) => {
            if let Some(c) = FROM_ISO_Y.captures(s) {
                return build(vec![(y.clone(), c[1].into())]);
            }
        }
        _ => {}
    }
    Value::empty_object()
}

fn parse_number(raw: &str, name: &str) -> Result<f64, ForgeError> {
    let trimmed = js_trim(raw);
    let parsed = Value::from(trimmed).to_js_number();
    if trimmed.is_empty() || !parsed.is_finite() {
        return Err(type_error(format!("Transformer.{name}: \"{raw}\" is not a valid number")));
    }
    Ok(parsed)
}

/// JS `Number.prototype.toFixed` then `parseFloat`.
fn to_fixed(value: f64, decimals: f64) -> f64 {
    let d = decimals.trunc().clamp(0.0, 100.0) as usize;
    format!("{value:.d$}").parse().unwrap_or(f64::NAN)
}

/// JS `Math.round`: halves round towards +Infinity.
fn js_round(n: f64) -> f64 {
    (n + 0.5).floor()
}

fn sort_values(items: &[Value]) -> Vec<Value> {
    let mut out = items.to_vec();
    out.sort_by(|a, b| match (a, b) {
        (Value::Number(x), Value::Number(y)) => x.partial_cmp(y).unwrap_or(std::cmp::Ordering::Equal),
        _ => a.to_js_string().cmp(&b.to_js_string()),
    });
    out
}

fn escape_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '&' => out.push_str("&amp;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            c => out.push(c),
        }
    }
    out
}

pub fn all() -> Vec<FunctionEntry> {
    let string = |name: &str, f: fn(&str) -> String| FunctionEntry::transformer(name, move |v, _| Ok(Value::from(f(&text(v))))).with_input(Schema::String);
    let number = |name: &str, f: fn(f64, f64) -> Result<f64, ForgeError>| {
        FunctionEntry::transformer(name, move |v, a| Ok(Value::Number(f(num(v), num(&arg(a, 0)))?)))
            .with_input(Schema::number())
            .with_arguments(number_args())
    };
    let unary = |name: &str, f: fn(f64) -> Result<f64, ForgeError>| {
        FunctionEntry::transformer(name, move |v, _| Ok(Value::Number(f(num(v))?))).with_input(Schema::number())
    };
    let date = |name: &str, f: fn(JsDate, &[Value]) -> Result<Value, ForgeError>| {
        FunctionEntry::transformer(name, move |v, a| f(as_date(v).unwrap_or_else(JsDate::invalid), a)).with_input(date_schema())
    };
    vec![
        // String
        string("String.Trim", |s| js_trim(s).to_string()),
        string("String.ToUpperCase", str::to_uppercase),
        string("String.ToLowerCase", str::to_lowercase),
        string("String.ToTitleCase", |s| {
            WORD.replace_all(s, |c: &regex::Captures| {
                let mut chars = c[0].chars();
                let first = chars.next().map(|f| f.to_uppercase().to_string()).unwrap_or_default();
                format!("{first}{}", chars.as_str().to_lowercase())
            })
            .into_owned()
        }),
        string("String.Capitalize", |s| {
            let mut chars = s.chars();
            match chars.next() {
                Some(first) => format!("{}{}", first.to_uppercase(), chars.as_str()),
                None => String::new(),
            }
        }),
        string("String.Possessive", |s| {
            if s.is_empty() {
                String::new()
            } else if s.to_lowercase().ends_with('s') {
                format!("{s}'")
            } else {
                format!("{s}'s")
            }
        }),
        FunctionEntry::transformer("String.Substring", |v, a| {
            let units = utf16(&text(v));
            let start = relative(num(&arg(a, 0)).max(0.0), units.len());
            let end = match arg(a, 1) {
                Value::Undefined => units.len(),
                e => relative(num(&e).max(0.0), units.len()),
            };
            let (lo, hi) = if start <= end { (start, end) } else { (end, start) };
            Ok(Value::from(from_utf16(&units[lo..hi])))
        })
        .with_input(Schema::String)
        .with_arguments(Schema::Tuple(vec![Schema::number(), Schema::optional(Schema::number())])),
        FunctionEntry::transformer("String.Replace", |v, a| {
            let (search, replace) = (arg(a, 0).to_js_string(), arg(a, 1).to_js_string());
            let s = text(v);
            if search.is_empty() {
                // `replaceAll("", r)` inserts r between every UTF-16 unit.
                let units = utf16(&s);
                let mut out = replace.clone();
                for u in units.iter() {
                    out.push_str(&from_utf16(&[*u]));
                    out.push_str(&replace);
                }
                return Ok(Value::from(out));
            }
            Ok(Value::from(s.replace(&search, &replace)))
        })
        .with_input(Schema::String)
        .with_arguments(Schema::Tuple(vec![Schema::String, Schema::String])),
        FunctionEntry::transformer("String.PadStart", |v, a| {
            let fill = match arg(a, 1) {
                Value::Undefined => " ".to_string(),
                f => f.to_js_string(),
            };
            Ok(Value::from(pad(&text(v), num(&arg(a, 0)), &fill, true)))
        })
        .with_input(Schema::String)
        .with_arguments(Schema::Tuple(vec![Schema::number(), Schema::optional(Schema::String)])),
        FunctionEntry::transformer("String.PadEnd", |v, a| {
            let fill = match arg(a, 1) {
                Value::Undefined => " ".to_string(),
                f => f.to_js_string(),
            };
            Ok(Value::from(pad(&text(v), num(&arg(a, 0)), &fill, false)))
        })
        .with_input(Schema::String)
        .with_arguments(Schema::Tuple(vec![Schema::number(), Schema::optional(Schema::String)])),
        FunctionEntry::transformer("String.ToInt", |v, _| Ok(Value::Number(parse_number(&text(v), "String.ToInt")?.trunc())))
            .with_input(Schema::String),
        FunctionEntry::transformer("String.ToFloat", |v, _| Ok(Value::Number(parse_number(&text(v), "String.ToFloat")?)))
            .with_input(Schema::String),
        FunctionEntry::transformer("String.ToArray", |v, a| {
            let s = text(v);
            let parts: Vec<Value> = match arg(a, 0) {
                Value::Undefined => s.encode_utf16().map(|u| Value::from(from_utf16(&[u]))).collect(),
                sep => {
                    let sep = sep.to_js_string();
                    if sep.is_empty() {
                        s.encode_utf16().map(|u| Value::from(from_utf16(&[u]))).collect()
                    } else {
                        s.split(sep.as_str()).map(Value::from).collect()
                    }
                }
            };
            Ok(Value::array(parts))
        })
        .with_input(Schema::String)
        .with_arguments(Schema::Tuple(vec![Schema::optional(Schema::String)])),
        FunctionEntry::transformer("String.ToDate", |v, _| Ok(parse_date_string(&text(v), "Transformer.String.ToDate")?.value()))
            .with_input(Schema::String),
        FunctionEntry::transformer("String.FormatDate", |v, a| {
            let options = match arg(a, 0) {
                Value::Undefined => DateFormatOptions { date_style: Some("long".into()), ..Default::default() },
                o => DateFormatOptions::from_value(&o),
            };
            let options = DateFormatOptions {
                locale: Some(options.locale.clone().unwrap_or_else(|| "en-GB".into())),
                time_zone: Some(options.time_zone.clone().unwrap_or_else(|| "Europe/London".into())),
                ..options
            };
            let date = parse_date_string(&text(v), "Transformer.String.FormatDate")?;
            Ok(Value::from(intl_format_date(&date, &options).unwrap_or_default()))
        })
        .with_input(Schema::String)
        .with_arguments(Schema::Tuple(vec![Schema::optional(Schema::Record(Box::new(Schema::Any)))])),
        FunctionEntry::transformer("String.ToISODate", |v, _| {
            let value = text(v);
            let trimmed = js_trim(&value);
            if trimmed.is_empty() {
                return Err(type_error(format!("Transformer.String.ToISODate: \"{value}\" is not a valid date")));
            }
            let Some(c) = UK_DATE.captures(trimmed) else {
                return Err(type_error(format!("Transformer.String.ToISODate: \"{value}\" is not a valid UK date (expected DD/MM/YYYY)")));
            };
            let n = |i: usize| c[i].parse::<f64>().unwrap_or(f64::NAN);
            let (day, month, year) = (n(1), n(2), n(3));
            let date = JsDate::local(year, month - 1.0, day, 0.0, 0.0, 0.0, 0.0);
            let f = date.local_fields();
            if f.is_none_or(|f| f.year as f64 != year || f64::from(f.month) != month - 1.0 || f64::from(f.day) != day) {
                return Err(type_error(format!("Transformer.String.ToISODate: \"{value}\" is not a valid date")));
            }
            Ok(Value::from(format!(
                "{}-{}-{}",
                pad_start(&number_to_js_string(year), 4),
                pad_start(&number_to_js_string(month), 2),
                pad_start(&number_to_js_string(day), 2)
            )))
        })
        .with_input(Schema::String),
        FunctionEntry::transformer("String.ToTimestampDate", |v, _| {
            let value = text(v);
            if !DIGITS.is_match(&value) {
                return Err(type_error(format!("Transformer.String.ToTimestampDate: \"{value}\" is not a timestamp")));
            }
            let epoch = Value::from(value.as_str()).to_js_number();
            if !(epoch.fract() == 0.0 && epoch.abs() <= 9_007_199_254_740_991.0) {
                return Err(type_error(format!("Transformer.String.ToTimestampDate: \"{value}\" is not a valid timestamp")));
            }
            let date = JsDate::new(epoch);
            if !date.is_valid() {
                return Err(type_error(format!("Transformer.String.ToTimestampDate: \"{value}\" is not a valid epoch timestamp")));
            }
            Ok(date.value())
        })
        .with_input(Schema::String),
        string("String.EscapeHtml", escape_html),
        // Number
        number("Number.Add", |a, b| Ok(a + b)),
        number("Number.Subtract", |a, b| Ok(a - b)),
        number("Number.Multiply", |a, b| Ok(a * b)),
        number("Number.Divide", |a, b| {
            if b == 0.0 {
                return Err(ForgeError::evaluation("Division by zero is not allowed in Transformer.Number.Divide"));
            }
            Ok(a / b)
        }),
        unary("Number.Abs", |a| Ok(a.abs())),
        unary("Number.Round", |a| Ok(js_round(a))),
        unary("Number.Floor", |a| Ok(a.floor())),
        unary("Number.Ceil", |a| Ok(a.ceil())),
        number("Number.ToFixed", |a, b| Ok(to_fixed(a, b))),
        number("Number.Max", |a, b| Ok(if a.is_nan() || b.is_nan() { f64::NAN } else { a.max(b) })),
        number("Number.Min", |a, b| Ok(if a.is_nan() || b.is_nan() { f64::NAN } else { a.min(b) })),
        number("Number.Power", |a, b| Ok(a.powf(b))),
        unary("Number.Sqrt", |a| {
            if a < 0.0 {
                return Err(ForgeError::evaluation("Cannot calculate square root of negative number in Transformer.Number.Sqrt"));
            }
            Ok(a.sqrt())
        }),
        FunctionEntry::transformer("Number.Clamp", |v, a| Ok(Value::Number(num(v).max(num(&arg(a, 0))).min(num(&arg(a, 1))))))
            .with_input(Schema::number())
            .with_arguments(Schema::Tuple(vec![Schema::number(), Schema::number()])),
        // Array
        FunctionEntry::transformer("Array.Length", |v, _| Ok(Value::from(v.as_array().map_or(0, |a| a.len()))))
            .with_input(Schema::array(Schema::Any)),
        FunctionEntry::transformer("Array.First", |v, _| Ok(v.as_array().and_then(|a| a.first().cloned()).unwrap_or_default()))
            .with_input(Schema::array(Schema::Any)),
        FunctionEntry::transformer("Array.Last", |v, _| Ok(v.as_array().and_then(|a| a.last().cloned()).unwrap_or_default()))
            .with_input(Schema::array(Schema::Any)),
        FunctionEntry::transformer("Array.Reverse", |v, _| {
            Ok(Value::array(v.as_array().map(|a| a.iter().rev().cloned().collect()).unwrap_or_default()))
        })
        .with_input(Schema::array(Schema::Any)),
        FunctionEntry::transformer("Array.Join", |v, a| {
            let sep = match arg(a, 0) {
                Value::Undefined => ",".to_string(),
                s => s.to_js_string(),
            };
            let items = v.as_array().cloned().unwrap_or_default();
            Ok(Value::from(
                items.iter().map(|i| if i.is_nullish() { String::new() } else { i.to_js_string() }).collect::<Vec<_>>().join(&sep),
            ))
        })
        .with_input(Schema::array(Schema::Any))
        .with_arguments(Schema::Tuple(vec![Schema::optional(Schema::String)])),
        FunctionEntry::transformer("Array.Slice", |v, a| {
            let items = v.as_array().cloned().unwrap_or_default();
            let start = relative(num(&arg(a, 0)), items.len());
            let end = match arg(a, 1) {
                Value::Undefined => items.len(),
                e => relative(num(&e), items.len()),
            };
            Ok(Value::array(if start < end { items[start..end].to_vec() } else { Vec::new() }))
        })
        .with_input(Schema::array(Schema::Any))
        .with_arguments(Schema::Tuple(vec![Schema::number(), Schema::optional(Schema::number())])),
        FunctionEntry::transformer("Array.Concat", |v, a| {
            let mut out = v.as_array().map(|x| (**x).clone()).unwrap_or_default();
            for extra in a {
                match extra {
                    Value::Array(items) => out.extend(items.iter().cloned()),
                    other => out.push(other.clone()),
                }
            }
            Ok(Value::array(out))
        })
        .with_input(Schema::array(Schema::Any))
        .with_arguments(Schema::TupleRest(vec![Schema::array(Schema::Any)], Box::new(Schema::array(Schema::Any)))),
        FunctionEntry::transformer("Array.Unique", |v, _| {
            let mut out: Vec<Value> = Vec::new();
            for item in v.as_array().map(|a| a.iter().cloned().collect::<Vec<_>>()).unwrap_or_default() {
                let seen = out.iter().any(|o| o.strict_eq(&item) || (o.as_f64().is_some_and(f64::is_nan) && item.as_f64().is_some_and(f64::is_nan)));
                if !seen {
                    out.push(item);
                }
            }
            Ok(Value::array(out))
        })
        .with_input(Schema::array(Schema::Any)),
        FunctionEntry::transformer("Array.Sort", |v, _| Ok(Value::array(sort_values(v.as_array().map(|a| a.as_slice()).unwrap_or_default()))))
            .with_input(Schema::array(Schema::Any)),
        FunctionEntry::transformer("Array.Filter", |v, a| {
            let target = arg(a, 0);
            Ok(Value::array(v.as_array().map(|items| items.iter().filter(|i| i.strict_eq(&target)).cloned().collect()).unwrap_or_default()))
        })
        .with_input(Schema::array(Schema::Any))
        .with_arguments(Schema::Tuple(vec![Schema::Any])),
        FunctionEntry::transformer("Array.Map", |v, a| {
            let property = arg(a, 0);
            Ok(Value::array(
                v.as_array()
                    .map(|items| {
                        items
                            .iter()
                            .map(|item| match (&property, item) {
                                (Value::Number(n), Value::Array(_)) => item.get(&number_to_js_string(*n)),
                                (Value::String(s), i) if i.is_object_like() => i.get(s),
                                _ => Value::Undefined,
                            })
                            .collect()
                    })
                    .unwrap_or_default(),
            ))
        })
        .with_input(Schema::array(Schema::Any))
        .with_arguments(Schema::Tuple(vec![Schema::Union(vec![Schema::String, Schema::number()])])),
        FunctionEntry::transformer("Array.Flatten", |v, _| {
            let mut out = Vec::new();
            for item in v.as_array().map(|a| a.iter().cloned().collect::<Vec<_>>()).unwrap_or_default() {
                match item {
                    Value::Array(inner) => out.extend(inner.iter().cloned()),
                    other => out.push(other),
                }
            }
            Ok(Value::array(out))
        })
        .with_input(Schema::array(Schema::Any)),
        // Object
        FunctionEntry::transformer("Object.ToISO", |v, a| to_iso(v, &arg(a, 0)))
            .with_input(Schema::custom("object", |v| v.is_object_like()))
            .with_arguments(date_parts_args()),
        FunctionEntry::transformer("Object.FromISO", |v, a| Ok(from_iso(v, &arg(a, 0)))).with_arguments(date_parts_args()),
        // Date
        date("Date.Format", |d, a| Ok(Value::from(format_date(&d, &arg(a, 0).to_js_string())))),
        date("Date.AddDays", |d, a| Ok(d.with_local(|p| p[2] += num(&arg(a, 0))).value())),
        date("Date.SubtractDays", |d, a| Ok(d.with_local(|p| p[2] -= num(&arg(a, 0))).value())),
        date("Date.AddMonths", |d, a| Ok(d.with_local(|p| p[1] += num(&arg(a, 0))).value())),
        date("Date.AddYears", |d, a| Ok(d.with_local(|p| p[0] += num(&arg(a, 0))).value())),
        date("Date.StartOfDay", |d, _| {
            Ok(d.with_local(|p| {
                p[3] = 0.0;
                p[4] = 0.0;
                p[5] = 0.0;
                p[6] = 0.0;
            })
            .value())
        }),
        date("Date.EndOfDay", |d, _| {
            Ok(d.with_local(|p| {
                p[3] = 23.0;
                p[4] = 59.0;
                p[5] = 59.0;
                p[6] = 999.0;
            })
            .value())
        }),
        date("Date.ToISOString", |d, _| Ok(Value::from(d.to_iso_string().unwrap_or_default()))),
        date("Date.ToLocaleString", |d, a| Ok(Value::from(to_locale_string(&d, arg(a, 0).as_str()).unwrap_or_default()))),
        date("Date.ToUKLongDate", |d, _| {
            let opts = DateFormatOptions {
                locale: Some("en-GB".into()),
                day: Some("numeric".into()),
                month: Some("long".into()),
                year: Some("numeric".into()),
                ..Default::default()
            };
            Ok(Value::from(intl_format_date(&d, &opts).unwrap_or_default()))
        }),
    ]
    .into_iter()
    .map(|e| {
        // `Date.*` argument schemas.
        match e.name.as_ref() {
            "Date.Format" => e.with_arguments(Schema::Tuple(vec![Schema::String])),
            "Date.AddDays" | "Date.SubtractDays" | "Date.AddMonths" | "Date.AddYears" => e.with_arguments(number_args()),
            "Date.ToLocaleString" => e.with_arguments(Schema::Tuple(vec![Schema::optional(Schema::String)])),
            _ => e,
        }
    })
    .collect()
}

fn date_parts_args() -> Schema {
    Schema::Tuple(vec![Schema::object([
        ("year", Schema::optional(Schema::String)),
        ("month", Schema::optional(Schema::String)),
        ("day", Schema::optional(Schema::String)),
    ])])
}
