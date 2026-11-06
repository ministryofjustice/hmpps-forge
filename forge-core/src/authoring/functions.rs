//! Function collectors (the TS `ConditionRegistry` / `TransformerRegistry` / `EffectRegistry` /
//! `GeneratorRegistry`): gather [`FunctionEntry`] registrations next to the definitions that call
//! them, named or anonymous, and hand them to a package in one go.
//!
//! ```
//! use forge_core::authoring::*;
//! use forge_core::authoring::functions::Functions;
//! use forge_core::{obj, ForgePackage, Value};
//!
//! let functions = Functions::new();
//!
//! // Anonymous: stored under an auto-generated name, called right where it is used.
//! let shout = functions.transformer(|value, _args| Ok(Value::from(value.to_js_string().to_uppercase())));
//! let heading = block(obj! { "variant": "html", "content": answer("name").pipe([shout.call(vec![])]) });
//!
//! let package = ForgePackage::new(Value::empty_object()).with_functions(&functions);
//! assert_eq!(package.functions.len(), 1);
//! # let _ = heading;
//! ```

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use crate::engine::errors::ForgeResult;
use crate::engine::registries::{FunctionEntry, FunctionType};
use crate::engine::runtime::context::EffectContext;
use crate::value::Value;

/// Anonymous registrations are numbered across all collectors, so two collectors in one package
/// never produce the same name.
static ANONYMOUS: AtomicUsize = AtomicUsize::new(0);

fn anonymous_name() -> String {
    format!("__anon_{}", ANONYMOUS.fetch_add(1, Ordering::Relaxed))
}

/// Collects function entries. Cloning shares the collection, so a clone can be handed to the
/// modules that build definitions while the package keeps the original.
#[derive(Clone, Default)]
pub struct Functions {
    entries: Arc<Mutex<Vec<FunctionEntry>>>,
}

impl Functions {
    pub fn new() -> Self {
        Self::default()
    }

    /// Stores a named entry and returns the handle that calls it.
    pub fn register(&self, entry: FunctionEntry) -> FunctionHandle {
        let handle = FunctionHandle { name: entry.name.clone(), function_type: entry.function_type };
        self.entries.lock().unwrap().push(entry);
        handle
    }

    /// An anonymous condition: `f(value, args)`.
    pub fn condition(&self, f: impl Fn(&Value, &[Value]) -> ForgeResult<bool> + Send + Sync + 'static) -> FunctionHandle {
        self.register(FunctionEntry::condition(&anonymous_name(), f))
    }

    /// An anonymous transformer: `f(value, args)`.
    pub fn transformer(&self, f: impl Fn(&Value, &[Value]) -> ForgeResult<Value> + Send + Sync + 'static) -> FunctionHandle {
        self.register(FunctionEntry::transformer(&anonymous_name(), f))
    }

    /// An anonymous generator: `f(args)`.
    pub fn generator(&self, f: impl Fn(&[Value]) -> ForgeResult<Value> + Send + Sync + 'static) -> FunctionHandle {
        self.register(FunctionEntry::generator(&anonymous_name(), f))
    }

    /// An anonymous effect: `f(context, args)`.
    pub fn effect<Fut>(&self, f: impl Fn(EffectContext, Vec<Value>) -> Fut + Send + Sync + 'static) -> FunctionHandle
    where
        Fut: std::future::Future<Output = ForgeResult<()>> + Send + 'static,
    {
        self.register(FunctionEntry::effect(&anonymous_name(), f))
    }

    /// Everything collected so far, in registration order.
    pub fn entries(&self) -> Vec<FunctionEntry> {
        self.entries.lock().unwrap().clone()
    }
}

impl IntoIterator for &Functions {
    type Item = FunctionEntry;
    type IntoIter = std::vec::IntoIter<FunctionEntry>;

    fn into_iter(self) -> Self::IntoIter {
        self.entries().into_iter()
    }
}

impl IntoIterator for Functions {
    type Item = FunctionEntry;
    type IntoIter = std::vec::IntoIter<FunctionEntry>;

    fn into_iter(self) -> Self::IntoIter {
        self.entries().into_iter()
    }
}

/// What a registration returns: calling it builds the expression a definition uses.
#[derive(Clone, Debug)]
pub struct FunctionHandle {
    name: Arc<str>,
    function_type: FunctionType,
}

impl FunctionHandle {
    /// The registered name (auto-generated for anonymous registrations).
    pub fn name(&self) -> &str {
        &self.name
    }

    /// The call expression, e.g. for `.pipe([...])`, `.matches(...)`, or an `effects` list.
    pub fn call(&self, arguments: Vec<Value>) -> Value {
        super::function_call(self.function_type.tag(), &self.name, arguments)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anonymous_registrations_get_distinct_names_and_calls() {
        let functions = Functions::new();
        let a = functions.condition(|_, _| Ok(true));
        let b = functions.transformer(|v, _| Ok(v.clone()));
        assert_ne!(a.name(), b.name());
        assert!(a.name().starts_with("__anon_"));
        let call = b.call(vec![Value::from(1)]);
        assert_eq!(call.get("type").as_str(), Some("FunctionType.Transformer"));
        assert_eq!(call.get("name").as_str(), Some(b.name()));
        assert_eq!(functions.entries().len(), 2);
        assert_eq!(functions.clone().entries().len(), 2, "clones share the collection");
    }
}
