//! Function and component registries (port of `chassis/registries` and
//! `authoring/registries`).
//!
//! A registered function is a closure plus optional schemas. [`FunctionEntry::call`] applies the
//! same pre-checks as the TS runtime library's `evaluateFunction` / `precheckShortCircuit`, so
//! schema behaviour (short-circuits, `TypeError`s) matches.

use std::collections::HashMap;
use std::sync::Arc;

use futures::future::BoxFuture;
use futures::FutureExt;

use crate::engine::errors::{ForgeError, ForgeResult};
use crate::engine::runtime::context::EffectContext;
use crate::schema::Schema;
use crate::value::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum FunctionType {
    Condition,
    Transformer,
    Generator,
    Effect,
}

impl FunctionType {
    pub fn tag(self) -> &'static str {
        match self {
            FunctionType::Condition => "FunctionType.Condition",
            FunctionType::Transformer => "FunctionType.Transformer",
            FunctionType::Generator => "FunctionType.Generator",
            FunctionType::Effect => "FunctionType.Effect",
        }
    }
}

/// A function result that may still be pending.
pub enum FnOutput {
    Ready(ForgeResult<Value>),
    Pending(BoxFuture<'static, ForgeResult<Value>>),
}

impl FnOutput {
    pub async fn resolve(self) -> ForgeResult<Value> {
        match self {
            FnOutput::Ready(r) => r,
            FnOutput::Pending(f) => f.await,
        }
    }
}

impl From<ForgeResult<Value>> for FnOutput {
    fn from(r: ForgeResult<Value>) -> Self {
        FnOutput::Ready(r)
    }
}

/// Conditions, transformers and generators: `(args) -> value`. For conditions and transformers
/// `args[0]` is the subject value; generators receive only their configured arguments.
pub type PureFn = Arc<dyn Fn(&[Value]) -> FnOutput + Send + Sync>;

/// Effects: `(context, args) -> ()`.
pub type EffectFn = Arc<dyn Fn(EffectContext, Vec<Value>) -> BoxFuture<'static, ForgeResult<()>> + Send + Sync>;

#[derive(Clone)]
pub enum FnImpl {
    Pure(PureFn),
    Effect(EffectFn),
}

#[derive(Clone)]
pub struct FunctionEntry {
    pub name: Arc<str>,
    pub function_type: FunctionType,
    pub input_schema: Option<Schema>,
    pub arguments_schema: Option<Schema>,
    pub output_schema: Option<Schema>,
    pub implementation: FnImpl,
}

impl FunctionEntry {
    fn new(name: &str, function_type: FunctionType, implementation: FnImpl) -> Self {
        Self {
            name: name.into(),
            function_type,
            input_schema: None,
            arguments_schema: None,
            // Conditions must return booleans (`CONDITION_OUTPUT_SCHEMA`).
            output_schema: (function_type == FunctionType::Condition).then_some(Schema::Boolean),
            implementation,
        }
    }

    pub fn condition(name: &str, f: impl Fn(&Value, &[Value]) -> ForgeResult<bool> + Send + Sync + 'static) -> Self {
        Self::new(
            name,
            FunctionType::Condition,
            FnImpl::Pure(Arc::new(move |args: &[Value]| {
                let (subject, rest) = split_subject(args);
                FnOutput::Ready(f(&subject, rest).map(Value::Bool))
            })),
        )
    }

    pub fn async_condition<Fut>(name: &str, f: impl Fn(Value, Vec<Value>) -> Fut + Send + Sync + 'static) -> Self
    where
        Fut: std::future::Future<Output = ForgeResult<bool>> + Send + 'static,
    {
        Self::new(
            name,
            FunctionType::Condition,
            FnImpl::Pure(Arc::new(move |args: &[Value]| {
                let (subject, rest) = split_subject(args);
                FnOutput::Pending(f(subject, rest.to_vec()).map(|r| r.map(Value::Bool)).boxed())
            })),
        )
    }

    pub fn transformer(name: &str, f: impl Fn(&Value, &[Value]) -> ForgeResult<Value> + Send + Sync + 'static) -> Self {
        Self::new(
            name,
            FunctionType::Transformer,
            FnImpl::Pure(Arc::new(move |args: &[Value]| {
                let (subject, rest) = split_subject(args);
                FnOutput::Ready(f(&subject, rest))
            })),
        )
    }

    pub fn async_transformer<Fut>(name: &str, f: impl Fn(Value, Vec<Value>) -> Fut + Send + Sync + 'static) -> Self
    where
        Fut: std::future::Future<Output = ForgeResult<Value>> + Send + 'static,
    {
        Self::new(
            name,
            FunctionType::Transformer,
            FnImpl::Pure(Arc::new(move |args: &[Value]| {
                let (subject, rest) = split_subject(args);
                FnOutput::Pending(f(subject, rest.to_vec()).boxed())
            })),
        )
    }

    pub fn generator(name: &str, f: impl Fn(&[Value]) -> ForgeResult<Value> + Send + Sync + 'static) -> Self {
        Self::new(name, FunctionType::Generator, FnImpl::Pure(Arc::new(move |args: &[Value]| FnOutput::Ready(f(args)))))
    }

    pub fn async_generator<Fut>(name: &str, f: impl Fn(Vec<Value>) -> Fut + Send + Sync + 'static) -> Self
    where
        Fut: std::future::Future<Output = ForgeResult<Value>> + Send + 'static,
    {
        Self::new(
            name,
            FunctionType::Generator,
            FnImpl::Pure(Arc::new(move |args: &[Value]| FnOutput::Pending(f(args.to_vec()).boxed()))),
        )
    }

    pub fn effect<Fut>(name: &str, f: impl Fn(EffectContext, Vec<Value>) -> Fut + Send + Sync + 'static) -> Self
    where
        Fut: std::future::Future<Output = ForgeResult<()>> + Send + 'static,
    {
        Self::new(name, FunctionType::Effect, FnImpl::Effect(Arc::new(move |ctx, args| f(ctx, args).boxed())))
    }

    pub fn with_input(mut self, schema: Schema) -> Self {
        self.input_schema = Some(schema);
        self
    }

    pub fn with_arguments(mut self, schema: Schema) -> Self {
        self.arguments_schema = Some(schema);
        self
    }

    pub fn with_output(mut self, schema: Schema) -> Self {
        self.output_schema = Some(schema);
        self
    }

    fn type_error(&self, message: String) -> ForgeError {
        ForgeError::Type { message, function_type: Some(self.function_type.tag().to_string()) }
    }

    /// `precheckShortCircuit`: `Ok(Some(v))` short-circuits with `v`, `Ok(None)` proceeds.
    fn precheck(&self, args: &[Value]) -> ForgeResult<Option<Value>> {
        let injected = self.function_type != FunctionType::Generator;
        if let Some(schema) = &self.arguments_schema {
            let config = if injected { args.get(1..).unwrap_or_default() } else { args };
            if let Err(e) = schema.parse(&Value::array(config.to_vec())) {
                return Err(self.type_error(format!("{}: arguments failed schema validation — {e}", self.name)));
            }
        }
        if !injected || self.function_type == FunctionType::Effect {
            return Ok(None);
        }
        let subject = args.first().cloned().unwrap_or_default();
        if subject.is_undefined() {
            return Ok(Some(match self.function_type {
                FunctionType::Condition => Value::Bool(false),
                _ => Value::Undefined,
            }));
        }
        let Some(schema) = &self.input_schema else { return Ok(None) };
        match (self.function_type, schema.parse(&subject)) {
            (_, Ok(_)) => Ok(None),
            (FunctionType::Condition, Err(_)) => Ok(Some(Value::Bool(false))),
            (_, Err(e)) => Err(self.type_error(format!("{}: value failed schema validation — {e}", self.name))),
        }
    }

    fn check_output(&self, value: Value) -> ForgeResult<Value> {
        match self.output_schema.as_ref().map(|s| s.parse(&value)) {
            Some(Err(e)) => Err(self.type_error(format!("{}: return value failed schema validation — {e}", self.name))),
            _ => Ok(value),
        }
    }

    /// Evaluates a condition, transformer or generator (`evaluateFunction`).
    pub async fn call(&self, args: Vec<Value>) -> ForgeResult<Value> {
        if let Some(short) = self.precheck(&args)? {
            return Ok(short);
        }
        let FnImpl::Pure(f) = &self.implementation else {
            return Err(ForgeError::evaluation(format!("{} is an effect and cannot be evaluated as a value", self.name)));
        };
        let value = f(&args).resolve().await?;
        self.check_output(value)
    }

    /// Runs an effect.
    pub async fn run_effect(&self, ctx: EffectContext, args: Vec<Value>) -> ForgeResult<()> {
        let mut with_ctx = vec![Value::Undefined];
        with_ctx.extend(args.iter().cloned());
        self.precheck(&with_ctx)?;
        let FnImpl::Effect(f) = &self.implementation else {
            return Err(ForgeError::evaluation(format!("{} is not an effect", self.name)));
        };
        f(ctx, args).await
    }
}

fn split_subject(args: &[Value]) -> (Value, &[Value]) {
    match args.split_first() {
        Some((first, rest)) => (first.clone(), rest),
        None => (Value::Undefined, &[]),
    }
}

/// All registered functions, by name (`FunctionRegistry`).
#[derive(Clone, Default)]
pub struct FunctionRegistry {
    entries: HashMap<Arc<str>, FunctionEntry>,
}

impl FunctionRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, entry: FunctionEntry) -> ForgeResult<()> {
        if self.entries.contains_key(&entry.name) {
            return Err(ForgeError::Authoring {
                message: format!("A function is already registered under the name \"{}\"", entry.name),
            });
        }
        self.entries.insert(entry.name.clone(), entry);
        Ok(())
    }

    pub fn register_all(&mut self, entries: impl IntoIterator<Item = FunctionEntry>) -> ForgeResult<()> {
        entries.into_iter().try_for_each(|e| self.register(e))
    }

    /// `ScopedFunctionRegistry`: `entries` (duplicates among them rejected) layered over this
    /// registry, shadowing globals of the same name.
    pub fn scoped(&self, entries: impl IntoIterator<Item = FunctionEntry>) -> ForgeResult<Self> {
        let mut scope = Self::new();
        scope.register_all(entries)?;
        let mut merged = self.clone();
        merged.entries.extend(scope.entries);
        Ok(merged)
    }

    pub fn get(&self, name: &str) -> Option<&FunctionEntry> {
        self.entries.get(name)
    }

    pub fn names(&self) -> impl Iterator<Item = &Arc<str>> {
        self.entries.keys()
    }
}

pub type ComponentRender = Arc<dyn Fn(&Value, &dyn std::any::Any) -> ForgeResult<Value> + Send + Sync>;

/// What the engine needs to know about a block component. Rendering lives in adapters.
#[derive(Clone)]
pub struct ComponentEntry {
    pub variant: Arc<str>,
    pub input_schema: Option<Schema>,
    /// Field accepts multiple values (normalised to an array on POST).
    pub multiple: bool,
    /// Derives the error-summary anchor from the resolved block props.
    pub error_anchor: Option<Arc<dyn Fn(&Value) -> Option<String> + Send + Sync>>,
    /// Renders an evaluated block. The second argument is the renderer's engine (the TS
    /// `renderer?: unknown`), which components downcast to the engine they expect.
    pub render: Option<ComponentRender>,
}

impl ComponentEntry {
    pub fn new(variant: &str) -> Self {
        Self { variant: variant.into(), input_schema: None, multiple: false, error_anchor: None, render: None }
    }

    pub fn with_input(mut self, schema: Schema) -> Self {
        self.input_schema = Some(schema);
        self
    }

    pub fn multiple(mut self) -> Self {
        self.multiple = true;
        self
    }

    pub fn with_error_anchor(mut self, f: impl Fn(&Value) -> Option<String> + Send + Sync + 'static) -> Self {
        self.error_anchor = Some(Arc::new(f));
        self
    }

    pub fn with_render(mut self, f: impl Fn(&Value, &dyn std::any::Any) -> ForgeResult<Value> + Send + Sync + 'static) -> Self {
        self.render = Some(Arc::new(f));
        self
    }
}

#[derive(Clone, Default)]
pub struct ComponentRegistry {
    entries: HashMap<Arc<str>, ComponentEntry>,
}

impl ComponentRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, entry: ComponentEntry) -> ForgeResult<()> {
        self.register_all([entry])
    }

    /// `ComponentRegistry.registerMany`: valid entries are registered; every invalid one
    /// (no variant, no render function, a duplicate variant) is reported together.
    pub fn register_all(&mut self, entries: impl IntoIterator<Item = ComponentEntry>) -> ForgeResult<()> {
        use crate::engine::dsl::Diagnostic;
        let mut errors = Vec::new();
        for entry in entries {
            if entry.variant.is_empty() {
                errors.push(Diagnostic {
                    expected: Some("variant property".into()),
                    ..Diagnostic::new("ForgeRegistryValidationError", "Component must have a variant property")
                });
            } else if entry.render.is_none() {
                errors.push(Diagnostic {
                    expected: Some("render function".into()),
                    ..Diagnostic::new("ForgeRegistryValidationError", format!("Component \"{}\" must have a render function", entry.variant))
                });
            } else if self.entries.contains_key(&entry.variant) {
                errors.push(Diagnostic::new(
                    "ForgeRegistryDuplicateError",
                    format!("Duplicate component registration: \"{}\"", entry.variant),
                ));
            } else {
                self.entries.insert(entry.variant.clone(), entry);
            }
        }
        if errors.is_empty() { Ok(()) } else { Err(crate::engine::dsl::aggregate("Component registration failed", &errors)) }
    }

    /// `ScopedComponentRegistry`: package components layered over the global ones, shadowing
    /// a global (built-in included) of the same variant.
    pub fn scoped(&self, entries: impl IntoIterator<Item = ComponentEntry>) -> ForgeResult<Self> {
        let mut scope = Self::new();
        scope.register_all(entries)?;
        let mut merged = self.clone();
        merged.entries.extend(scope.entries);
        Ok(merged)
    }

    pub fn get(&self, variant: &str) -> Option<&ComponentEntry> {
        self.entries.get(variant)
    }
}
