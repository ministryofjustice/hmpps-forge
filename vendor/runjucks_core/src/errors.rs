//! User-facing render and parse failures as a simple string message.
//!
//! Functions in this crate that can fail return [`Result`]`<T, `[`RunjucksError`]`>`.

use std::fmt;

/// Error returned when lexing, parsing, or rendering cannot complete.
///
/// Carries a human-readable message suitable for logs or passing to JavaScript via the NAPI layer.
///
/// # Examples
///
/// ```
/// use runjucks_core::RunjucksError;
///
/// let e = RunjucksError::new("unclosed tag");
/// assert_eq!(e.to_string(), "unclosed tag");
/// ```
#[derive(Debug)]
pub struct RunjucksError {
    message: String,
}

impl RunjucksError {
    /// Creates an error with the given message.
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl fmt::Display for RunjucksError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for RunjucksError {}

/// Convenient alias for `std::result::Result` with [`RunjucksError`] as the error type.
pub type Result<T> = std::result::Result<T, RunjucksError>;
