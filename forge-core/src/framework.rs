//! The engine's framework-facing boundary (port of `framework/types`): request snapshots in,
//! outcomes out. Adapters (the Topcoat adapter) translate HTTP to and from these.

use std::sync::{Arc, Mutex};

use crate::engine::runtime::context::RequestLocation;
use crate::value::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HttpMethod {
    Get,
    Post,
}

impl HttpMethod {
    pub fn as_str(self) -> &'static str {
        match self {
            HttpMethod::Get => "GET",
            HttpMethod::Post => "POST",
        }
    }
}

/// Everything the engine needs from one HTTP request (`RequestSnapshot`).
#[derive(Clone, Debug)]
pub struct RequestSnapshot {
    pub node_id: Arc<str>,
    pub method: HttpMethod,
    pub location: RequestLocation,
    /// `Record<string, string>`.
    pub params: Value,
    /// `Record<string, string | string[]>`.
    pub query: Value,
    pub post: Value,
    pub headers: Value,
    pub cookies: Value,
    pub state: Value,
    /// The session. Effects may change it; the outcome carries the final session back.
    pub session: Value,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct CookieOptions {
    pub max_age: Option<f64>,
    pub expires: Option<String>,
    pub http_only: Option<bool>,
    pub secure: Option<bool>,
    pub same_site: Option<String>,
    pub path: Option<String>,
    pub domain: Option<String>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct CookieMutation {
    pub value: String,
    pub options: Option<CookieOptions>,
}

/// Lets effects set response headers and cookies (`ResponseBindings`).
pub trait ResponseBindings: Send + Sync {
    fn set_header(&self, name: &str, value: &str);
    fn set_cookie(&self, name: &str, value: &str, options: Option<CookieOptions>);
}

/// Response bindings that record what effects set, in call order.
#[derive(Default)]
pub struct RecordingResponse {
    pub headers: Mutex<indexmap::IndexMap<String, String>>,
    pub cookies: Mutex<indexmap::IndexMap<String, CookieMutation>>,
}

impl ResponseBindings for RecordingResponse {
    fn set_header(&self, name: &str, value: &str) {
        self.headers.lock().unwrap().insert(name.to_string(), value.to_string());
    }

    fn set_cookie(&self, name: &str, value: &str, options: Option<CookieOptions>) {
        self.cookies.lock().unwrap().insert(name.to_string(), CookieMutation { value: value.to_string(), options });
    }
}

/// A request-handling error with an HTTP status (`ForgeError` in outcome position).
#[derive(Clone, Debug, PartialEq)]
pub struct OutcomeError {
    pub status: u16,
    pub message: String,
}

/// What the engine decided for one request (`ForgeOutcome`).
#[derive(Clone, Debug)]
pub enum OutcomeKind {
    /// Render the step. `context` is the `RenderContext` as a JS-shaped value; `output` is the
    /// renderer's output when a renderer was supplied.
    Render { context: Value, output: Option<Value> },
    Navigate { url: String },
    Error(OutcomeError),
}

#[derive(Clone, Debug)]
pub struct Outcome {
    pub kind: OutcomeKind,
    /// The session after the request (effects may have changed it).
    pub session: Value,
}
