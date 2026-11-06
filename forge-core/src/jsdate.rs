//! JavaScript `Date` semantics: a millisecond time value (NaN when invalid), local-time
//! construction with JS overflow rules (`new Date(2024, 1, 31)` is 2 March), local and UTC
//! getters, `toISOString`, ISO parsing, and the slice of `Intl.DateTimeFormat` Forge uses.
//!
//! Local time is the process timezone (`TZ`), as in Node.

use chrono::{DateTime, Datelike, Local, LocalResult, NaiveDate, NaiveDateTime, TimeZone, Timelike, Utc};

use crate::value::{OpaqueValue, Value};

const MS_PER_DAY: f64 = 86_400_000.0;

/// A JS `Date` carried in a [`Value`].
#[derive(Clone, Copy, Debug)]
pub struct JsDate {
    pub ms: f64,
}

impl OpaqueValue for JsDate {
    /// `JSON.stringify(date)`: the ISO string, or `null` for an invalid date.
    fn view(&self) -> Value {
        match self.to_iso_string() {
            Some(s) => Value::from(s),
            None => Value::Null,
        }
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

/// Days since the epoch for a proleptic Gregorian date (month 1-12).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// `MakeDay`/`MakeTime`/`MakeDate` for UTC fields (month 0-based, any field may overflow).
fn make_date(year: f64, month: f64, day: f64, h: f64, mi: f64, s: f64, ms: f64) -> f64 {
    if ![year, month, day, h, mi, s, ms].iter().all(|v| v.is_finite()) {
        return f64::NAN;
    }
    let (year, month) = (year.trunc(), month.trunc());
    let ym = year + (month / 12.0).floor();
    let mn = month.rem_euclid(12.0);
    let days = days_from_civil(ym as i64, mn as i64 + 1, 1) as f64 + day.trunc() - 1.0;
    let time = h.trunc() * 3_600_000.0 + mi.trunc() * 60_000.0 + s.trunc() * 1000.0 + ms.trunc();
    days * MS_PER_DAY + time
}

fn time_clip(t: f64) -> f64 {
    if !t.is_finite() || t.abs() > 8.64e15 { f64::NAN } else { t.trunc() + 0.0 }
}

fn naive_from_ms(ms: f64) -> Option<NaiveDateTime> {
    DateTime::<Utc>::from_timestamp_millis(ms as i64).map(|d| d.naive_utc())
}

/// Interprets a wall-clock time value as local time (`UTC(t)`): gaps move forward, overlaps
/// take the earlier instant.
fn local_to_utc(local_ms: f64) -> f64 {
    let Some(naive) = naive_from_ms(local_ms) else { return f64::NAN };
    let resolved = match Local.from_local_datetime(&naive) {
        LocalResult::Single(d) => Some(d),
        LocalResult::Ambiguous(a, b) => Some(a.min(b)),
        LocalResult::None => Local.from_local_datetime(&(naive + chrono::Duration::hours(1))).earliest(),
    };
    resolved.map_or(f64::NAN, |d| d.timestamp_millis() as f64)
}

/// Local-time fields of an instant.
#[derive(Clone, Copy, Debug)]
pub struct Fields {
    pub year: i64,
    /// 0-based, as in JS.
    pub month: u32,
    pub day: u32,
    pub hours: u32,
    pub minutes: u32,
    pub seconds: u32,
    pub millis: u32,
    pub weekday: u32,
}

fn fields_of<Tz: TimeZone>(d: &DateTime<Tz>) -> Fields {
    Fields {
        year: i64::from(d.year()),
        month: d.month0(),
        day: d.day(),
        hours: d.hour(),
        minutes: d.minute(),
        seconds: d.second(),
        millis: d.timestamp_subsec_millis(),
        weekday: d.weekday().num_days_from_sunday(),
    }
}

impl JsDate {
    pub fn new(ms: f64) -> Self {
        Self { ms: time_clip(ms) }
    }

    pub fn now() -> Self {
        Self::new(Utc::now().timestamp_millis() as f64)
    }

    pub fn invalid() -> Self {
        Self { ms: f64::NAN }
    }

    pub fn is_valid(&self) -> bool {
        !self.ms.is_nan()
    }

    pub fn value(self) -> Value {
        Value::opaque(self)
    }

    /// `new Date(year, month, day, h, m, s, ms)` in local time.
    pub fn local(year: f64, month: f64, day: f64, h: f64, mi: f64, s: f64, ms: f64) -> Self {
        Self::new(local_to_utc(make_date(year, month, day, h, mi, s, ms)))
    }

    /// `Date.UTC(...)`.
    pub fn utc(year: f64, month: f64, day: f64, h: f64, mi: f64, s: f64, ms: f64) -> Self {
        Self::new(make_date(year, month, day, h, mi, s, ms))
    }

    pub fn local_fields(&self) -> Option<Fields> {
        if !self.is_valid() {
            return None;
        }
        Local.timestamp_millis_opt(self.ms as i64).single().map(|d| fields_of(&d))
    }

    pub fn utc_fields(&self) -> Option<Fields> {
        if !self.is_valid() {
            return None;
        }
        Utc.timestamp_millis_opt(self.ms as i64).single().map(|d| fields_of(&d))
    }

    pub fn fields_in(&self, tz: chrono_tz::Tz) -> Option<Fields> {
        if !self.is_valid() {
            return None;
        }
        tz.timestamp_millis_opt(self.ms as i64).single().map(|d| fields_of(&d))
    }

    /// Rebuilds the date from (possibly overflowing) local fields: the `setX` family.
    pub fn with_local(&self, f: impl FnOnce(&mut [f64; 7])) -> Self {
        let Some(l) = self.local_fields() else { return Self::invalid() };
        let mut parts = [
            l.year as f64,
            f64::from(l.month),
            f64::from(l.day),
            f64::from(l.hours),
            f64::from(l.minutes),
            f64::from(l.seconds),
            f64::from(l.millis),
        ];
        f(&mut parts);
        Self::local(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5], parts[6])
    }

    /// `toISOString()`; `None` for an invalid date (JS throws `RangeError`).
    pub fn to_iso_string(&self) -> Option<String> {
        let f = self.utc_fields()?;
        let year = if (0..=9999).contains(&f.year) {
            format!("{:04}", f.year)
        } else {
            format!("{}{:06}", if f.year < 0 { '-' } else { '+' }, f.year.abs())
        };
        Some(format!(
            "{year}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
            f.month + 1,
            f.day,
            f.hours,
            f.minutes,
            f.seconds,
            f.millis
        ))
    }

    /// `new Date(string)` for the ISO forms: date-only is UTC, date-time without an offset is
    /// local time.
    pub fn parse(s: &str) -> Self {
        let s = s.trim();
        if let Ok(d) = NaiveDate::parse_from_str(s, "%Y-%m-%d") {
            return Self::new(make_date(f64::from(d.year()), f64::from(d.month0()), f64::from(d.day()), 0.0, 0.0, 0.0, 0.0));
        }
        if let Ok(d) = DateTime::parse_from_rfc3339(s) {
            return Self::new(d.timestamp_millis() as f64);
        }
        for fmt in ["%Y-%m-%dT%H:%M:%S%.f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"] {
            if let Ok(n) = NaiveDateTime::parse_from_str(s, fmt) {
                return Self::new(local_to_utc(n.and_utc().timestamp_millis() as f64));
            }
        }
        if let Ok(d) = DateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f%z") {
            return Self::new(d.timestamp_millis() as f64);
        }
        Self::invalid()
    }
}

/// Reads a `Date` out of a value.
pub fn as_date(v: &Value) -> Option<JsDate> {
    v.downcast::<JsDate>().copied()
}

const MONTHS: [&str; 12] =
    ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS: [&str; 7] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/// The `Intl.DateTimeFormat` options Forge passes (`dateStyle` or day/month/year components).
#[derive(Clone, Debug, Default)]
pub struct DateFormatOptions {
    pub locale: Option<String>,
    pub time_zone: Option<String>,
    pub date_style: Option<String>,
    pub day: Option<String>,
    pub month: Option<String>,
    pub year: Option<String>,
}

impl DateFormatOptions {
    pub fn from_value(v: &Value) -> Self {
        let s = |k: &str| v.get(k).as_str().map(str::to_string);
        Self { locale: s("locale"), time_zone: s("timeZone"), date_style: s("dateStyle"), day: s("day"), month: s("month"), year: s("year") }
    }
}

/// `new Intl.DateTimeFormat(locale, options).format(date)` for en-GB and en-US.
pub fn intl_format_date(date: &JsDate, opts: &DateFormatOptions) -> Option<String> {
    let f = match opts.time_zone.as_deref().and_then(|z| z.parse::<chrono_tz::Tz>().ok()) {
        Some(tz) => date.fields_in(tz)?,
        None => date.local_fields()?,
    };
    let us = opts.locale.as_deref().is_some_and(|l| l.eq_ignore_ascii_case("en-US"));
    let month_name = MONTHS[f.month as usize];
    let (d, m, y) = (f.day, f.month + 1, f.year);
    if let Some(style) = opts.date_style.as_deref() {
        return Some(match (style, us) {
            ("full", false) => format!("{} {d} {month_name} {y}", WEEKDAYS[f.weekday as usize]),
            ("full", true) => format!("{}, {month_name} {d}, {y}", WEEKDAYS[f.weekday as usize]),
            ("long", false) => format!("{d} {month_name} {y}"),
            ("long", true) => format!("{month_name} {d}, {y}"),
            ("medium", false) => format!("{d} {} {y}", &month_name[..3]),
            ("medium", true) => format!("{} {d}, {y}", &month_name[..3]),
            (_, false) => format!("{d:02}/{m:02}/{y}"),
            (_, true) => format!("{m}/{d}/{}", y % 100),
        });
    }
    let two = |o: &Option<String>, n: u32| if o.as_deref() == Some("2-digit") { format!("{n:02}") } else { n.to_string() };
    let day = opts.day.as_ref().map(|_| two(&opts.day, d));
    let year = opts.year.as_ref().map(|o| if o == "2-digit" { format!("{:02}", y % 100) } else { y.to_string() });
    let month = opts.month.as_ref().map(|o| match o.as_str() {
        "long" => month_name.to_string(),
        "short" => month_name[..3].to_string(),
        _ => two(&opts.month, m),
    });
    let textual = opts.month.as_deref().is_some_and(|o| o == "long" || o == "short");
    let join = |items: Vec<Option<String>>, sep: &str| items.into_iter().flatten().collect::<Vec<_>>().join(sep);
    Some(match (textual, us) {
        (true, true) => {
            let md = join(vec![month, day], " ");
            join(vec![(!md.is_empty()).then_some(md), year], ", ")
        }
        (true, false) => join(vec![day, month, year], " "),
        (false, true) => join(vec![month, day, year], "/"),
        (false, false) => join(vec![day, month, year], "/"),
    })
}

/// `date.toLocaleString(locale)` (default locale en-US, as in Node).
pub fn to_locale_string(date: &JsDate, locale: Option<&str>) -> Option<String> {
    let f = date.local_fields()?;
    let gb = locale.is_some_and(|l| l.eq_ignore_ascii_case("en-GB"));
    if gb {
        return Some(format!("{:02}/{:02}/{}, {:02}:{:02}:{:02}", f.day, f.month + 1, f.year, f.hours, f.minutes, f.seconds));
    }
    let (h12, ampm) = match f.hours {
        0 => (12, "AM"),
        h @ 1..=11 => (h, "AM"),
        12 => (12, "PM"),
        h => (h - 12, "PM"),
    };
    Some(format!("{}/{}/{}, {h12}:{:02}:{:02} {ampm}", f.month + 1, f.day, f.year, f.minutes, f.seconds))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn overflow_and_iso() {
        let d = JsDate::utc(2024.0, 1.0, 31.0, 0.0, 0.0, 0.0, 0.0);
        assert_eq!(d.to_iso_string().unwrap(), "2024-03-02T00:00:00.000Z");
        assert_eq!(JsDate::parse("2024-03-15").to_iso_string().unwrap(), "2024-03-15T00:00:00.000Z");
        assert_eq!(JsDate::parse("2024-03-15T14:30:00Z").to_iso_string().unwrap(), "2024-03-15T14:30:00.000Z");
        assert!(!JsDate::parse("nope").is_valid());
    }
}
