//! [`Environment`] holds render options and is the entry point for [`Environment::render_string`].
//!
//! It ties together [`crate::lexer::tokenize`], [`crate::parser::parse`], and [`crate::renderer::render`].

use crate::ast::Node;
use crate::errors::{Result, RunjucksError};
use crate::extension::{
    register_extension_inner, remove_extension_inner, CustomExtensionHandler, ExtensionTagMeta,
};
use crate::globals::{default_globals_map, value_is_callable, RJ_CALLABLE};
use crate::lexer::{LexerOptions, Tags};
use crate::loader::TemplateLoader;
use crate::parser::is_reserved_tag_keyword;
use crate::value::{
    is_marked_safe, is_regexp_value, is_undefined_value, undefined_value, value_to_string,
};
use crate::{lexer, parser, renderer};
use serde_json::{Map, Value};
use std::borrow::Cow;
use std::collections::{HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::sync::{Arc, Mutex};

#[derive(Clone, Debug, PartialEq, Eq)]
struct ParseSignature {
    trim_blocks: bool,
    lstrip_blocks: bool,
    tags: Option<Tags>,
    extension_tag_keys: Vec<String>,
    extension_closing_names: Vec<String>,
}

struct CachedParse {
    sig: ParseSignature,
    ast: Arc<Node>,
    /// Identity of the loader instance used for this named parse cache entry.
    /// `None` for inline parses.
    loader_id: Option<usize>,
    /// Full source at parse time (validates hash collisions for inline cache; detects loader changes for named cache).
    source: Option<String>,
}

fn loader_identity(loader: &(dyn TemplateLoader + Send + Sync)) -> usize {
    let ptr = loader as *const (dyn TemplateLoader + Send + Sync);
    ptr as *const () as usize
}

fn hash_source(s: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    let mut h = DefaultHasher::new();
    s.hash(&mut h);
    h.finish()
}

/// User-registered filter (Nunjucks `addFilter`). Invoked as `(input, extra_args…)`.
///
/// When a custom filter has the same name as a built-in, the custom filter wins (Nunjucks behavior).
pub type CustomFilter = Arc<dyn Fn(&Value, &[Value]) -> Result<Value> + Send + Sync>;

/// User-registered `is` test (Nunjucks `addTest`). Invoked as `(value, extra_args…) -> bool`.
pub type CustomTest = Arc<dyn Fn(&Value, &[Value]) -> Result<bool> + Send + Sync>;

/// User-registered global **function** (Nunjucks `addGlobal` with a JS function in Node).
///
/// Positional args are passed in order; keyword args are passed as a single trailing object value
/// (Nunjucks keyword-argument convention), represented as `[(String, Value)]` before marshalling.
pub type CustomGlobalFn = Arc<dyn Fn(&[Value], &[(String, Value)]) -> Result<Value> + Send + Sync>;

/// Async variant of [`CustomFilter`]. Returns a boxed future.
#[cfg(feature = "async")]
pub type AsyncCustomFilter = Arc<
    dyn Fn(
            &Value,
            &[Value],
        ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Value>> + Send>>
        + Send
        + Sync,
>;

/// Async variant of [`CustomGlobalFn`]. Returns a boxed future.
#[cfg(feature = "async")]
pub type AsyncCustomGlobalFn = Arc<
    dyn Fn(
            &[Value],
            &[(String, Value)],
        ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Value>> + Send>>
        + Send
        + Sync,
>;

/// Introspection-only descriptor for a registered extension (Nunjucks `getExtension` analog).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ExtensionDescriptor {
    pub name: String,
    pub tags: Vec<String>,
    pub blocks: HashMap<String, String>,
}

/// Configuration and entry point for rendering templates.
///
/// # Fields
///
/// - **`autoescape`**: When `true` (the default), HTML-escapes string output from variable tags via
///   [`crate::filters::escape_html`].
/// - **`dev`**: Reserved for developer-mode behavior (e.g. richer errors); currently unused in the renderer.
/// - **`throw_on_undefined`**: When `true`, unbound variables are errors instead of the internal undefined sentinel.
/// - **`loader`**: Optional [`TemplateLoader`] for [`Environment::render_template`], `{% include %}`, `{% import %}`, `{% from %}`, and `{% extends %}`.
///
/// # Default
///
/// [`Environment::default`] sets `autoescape = true`, `dev = false`, and `loader = None`.
///
/// # Examples
///
/// ```
/// use runjucks_core::Environment;
/// use serde_json::json;
///
/// let mut env = Environment::default();
/// env.autoescape = false;
/// let out = env.render_string("<{{ x }}>".into(), json!({ "x": "b" })).unwrap();
/// assert_eq!(out, "<b>");
/// ```
#[derive(Clone)]
pub struct Environment {
    /// When true, variable output is passed through [`crate::filters::escape_html`].
    pub autoescape: bool,
    /// Developer mode flag (reserved).
    pub dev: bool,
    /// Resolves template names for [`Environment::render_template`], `include`, and `extends`.
    pub loader: Option<Arc<dyn TemplateLoader + Send + Sync>>,
    /// Nunjucks-style globals: used when a name is not bound in the template context (context wins if the key exists, including `null`).
    pub globals: HashMap<String, Value>,
    /// When true, an unbound variable name (not in context or globals) is a render error instead of [`crate::value::undefined_value`].
    pub throw_on_undefined: bool,
    /// When set, [`crate::filters::apply_builtin`] `random` uses this seed for reproducible output (conformance / tests).
    pub random_seed: Option<u64>,
    /// When true, the first newline after a block tag (`{% … %}`) is automatically removed (Nunjucks `trimBlocks`).
    pub trim_blocks: bool,
    /// When true, leading whitespace/tabs on a line before a block tag or comment are stripped (Nunjucks `lstripBlocks`).
    pub lstrip_blocks: bool,
    /// Custom delimiter strings (Nunjucks `tags` key in `configure`). `None` uses default delimiters.
    pub tags: Option<Tags>,
    pub(crate) custom_filters: HashMap<String, CustomFilter>,
    pub(crate) custom_tests: HashMap<String, CustomTest>,
    /// Nunjucks `addGlobal` with a callable (Node: JS function; tests: [`Environment::add_global_callable`]).
    pub(crate) custom_globals: HashMap<String, CustomGlobalFn>,
    /// Custom tag names → extension metadata (see [`Environment::register_extension`]).
    pub(crate) extension_tags: HashMap<String, ExtensionTagMeta>,
    pub(crate) extension_closing_tag_names: HashSet<String>,
    pub(crate) custom_extensions: HashMap<String, CustomExtensionHandler>,
    inline_parse_cache: Arc<Mutex<HashMap<u64, CachedParse>>>,
    named_parse_cache: Arc<Mutex<HashMap<String, CachedParse>>>,
    #[cfg(feature = "async")]
    pub(crate) async_custom_filters: HashMap<String, AsyncCustomFilter>,
    #[cfg(feature = "async")]
    pub(crate) async_custom_globals: HashMap<String, AsyncCustomGlobalFn>,
}

impl std::fmt::Debug for Environment {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Environment")
            .field("autoescape", &self.autoescape)
            .field("dev", &self.dev)
            .field("loader", &self.loader.is_some())
            .field("globals_len", &self.globals.len())
            .field("custom_filters_len", &self.custom_filters.len())
            .field("custom_tests_len", &self.custom_tests.len())
            .field("custom_globals_len", &self.custom_globals.len())
            .field("extension_tags_len", &self.extension_tags.len())
            .field("throw_on_undefined", &self.throw_on_undefined)
            .field("random_seed", &self.random_seed)
            .finish()
    }
}

fn is_truthy_value(v: &Value) -> bool {
    if is_undefined_value(v) {
        return false;
    }
    match v {
        Value::Null | Value::Bool(false) => false,
        Value::Bool(true) => true,
        Value::Number(n) => n.as_f64().map(|x| x != 0.0 && !x.is_nan()).unwrap_or(true),
        Value::String(s) => !s.is_empty(),
        Value::Array(_) | Value::Object(_) => true,
    }
}

fn as_is_test_integer(v: &Value) -> Result<i64> {
    v.as_i64()
        .or_else(|| v.as_f64().map(|x| x as i64))
        .ok_or_else(|| RunjucksError::new("test expected a number"))
}

/// `ToNumber`-style coercion for Nunjucks relational `is` tests (`gt`, `ge`, …).
fn to_number_for_is_compare(v: &Value) -> Option<f64> {
    if is_undefined_value(v) {
        return None;
    }
    match v {
        Value::Null => Some(0.0),
        Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse::<f64>().ok(),
        _ => None,
    }
}

fn relational_ordering(value: &Value, other: &Value) -> Option<std::cmp::Ordering> {
    if let (Value::String(s1), Value::String(s2)) = (value, other) {
        return Some(s1.cmp(s2));
    }
    let (n1, n2) = (
        to_number_for_is_compare(value),
        to_number_for_is_compare(other),
    );
    if let (Some(a), Some(b)) = (n1, n2) {
        if a.is_nan() || b.is_nan() {
            return None;
        }
        return a.partial_cmp(&b);
    }
    None
}

fn is_test_gt(value: &Value, arg_vals: &[Value]) -> bool {
    let Some(other) = arg_vals.first() else {
        return false;
    };
    relational_ordering(value, other)
        .map(|o| o == std::cmp::Ordering::Greater)
        .unwrap_or(false)
}

fn is_test_ge(value: &Value, arg_vals: &[Value]) -> bool {
    let Some(other) = arg_vals.first() else {
        return false;
    };
    relational_ordering(value, other)
        .map(|o| o == std::cmp::Ordering::Greater || o == std::cmp::Ordering::Equal)
        .unwrap_or(false)
}

fn is_test_lt(value: &Value, arg_vals: &[Value]) -> bool {
    let Some(other) = arg_vals.first() else {
        return false;
    };
    relational_ordering(value, other)
        .map(|o| o == std::cmp::Ordering::Less)
        .unwrap_or(false)
}

fn is_test_le(value: &Value, arg_vals: &[Value]) -> bool {
    let Some(other) = arg_vals.first() else {
        return false;
    };
    relational_ordering(value, other)
        .map(|o| o == std::cmp::Ordering::Less || o == std::cmp::Ordering::Equal)
        .unwrap_or(false)
}

fn is_test_iterable(v: &Value) -> bool {
    match v {
        Value::String(_) | Value::Array(_) => true,
        Value::Object(_) if is_undefined_value(v) || is_marked_safe(v) || is_regexp_value(v) => {
            false
        }
        Value::Object(_) => false,
        _ => false,
    }
}

fn is_test_mapping(v: &Value) -> bool {
    if is_undefined_value(v) {
        return false;
    }
    match v {
        Value::Object(_) if is_marked_safe(v) || is_regexp_value(v) => false,
        Value::Object(_) => true,
        _ => false,
    }
}

/// Nunjucks `equalto` / `sameas` (`===`): same template variable binding is always true; primitives
/// use JSON equality. Values carry no reference identity here, so objects and arrays compare by
/// value: an object passed through a macro argument or a loop variable is still `sameas` its source
/// binding, as in Nunjucks (govuk-frontend's date input relies on this); only distinct objects with
/// identical contents differ from Nunjucks. Used from templates and from `select` / `reject`
/// (always `same_binding: false`).
pub(crate) fn equalto_sameas_pair(
    left: &Value,
    right: &Value,
    same_template_variable: bool,
) -> bool {
    same_template_variable || left == right
}

impl Default for Environment {
    /// Returns an environment with `autoescape = true` and `dev = false`.
    fn default() -> Self {
        Self {
            autoescape: true,
            dev: false,
            loader: None,
            globals: default_globals_map(),
            throw_on_undefined: false,
            random_seed: None,
            trim_blocks: false,
            lstrip_blocks: false,
            tags: None,
            custom_filters: HashMap::new(),
            custom_tests: HashMap::new(),
            custom_globals: HashMap::new(),
            extension_tags: HashMap::new(),
            extension_closing_tag_names: HashSet::new(),
            custom_extensions: HashMap::new(),
            inline_parse_cache: Arc::new(Mutex::new(HashMap::new())),
            named_parse_cache: Arc::new(Mutex::new(HashMap::new())),
            #[cfg(feature = "async")]
            async_custom_filters: HashMap::new(),
            #[cfg(feature = "async")]
            async_custom_globals: HashMap::new(),
        }
    }
}

impl Environment {
    fn current_parse_signature(&self) -> ParseSignature {
        let mut keys: Vec<_> = self.extension_tags.keys().cloned().collect();
        keys.sort();
        let mut closing: Vec<_> = self.extension_closing_tag_names.iter().cloned().collect();
        closing.sort();
        ParseSignature {
            trim_blocks: self.trim_blocks,
            lstrip_blocks: self.lstrip_blocks,
            tags: self.tags.clone(),
            extension_tag_keys: keys,
            extension_closing_names: closing,
        }
    }

    fn parse_source_to_ast(&self, src: &str) -> Result<Node> {
        let tokens = lexer::tokenize_with_options(src, self.lexer_options())?;
        parser::parse_with_env(
            &tokens,
            &self.extension_tags,
            &self.extension_closing_tag_names,
        )
    }

    /// Parses template source using the inline parse cache (hash of source + parse signature).
    pub fn parse_or_cached_inline(&self, src: &str) -> Result<Arc<Node>> {
        let sig = self.current_parse_signature();
        let key = hash_source(src);
        {
            let cache = self.inline_parse_cache.lock().unwrap();
            if let Some(c) = cache.get(&key) {
                if c.sig == sig && c.source.as_deref() == Some(src) {
                    return Ok(Arc::clone(&c.ast));
                }
            }
        }
        let node = self.parse_source_to_ast(src)?;
        let arc = Arc::new(node);
        let mut cache = self.inline_parse_cache.lock().unwrap();
        cache.insert(
            key,
            CachedParse {
                sig,
                ast: Arc::clone(&arc),
                loader_id: None,
                source: Some(src.to_string()),
            },
        );
        Ok(arc)
    }

    /// Loads a template by name and returns a parsed AST, using the named parse cache when the loader supplies a [`TemplateLoader::cache_key`].
    pub(crate) fn load_and_parse_named(
        &self,
        name: &str,
        loader: &(dyn TemplateLoader + Send + Sync),
    ) -> Result<Arc<Node>> {
        if loader.cache_keys_are_stable() {
            let sig = self.current_parse_signature();
            let loader_id = loader_identity(loader);
            if let Some(key) = loader.cache_key_cow(name) {
                let cache = self.named_parse_cache.lock().unwrap();
                if let Some(c) = cache.get(key.as_ref()) {
                    if c.sig == sig && c.loader_id == Some(loader_id) {
                        return Ok(Arc::clone(&c.ast));
                    }
                }
                drop(cache);
                let src = loader.load(name)?;
                let key_after_load = loader.cache_key_cow(name).map(Cow::into_owned);
                return self.parse_with_named_cache_precomputed(
                    key_after_load,
                    sig,
                    loader_id,
                    &src,
                );
            }
        }
        let src = loader.load(name)?;
        self.parse_with_named_cache(name, loader, &src)
    }

    fn parse_with_named_cache(
        &self,
        name: &str,
        loader: &(dyn TemplateLoader + Send + Sync),
        src: &str,
    ) -> Result<Arc<Node>> {
        let sig = self.current_parse_signature();
        let loader_id = loader_identity(loader);
        let key = loader.cache_key_cow(name).map(Cow::into_owned);
        self.parse_with_named_cache_precomputed(key, sig, loader_id, src)
    }

    fn parse_with_named_cache_precomputed(
        &self,
        key: Option<String>,
        sig: ParseSignature,
        loader_id: usize,
        src: &str,
    ) -> Result<Arc<Node>> {
        if let Some(key) = key {
            {
                let cache = self.named_parse_cache.lock().unwrap();
                if let Some(c) = cache.get(key.as_str()) {
                    if c.sig == sig
                        && c.loader_id == Some(loader_id)
                        && c.source.as_deref() == Some(src)
                    {
                        return Ok(Arc::clone(&c.ast));
                    }
                }
            }
            let node = self.parse_source_to_ast(src)?;
            let arc = Arc::new(node);
            let mut cache = self.named_parse_cache.lock().unwrap();
            cache.insert(
                key,
                CachedParse {
                    sig,
                    ast: Arc::clone(&arc),
                    loader_id: Some(loader_id),
                    source: Some(src.to_string()),
                },
            );
            return Ok(arc);
        }
        let node = self.parse_source_to_ast(src)?;
        Ok(Arc::new(node))
    }

    /// Clears the named-template parse cache (e.g. after replacing the template loader).
    pub fn clear_named_parse_cache(&self) {
        self.named_parse_cache.lock().unwrap().clear();
    }

    /// Clears **all** parse caches: named templates ([`load_and_parse_named`]) and inline
    /// [`parse_or_cached_inline`] entries (Nunjucks `Environment#invalidateCache` analog).
    pub fn invalidate_cache(&self) {
        self.named_parse_cache.lock().unwrap().clear();
        self.inline_parse_cache.lock().unwrap().clear();
    }

    /// Renders a parsed AST without lexing/parsing (caller must use the same environment configuration as when the AST was produced).
    pub fn render_parsed(&self, ast: &Node, context: Value) -> Result<String> {
        let root = match context {
            Value::Object(m) => m,
            _ => Map::new(),
        };
        let mut stack = renderer::CtxStack::from_root(root);
        let loader = self.loader.as_ref().map(|arc| arc.as_ref());
        renderer::render(self, loader, ast, &mut stack)
    }

    /// Registers or replaces a global value (Nunjucks `addGlobal`). Names still lose to template context keys with the same name.
    ///
    /// Replacing a global with a JSON value clears any registered [`Environment::add_global_callable`] for that name.
    pub fn add_global(&mut self, name: impl Into<String>, value: Value) -> &mut Self {
        let name = name.into();
        self.custom_globals.remove(&name);
        self.globals.insert(name, value);
        self
    }

    /// Registers a global **function** implemented in Rust (tests / embedders). Node callers use NAPI `addGlobal` with a JS function.
    ///
    /// The template sees a [`crate::globals::RJ_CALLABLE`] marker for `is callable` / variable resolution; invocation uses `f`.
    pub fn add_global_callable(&mut self, name: impl Into<String>, f: CustomGlobalFn) -> &mut Self {
        let name = name.into();
        let mut m = Map::new();
        m.insert(RJ_CALLABLE.to_string(), Value::Bool(true));
        self.globals.insert(name.clone(), Value::Object(m));
        self.custom_globals.insert(name, f);
        self
    }

    /// Registers or replaces a custom filter (Nunjucks `addFilter`). Overrides a built-in with the same name.
    pub fn add_filter(&mut self, name: impl Into<String>, filter: CustomFilter) -> &mut Self {
        self.custom_filters.insert(name.into(), filter);
        self
    }

    /// Registers or replaces a custom `is` test (Nunjucks `addTest`). Used by `x is name` and by `select` / `reject`.
    pub fn add_test(&mut self, name: impl Into<String>, test: CustomTest) -> &mut Self {
        self.custom_tests.insert(name.into(), test);
        self
    }

    /// Registers a custom tag extension (Nunjucks `addExtension`): `tag_specs` lists `(opening_tag, optional_end_tag)`.
    pub fn register_extension(
        &mut self,
        extension_name: impl Into<String>,
        tag_specs: Vec<(String, Option<String>)>,
        handler: CustomExtensionHandler,
    ) -> Result<()> {
        let extension_name = extension_name.into();
        register_extension_inner(
            &mut self.extension_tags,
            &mut self.extension_closing_tag_names,
            &mut self.custom_extensions,
            extension_name,
            tag_specs,
            handler,
            is_reserved_tag_keyword,
        )
    }

    /// Returns whether a custom extension with this name is registered (Nunjucks `hasExtension`).
    pub fn has_extension(&self, name: &str) -> bool {
        self.custom_extensions.contains_key(name)
    }

    /// Returns metadata for a registered extension name without exposing the internal handler.
    pub fn get_extension_descriptor(&self, name: &str) -> Option<ExtensionDescriptor> {
        if !self.custom_extensions.contains_key(name) {
            return None;
        }
        let mut tags = Vec::new();
        let mut blocks = HashMap::new();
        for (tag, meta) in &self.extension_tags {
            if meta.extension_name == name {
                tags.push(tag.clone());
                if let Some(end) = &meta.end_tag {
                    blocks.insert(tag.clone(), end.clone());
                }
            }
        }
        tags.sort();
        Some(ExtensionDescriptor {
            name: name.to_string(),
            tags,
            blocks,
        })
    }

    /// Unregisters a custom extension by name (Nunjucks `removeExtension`). Returns `true` if it existed.
    pub fn remove_extension(&mut self, name: &str) -> bool {
        remove_extension_inner(
            &mut self.extension_tags,
            &mut self.extension_closing_tag_names,
            &mut self.custom_extensions,
            name,
        )
    }

    /// Lexes and parses `src` with this environment’s extension tags (for eager-compile validation).
    pub fn validate_lex_parse(&self, src: &str) -> Result<()> {
        let tokens = lexer::tokenize_with_options(src, self.lexer_options())?;
        let _ = parser::parse_with_env(
            &tokens,
            &self.extension_tags,
            &self.extension_closing_tag_names,
        )?;
        Ok(())
    }

    pub(crate) fn eval_user_is_test(
        &self,
        name: &str,
        value: &Value,
        args: &[Value],
    ) -> Result<bool> {
        match self.custom_tests.get(name) {
            Some(t) => t(value, args),
            None => Err(RunjucksError::new(format!("unknown test: `{name}`"))),
        }
    }

    /// Built-in and user-registered `is` tests (`x is name`, `select` / `reject`). Argument values are already evaluated.
    pub(crate) fn apply_is_test(
        &self,
        test_name: &str,
        value: &Value,
        arg_vals: &[Value],
    ) -> Result<bool> {
        match test_name {
            "equalto" | "eq" | "sameas" => Ok(match arg_vals.first() {
                Some(a) => equalto_sameas_pair(value, a, false),
                None => false,
            }),
            "null" | "none" => Ok(value.is_null()),
            "undefined" => Ok(is_undefined_value(value)),
            "escaped" => Ok(is_marked_safe(value)),
            "falsy" => Ok(!is_truthy_value(value)),
            "truthy" => Ok(is_truthy_value(value)),
            "number" => Ok(value.is_number()),
            "string" => Ok(value.is_string()),
            "lower" => Ok(match value {
                Value::String(s) => s.chars().all(|c| !c.is_uppercase()),
                _ => false,
            }),
            "upper" => Ok(match value {
                Value::String(s) => s.chars().all(|c| !c.is_lowercase()),
                _ => false,
            }),
            "callable" => Ok(value_is_callable(value)),
            "defined" => Ok(!is_undefined_value(value)),
            "odd" => {
                let n = as_is_test_integer(value)?;
                Ok(n.rem_euclid(2) != 0)
            }
            "even" => {
                let n = as_is_test_integer(value)?;
                Ok(n.rem_euclid(2) == 0)
            }
            "divisibleby" => {
                let denom = arg_vals
                    .first()
                    .and_then(|a| {
                        a.as_i64()
                            .or_else(|| a.as_f64().map(|x| x as i64))
                            .or_else(|| value_to_string(a).parse().ok())
                    })
                    .ok_or_else(|| RunjucksError::new("`divisibleby` test expects a divisor"))?;
                if denom == 0 {
                    return Ok(false);
                }
                let n = as_is_test_integer(value)?;
                Ok(n.rem_euclid(denom) == 0)
            }
            "greaterthan" | "gt" => Ok(is_test_gt(value, arg_vals)),
            "lessthan" | "lt" => Ok(is_test_lt(value, arg_vals)),
            "ge" => Ok(is_test_ge(value, arg_vals)),
            "le" => Ok(is_test_le(value, arg_vals)),
            "ne" => Ok(match arg_vals.first() {
                Some(a) => value != a,
                None => !is_undefined_value(value),
            }),
            "iterable" => Ok(is_test_iterable(value)),
            "mapping" => Ok(is_test_mapping(value)),
            _ => self.eval_user_is_test(test_name, value, arg_vals),
        }
    }

    /// Resolves a name: template context first (any frame), then [`Environment::globals`].
    ///
    /// Unbound names yield [`crate::value::undefined_value`] unless [`Environment::throw_on_undefined`] is set.
    ///
    /// Borrows context/globals when possible to avoid cloning on hot paths (see [`Self::resolve_variable`]).
    pub fn resolve_variable_ref<'a>(
        &'a self,
        stack: &'a renderer::CtxStack,
        name: &str,
    ) -> Result<Cow<'a, Value>> {
        if stack.defined(name) {
            Ok(Cow::Borrowed(stack.get_ref(name).expect(
                "internal error: variable marked defined but missing from stack",
            )))
        } else if let Some(v) = self.globals.get(name) {
            Ok(Cow::Borrowed(v))
        } else if self.throw_on_undefined {
            Err(RunjucksError::new(format!("undefined variable: `{name}`")))
        } else {
            Ok(Cow::Owned(undefined_value()))
        }
    }

    /// Unbound names yield [`crate::value::undefined_value`] unless [`Environment::throw_on_undefined`] is set.
    pub fn resolve_variable(&self, stack: &renderer::CtxStack, name: &str) -> Result<Value> {
        self.resolve_variable_ref(stack, name)
            .map(|c| c.into_owned())
    }

    /// Returns the [`LexerOptions`] derived from this environment's configuration.
    pub fn lexer_options(&self) -> LexerOptions {
        LexerOptions {
            trim_blocks: self.trim_blocks,
            lstrip_blocks: self.lstrip_blocks,
            tags: self.tags.clone(),
        }
    }

    /// Lexes `template`, parses it to an AST, and renders it with `context`.
    ///
    /// # Errors
    ///
    /// Returns [`crate::errors::RunjucksError`] when:
    ///
    /// - The [`crate::lexer`] finds malformed delimiters (e.g. unclosed `{{`).
    /// - The [`crate::parser`] hits unsupported tag syntax.
    /// - Rendering fails (currently rare; lookup errors use Nunjucks-style defaults).
    ///
    /// # Examples
    ///
    /// ```
    /// use runjucks_core::Environment;
    /// use serde_json::json;
    ///
    /// let env = Environment::default();
    /// let html = env
    ///     .render_string("{{ msg }}".into(), json!({ "msg": "<ok>" }))
    ///     .unwrap();
    /// assert_eq!(html, "&lt;ok&gt;");
    /// ```
    pub fn render_string(&self, template: String, context: Value) -> Result<String> {
        let ast = self.parse_or_cached_inline(&template)?;
        self.render_parsed(ast.as_ref(), context)
    }

    /// Renders a named template using the configured [`TemplateLoader`].
    ///
    /// Supports `{% extends %}`, `{% include %}`, `{% import %}`, `{% from %}`, and `{% macro %}` across files.
    pub fn render_template(&self, name: &str, context: Value) -> Result<String> {
        let loader = self
            .loader
            .as_ref()
            .ok_or_else(|| RunjucksError::new("no template loader configured"))?;
        let ast = self.load_and_parse_named(name, loader.as_ref())?;
        let root = match context {
            Value::Object(m) => m,
            _ => Map::new(),
        };
        let mut stack = renderer::CtxStack::from_root(root);
        let mut state = renderer::RenderState::new(Some(loader.as_ref()), self.random_seed);
        state.push_template(name)?;
        renderer::scan_literal_extends_graph(self, &mut state, ast.as_ref(), loader.as_ref())?;
        let out = renderer::render_entry(self, &mut state, ast.as_ref(), &mut stack)?;
        state.pop_template();
        Ok(out)
    }

    /// Registers an async filter. Called as `(input, args…) → Promise<Value>`.
    #[cfg(feature = "async")]
    pub fn add_async_filter(&mut self, name: String, filter: AsyncCustomFilter) -> &mut Self {
        self.async_custom_filters.insert(name, filter);
        self
    }

    /// Registers an async global function. Called as `(positional_args…, kwargs) → Promise<Value>`.
    #[cfg(feature = "async")]
    pub fn add_async_global_callable(&mut self, name: String, f: AsyncCustomGlobalFn) -> &mut Self {
        let mut m = serde_json::Map::new();
        m.insert(RJ_CALLABLE.to_string(), Value::Bool(true));
        self.globals.insert(name.clone(), Value::Object(m));
        self.async_custom_globals.insert(name, f);
        self
    }

    /// Async render of an inline template string. Returns a `Future` that produces the rendered output.
    #[cfg(feature = "async")]
    pub async fn render_string_async(&self, template: String, context: Value) -> Result<String> {
        let ast = self.parse_or_cached_inline(&template)?;
        crate::async_renderer::render_async(self, ast.as_ref(), context).await
    }

    /// Async render of a named template. Returns a `Future` that produces the rendered output.
    #[cfg(feature = "async")]
    pub async fn render_template_async(&self, name: &str, context: Value) -> Result<String> {
        let loader = self
            .loader
            .as_ref()
            .ok_or_else(|| RunjucksError::new("no template loader configured"))?;
        let ast = self.load_and_parse_named(name, loader.as_ref())?;
        let root = match context {
            Value::Object(m) => m,
            _ => serde_json::Map::new(),
        };
        let mut stack = renderer::CtxStack::from_root(root);
        let loader_ref = self.loader.as_ref().map(|l| l.as_ref());
        let mut state = renderer::RenderState::new(loader_ref, self.random_seed);
        state.push_template(name)?;
        renderer::scan_literal_extends_graph(self, &mut state, ast.as_ref(), loader.as_ref())?;
        let out = crate::async_renderer::entry::render_entry_async(
            self,
            &mut state,
            ast.as_ref(),
            &mut stack,
        )
        .await?;
        state.pop_template();
        Ok(out)
    }
}
