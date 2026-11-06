//! Request-time state (`RuntimeContext`) and the effect function context.
//!
//! The TS engine hands compiled functions live references into one mutable context object, so an
//! effect's writes are visible to the next expression evaluated in the same request. The Rust
//! port keeps one `RuntimeContext` behind a shared lock: evaluators lock briefly to read, effects
//! lock briefly to write, and nothing holds the lock across an await.

use std::sync::{Arc, Mutex, MutexGuard};

use indexmap::IndexMap;

use crate::engine::ast::NodeId;
use crate::engine::errors::{ForgeError, ForgeResult};
use crate::framework::{CookieOptions, ResponseBindings};
use crate::value::{Map, Value};

/// One recorded change to an answer.
#[derive(Clone, Debug)]
pub struct AnswerMutation {
    pub value: Value,
    pub source: Arc<str>,
}

/// An answer and how it got its current value.
#[derive(Clone, Debug, Default)]
pub struct AnswerHistory {
    pub current: Value,
    pub parsed: Value,
    pub mutations: Vec<AnswerMutation>,
}

impl AnswerHistory {
    pub fn push(&mut self, value: Value, source: &str) {
        self.mutations.push(AnswerMutation { value: value.clone(), source: source.into() });
        self.current = value;
    }

    /// JS view: `{ current, parsed?, mutations }` with `undefined` entries omitted on output.
    pub fn to_value(&self) -> Value {
        let mut map = Map::new();
        map.insert("current".into(), self.current.clone());
        map.insert(
            "mutations".into(),
            Value::array(
                self.mutations
                    .iter()
                    .map(|m| Value::from_pairs([("value", m.value.clone()), ("source", Value::String(m.source.clone()))]))
                    .collect(),
            ),
        );
        if !self.parsed.is_undefined() {
            map.insert("parsed".into(), self.parsed.clone());
        }
        Value::object(map)
    }
}

pub type Answers = IndexMap<Arc<str>, AnswerHistory>;

/// `RequestLocation`.
#[derive(Clone, Debug, Default)]
pub struct RequestLocation {
    pub origin: String,
    pub href: String,
    pub pathname: String,
    pub base_path: String,
}

impl RequestLocation {
    pub fn to_value(&self) -> Value {
        Value::from_pairs([
            ("origin", Value::from(self.origin.as_str())),
            ("href", Value::from(self.href.as_str())),
            ("pathname", Value::from(self.pathname.as_str())),
            ("basePath", Value::from(self.base_path.as_str())),
        ])
    }
}

/// `context.request`, copied from the snapshot during context preparation.
#[derive(Clone, Debug, Default)]
pub struct RequestContext {
    pub url: String,
    pub path: String,
    pub method: String,
    pub location: RequestLocation,
    pub headers: Value,
    pub cookies: Value,
    pub state: Value,
    pub params: Value,
    pub query: Value,
    pub post: Value,
    pub session: Value,
}

impl RequestContext {
    /// The `ctx.request` object compiled expressions read (`{ ...context.request }`).
    pub fn to_value(&self) -> Value {
        Value::from_pairs([
            ("url", Value::from(self.url.as_str())),
            ("path", Value::from(self.path.as_str())),
            ("method", Value::from(self.method.as_str())),
            ("location", self.location.to_value()),
            ("headers", self.headers.clone()),
            ("cookies", self.cookies.clone()),
            ("state", self.state.clone()),
            ("params", self.params.clone()),
            ("query", self.query.clone()),
            ("post", self.post.clone()),
            ("session", self.session.clone()),
        ])
    }
}

#[derive(Clone, Debug, Default)]
pub struct DomainContext {
    pub data: Map,
    pub answers: Answers,
}

/// `context.evaluation`. Concern-specific results are stored type-erased by the owning concern.
#[derive(Default)]
pub struct EvaluationContext {
    pub iterations: usize,
    pub max_iterations: usize,
    pub fields_to_clear: Option<Vec<Arc<str>>>,
    pub reachability_validities: Option<IndexMap<NodeId, crate::engine::concerns::validation::StepValidity>>,
    pub reachability: Option<Arc<crate::engine::concerns::reachability::JourneyReachabilityProjection>>,
}

#[derive(Default)]
pub struct RuntimeContext {
    pub request: RequestContext,
    pub domain: DomainContext,
    pub evaluation: EvaluationContext,
}

impl RuntimeContext {
    /// `IteratorBudget.consume()`.
    pub fn consume_iteration(&mut self) -> ForgeResult<()> {
        self.evaluation.iterations += 1;
        if self.evaluation.max_iterations > 0 && self.evaluation.iterations > self.evaluation.max_iterations {
            return Err(ForgeError::IteratorBudget { limit: self.evaluation.max_iterations });
        }
        Ok(())
    }

    pub fn answers_value(&self) -> Value {
        Value::object(self.domain.answers.iter().map(|(k, h)| (k.clone(), h.to_value())).collect())
    }
}

/// Shared handle on one request's `RuntimeContext`.
#[derive(Clone, Default)]
pub struct SharedContext(Arc<Mutex<RuntimeContext>>);

impl SharedContext {
    pub fn new(ctx: RuntimeContext) -> Self {
        SharedContext(Arc::new(Mutex::new(ctx)))
    }

    pub fn lock(&self) -> MutexGuard<'_, RuntimeContext> {
        self.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

/// Which lifecycle an effect runs in; recorded as the answer mutation source.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HookType {
    Access,
    Submit,
}

impl HookType {
    pub fn as_str(self) -> &'static str {
        match self {
            HookType::Access => "access",
            HookType::Submit => "submit",
        }
    }
}

fn assert_serializable(value: &Value, _method: &str) -> ForgeResult<()> {
    // Rust `Value`s are always plain data; nothing to reject.
    let _ = value;
    Ok(())
}

/// The context effects receive (`EffectFunctionContext`).
#[derive(Clone)]
pub struct EffectContext {
    ctx: SharedContext,
    response: Arc<dyn ResponseBindings>,
    hook_type: HookType,
}

impl EffectContext {
    pub fn new(ctx: SharedContext, response: Arc<dyn ResponseBindings>, hook_type: HookType) -> Self {
        Self { ctx, response, hook_type }
    }

    pub fn hook_type(&self) -> HookType {
        self.hook_type
    }

    pub fn get_answer(&self, key: &str) -> Value {
        self.ctx.lock().domain.answers.get(key).map(|h| h.current.clone()).unwrap_or_default()
    }

    pub fn set_answer(&self, key: &str, value: Value) -> ForgeResult<()> {
        assert_serializable(&value, "setAnswer")?;
        let source = self.hook_type.as_str();
        self.ctx.lock().domain.answers.entry(key.into()).or_default().push(value, source);
        Ok(())
    }

    pub fn get_all_answers(&self) -> Map {
        self.ctx.lock().domain.answers.iter().map(|(k, h)| (k.clone(), h.current.clone())).collect()
    }

    pub fn get_answer_history(&self, key: &str) -> Option<AnswerHistory> {
        self.ctx.lock().domain.answers.get(key).cloned()
    }

    pub fn get_all_answer_histories(&self) -> Answers {
        self.ctx.lock().domain.answers.clone()
    }

    pub fn has_answer(&self, key: &str) -> bool {
        self.ctx.lock().domain.answers.contains_key(key)
    }

    pub fn clear_answer(&self, key: &str) {
        self.ctx.lock().domain.answers.shift_remove(key);
    }

    pub fn get_data(&self, key: &str) -> Value {
        self.ctx.lock().domain.data.get(key).cloned().unwrap_or_default()
    }

    pub fn set_data(&self, key: &str, value: Value) -> ForgeResult<()> {
        assert_serializable(&value, "setData")?;
        self.ctx.lock().domain.data.insert(key.into(), value);
        Ok(())
    }

    pub fn get_all_data(&self) -> Map {
        self.ctx.lock().domain.data.clone()
    }

    pub fn get_request_url(&self) -> String {
        self.ctx.lock().request.url.clone()
    }

    pub fn get_request_param(&self, key: &str) -> Value {
        self.ctx.lock().request.params.get(key)
    }

    pub fn get_all_request_params(&self) -> Value {
        self.ctx.lock().request.params.clone()
    }

    pub fn get_query_param(&self, key: &str) -> Value {
        self.ctx.lock().request.query.get(key)
    }

    pub fn get_all_query_params(&self) -> Value {
        self.ctx.lock().request.query.clone()
    }

    pub fn get_post_data(&self, key: &str) -> Value {
        self.ctx.lock().request.post.get(key)
    }

    pub fn get_all_post_data(&self) -> Value {
        self.ctx.lock().request.post.clone()
    }

    /// The request session. Effects that change the session write it back with
    /// [`EffectContext::set_session`] or [`EffectContext::update_session`].
    pub fn get_session(&self) -> Value {
        self.ctx.lock().request.session.clone()
    }

    pub fn set_session(&self, session: Value) {
        self.ctx.lock().request.session = session;
    }

    /// Mutates the session in place, the way TS effects mutate the object `getSession()` returns.
    pub fn update_session<R>(&self, f: impl FnOnce(&mut Value) -> R) -> R {
        f(&mut self.ctx.lock().request.session)
    }

    pub fn get_state(&self, key: &str) -> Value {
        self.ctx.lock().request.state.get(key)
    }

    pub fn get_all_state(&self) -> Value {
        self.ctx.lock().request.state.clone()
    }

    pub fn get_request_header(&self, name: &str) -> Value {
        self.ctx.lock().request.headers.get(name)
    }

    pub fn get_all_request_headers(&self) -> Value {
        self.ctx.lock().request.headers.clone()
    }

    pub fn get_request_cookie(&self, name: &str) -> Value {
        self.ctx.lock().request.cookies.get(name)
    }

    pub fn get_all_request_cookies(&self) -> Value {
        self.ctx.lock().request.cookies.clone()
    }

    pub fn set_response_header(&self, name: &str, value: &str) {
        self.response.set_header(name, value);
    }

    pub fn set_response_cookie(&self, name: &str, value: &str, options: Option<CookieOptions>) {
        self.response.set_cookie(name, value, options);
    }

    pub fn get_fields_to_clear(&self) -> Vec<Arc<str>> {
        self.ctx.lock().evaluation.fields_to_clear.clone().unwrap_or_default()
    }
}
