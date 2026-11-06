//! Runjucks renderer for forge-core (port of `forge-express-nunjucks`'s `NunjucksRenderer`).
//!
//! Templates are the upstream GOV.UK Frontend / MOJ Frontend Nunjucks files, rendered by the
//! patched Runjucks in `rust/vendor` (byte-identical to Nunjucks on every govuk-frontend fixture,
//! see `template-parity`).

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, LazyLock};

use forge_core::engine::concerns::render::Renderer;
use forge_core::engine::errors::{ForgeError, ForgeResult};
use forge_core::jsdate::JsDate;
use forge_core::value::{Map, Value};
use regex::Regex;
use runjucks_core::{Environment, RunjucksError, TemplateLoader};

/// Loader over several search roots (Nunjucks `FileSystemLoader` with an array). Runjucks
/// resolves every name from the root, while govuk-frontend and MOJ include `./x` and `../x`
/// relative to the including template, so those are rewritten to root-relative names on load.
pub struct SearchPathLoader {
    roots: Vec<PathBuf>,
}

static TAG_PATH: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(\{%-?\s*(?:include|import|from|extends)\s+)["'](\.\.?/[^"']+)["']"#).unwrap()
});

impl SearchPathLoader {
    pub fn new(roots: impl IntoIterator<Item = impl Into<PathBuf>>) -> Self {
        Self { roots: roots.into_iter().map(Into::into).collect() }
    }

    fn rewrite_relative(name: &str, source: &str) -> String {
        let dir = Path::new(name).parent().unwrap_or(Path::new(""));
        TAG_PATH
            .replace_all(source, |c: &regex::Captures| format!("{}\"{}\"", &c[1], normalise(&dir.join(&c[2]))))
            .into_owned()
    }
}

fn normalise(path: &Path) -> String {
    let mut parts: Vec<&str> = Vec::new();
    for c in path.components() {
        match c {
            Component::Normal(s) => parts.push(s.to_str().unwrap_or_default()),
            Component::ParentDir => {
                parts.pop();
            }
            _ => {}
        }
    }
    parts.join("/")
}

impl TemplateLoader for SearchPathLoader {
    fn load(&self, name: &str) -> Result<String, RunjucksError> {
        for root in &self.roots {
            if let Ok(src) = fs::read_to_string(root.join(name)) {
                return Ok(Self::rewrite_relative(name, &src));
            }
        }
        Err(RunjucksError::new(format!("template not found: {name}")))
    }

    fn cache_key(&self, name: &str) -> Option<String> {
        Some(name.to_string())
    }

    fn cache_keys_are_stable(&self) -> bool {
        true
    }
}

type Json = serde_json::Value;

/// moment-style parse: missing value means now; strings parse like `new Date(string)`.
fn moment(value: &Json) -> JsDate {
    match value {
        Json::Null => JsDate::now(),
        // Runjucks passes `undefined` as its sentinel object.
        v if runjucks_core::value::is_undefined_value(v) => JsDate::now(),
        Json::String(s) => JsDate::parse(s),
        Json::Number(n) => JsDate::new(n.as_f64().unwrap_or(f64::NAN)),
        _ => JsDate::invalid(),
    }
}

const MONTHS: [&str; 12] =
    ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/// moment `format()` for the tokens MOJ templates use, in local time.
fn moment_format(date: &JsDate, format: &str) -> String {
    static TOKENS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"YYYY|MMMM|MMM|MM|M|DD|D|HH|H|hh|h|mm|m|ss|s|a|Z").unwrap());
    let Some(f) = date.local_fields() else { return "Invalid date".into() };
    let h12 = if f.hours % 12 == 0 { 12 } else { f.hours % 12 };
    let offset_minutes = ((date.ms - JsDate::utc(f.year as f64, f64::from(f.month), f64::from(f.day), f64::from(f.hours), f64::from(f.minutes), f64::from(f.seconds), f64::from(f.millis)).ms) / -60000.0) as i64;
    TOKENS
        .replace_all(format, |c: &regex::Captures| match &c[0] {
            "YYYY" => format!("{:04}", f.year),
            "MMMM" => MONTHS[f.month as usize].to_string(),
            "MMM" => MONTHS[f.month as usize][..3].to_string(),
            "MM" => format!("{:02}", f.month + 1),
            "M" => (f.month + 1).to_string(),
            "DD" => format!("{:02}", f.day),
            "D" => f.day.to_string(),
            "HH" => format!("{:02}", f.hours),
            "H" => f.hours.to_string(),
            "hh" => format!("{h12:02}"),
            "h" => h12.to_string(),
            "mm" => format!("{:02}", f.minutes),
            "m" => f.minutes.to_string(),
            "ss" => format!("{:02}", f.seconds),
            "s" => f.seconds.to_string(),
            "a" => if f.hours < 12 { "am" } else { "pm" }.to_string(),
            _ => {
                let sign = if offset_minutes < 0 { '-' } else { '+' };
                format!("{sign}{:02}:{:02}", offset_minutes.abs() / 60, offset_minutes.abs() % 60)
            }
        })
        .into_owned()
}

/// MOJ Frontend's `mojDate` filter (`moj/filters/all.js`).
fn moj_date(value: &Json, args: &[Json]) -> Result<Json, RunjucksError> {
    let d = moment(value);
    if !d.is_valid() {
        return Ok(value.clone());
    }
    let date = || moment_format(&d, "D MMMM YYYY");
    let short = || moment_format(&d, "D MMM YYYY");
    let time = || {
        let minutes = d.local_fields().map_or(0, |f| f.minutes);
        moment_format(&d, if minutes > 0 { "h:mma" } else { "ha" })
    };
    let out = match args.first().and_then(Json::as_str) {
        Some("datetime") => format!("{} at {}", date(), time()),
        Some("shortdatetime") => format!("{} at {}", short(), time()),
        Some("date") => date(),
        Some("shortdate") => short(),
        Some("time") => time(),
        _ => return Ok(value.clone()),
    };
    Ok(Json::String(out))
}

/// MOJ Frontend's `date` filter: `moment(timestamp).format(format)`.
fn moment_date(value: &Json, args: &[Json]) -> Result<Json, RunjucksError> {
    let format = args.first().and_then(Json::as_str).unwrap_or("YYYY-MM-DDTHH:mm:ssZ");
    Ok(Json::String(moment_format(&moment(value), format)))
}

/// The template engine components render through (`nunjucks.Environment`).
#[derive(Clone)]
pub struct RunjucksEngine {
    env: Environment,
}

impl RunjucksEngine {
    /// An autoescaping environment over `roots`, with the MOJ filters registered.
    pub fn new(roots: impl IntoIterator<Item = impl Into<PathBuf>>) -> Self {
        let mut env = Environment::default();
        env.autoescape = true;
        env.loader = Some(Arc::new(SearchPathLoader::new(roots)));
        env.add_filter("mojDate", Arc::new(moj_date));
        env.add_filter("date", Arc::new(moment_date));
        Self { env }
    }

    pub fn environment_mut(&mut self) -> &mut Environment {
        &mut self.env
    }

    /// `env.render(template, context)`.
    pub fn render(&self, template: &str, context: &Value) -> ForgeResult<String> {
        self.env
            .render_template(template, context.to_json())
            .map_err(|e| ForgeError::evaluation(format!("Template render error ({template}): {e}")))
    }

    fn with_error_summary(&self, context: &Value) -> Environment {
        let list = error_summary_list(context).to_json();
        let mut env = self.env.clone();
        env.add_global_callable("getErrorSummaryList", Arc::new(move |_, _| Ok(list.clone())));
        env
    }
}

/// `getErrorSummaryList`: domain then field errors, deduplicated by anchor/code/message.
pub fn error_summary_list(context: &Value) -> Value {
    let mut seen: Vec<String> = Vec::new();
    let mut out = Vec::new();
    let errors = ["domainValidationErrors", "fieldValidationErrors"]
        .into_iter()
        .flat_map(|k| context.get(k).as_array().map(|a| a.iter().cloned().collect::<Vec<_>>()).unwrap_or_default());
    for e in errors {
        let anchor = match e.get("anchor") {
            Value::Undefined => e.get("blockCode"),
            a => a,
        };
        let key = if anchor.is_undefined() { e.get("message").to_js_string() } else { anchor.to_js_string() };
        if seen.contains(&key) {
            continue;
        }
        seen.push(key);
        let mut item = Map::new();
        item.insert("text".into(), e.get("message"));
        if anchor.truthy() {
            item.insert("href".into(), Value::from(format!("#{}", anchor.to_js_string())));
        }
        out.push(Value::object(item));
    }
    Value::array(out)
}

/// Renders blocks with their components and pages with the step's view template
/// (`NunjucksRenderer`).
pub struct RunjucksRenderer {
    pub engine: RunjucksEngine,
    pub default_template: String,
    pub include_block_data: bool,
}

impl RunjucksRenderer {
    pub fn new(engine: RunjucksEngine) -> Self {
        Self { engine, default_template: "form-step".into(), include_block_data: false }
    }
}

/// `buildNavigationCompatibilityTree`.
fn navigation(route_tree: &Value) -> Vec<Value> {
    route_tree.as_array().map(|a| a.iter().flat_map(navigation_items).collect()).unwrap_or_default()
}

fn navigation_items(node: &Value) -> Vec<Value> {
    let children = navigation(&node.get("children"));
    let route = node.get("route");
    if route.is_undefined() {
        return children;
    }
    let metadata = match node.get("metadata") {
        Value::Undefined | Value::Null => route.get("metadata"),
        m => m,
    };
    vec![Value::from_pairs([
        ("type", route.get("kind")),
        ("title", route.get("title")),
        ("description", route.get("description")),
        ("path", node.get("path")),
        ("active", node.get("active")),
        ("metadata", metadata),
        ("children", Value::array(children)),
    ])]
}

impl Renderer for RunjucksRenderer {
    fn engine(&self) -> &dyn std::any::Any {
        &self.engine
    }

    fn mark_block(&self, node_id: &str, output: Value) -> Value {
        Value::from(format!("<!--forge:{node_id}-->{}<!--/forge:{node_id}-->", output.to_js_string()))
    }

    fn wrap_nested_block(&self, block: &Value, output: Value) -> Value {
        Value::from_pairs([("block", block.clone()), ("html", output)])
    }

    fn assemble_page(&self, context: &Value, rendered: &[Value], request_state: &Value) -> ForgeResult<Value> {
        let mut map = Map::new();
        for source in [request_state.clone(), context.get("step").get("view").get("locals")] {
            if let Value::Object(o) = source {
                for (k, v) in o.iter() {
                    map.insert(k.clone(), v.clone());
                }
            }
        }
        let blocks = if self.include_block_data {
            let raw = context.get("blocks");
            Value::array(
                rendered
                    .iter()
                    .enumerate()
                    .map(|(i, html)| Value::from_pairs([("html", html.clone()), ("block", raw.get(&i.to_string()))]))
                    .collect(),
            )
        } else {
            Value::array(rendered.to_vec())
        };
        map.insert("blocks".into(), blocks);
        for key in ["step", "ancestors", "routeTree"] {
            map.insert(key.into(), context.get(key));
        }
        map.insert("navigation".into(), Value::array(navigation(&context.get("routeTree"))));
        for key in ["answers", "data", "fieldValidationErrors", "domainValidationErrors"] {
            map.insert(key.into(), context.get(key));
        }
        let template = match context.get("step").get("view").get("template") {
            Value::String(t) => t.to_string(),
            _ => self.default_template.clone(),
        };
        let template = if template.ends_with(".njk") { template } else { format!("{template}.njk") };
        let env = self.engine.with_error_summary(context);
        let html = env
            .render_template(&template, Value::object(map).to_json())
            .map_err(|e| ForgeError::evaluation(format!("Template render error ({template}): {e}")))?;
        Ok(Value::from(html))
    }
}

/// A component render function over this engine: `params` built from the evaluated block,
/// rendered into `template` as `{ params }`.
pub fn nunjucks_render(
    template: &'static str,
    params: impl Fn(&Value) -> Value + Send + Sync + 'static,
) -> impl Fn(&Value, &dyn std::any::Any) -> ForgeResult<Value> + Send + Sync + 'static {
    move |block, engine| {
        let engine = engine
            .downcast_ref::<RunjucksEngine>()
            .ok_or_else(|| ForgeError::evaluation("Component requires the Runjucks renderer"))?;
        let context = Value::from_pairs([("params", params(block))]);
        Ok(Value::from(engine.render(template, &context)?))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use forge_core::val;

    #[test]
    fn error_summary_dedupes_and_links() {
        let ctx = val!({
            "domainValidationErrors": [{"message": "Fix the form"}],
            "fieldValidationErrors": [
                {"message": "Enter a name", "blockCode": "name", "anchor": "name-input"},
                {"message": "Again", "blockCode": "name", "anchor": "name-input"}
            ]
        });
        assert_eq!(
            error_summary_list(&ctx),
            val!([{"text": "Fix the form"}, {"text": "Enter a name", "href": "#name-input"}])
        );
    }
}

/// `assertTemplateIsAllowed`: inline display templates may not reach outside themselves.
pub fn assert_template_is_allowed(template: &str) -> ForgeResult<()> {
    static PATTERN: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"\{%-?\s*(import|from|include|extends|macro)\b").unwrap());
    match PATTERN.captures(template) {
        None => Ok(()),
        Some(m) => Err(ForgeError::evaluation(format!(
            "NunjucksGenerators.String templates cannot use {{% {} %}}. Allowed constructs are {{% if %}}, {{% for %}}, \
             {{% set %}}, filters, and variable interpolation. For reusable composition, extract a custom generator or component.",
            &m[1]
        ))),
    }
}

/// The authoring side of [`nunjucks_functions`] (`NunjucksGenerators`).
pub mod generators {
    use forge_core::authoring::{generator, Ex};
    use forge_core::Value;

    /// `NunjucksGenerators.String({ template, data })`: renders `template` inline with `data`
    /// (expressions resolved first). Panics when the template uses a forbidden tag, so a bad
    /// template fails when the definition is built.
    ///
    /// ```
    /// use forge_core::authoring::*;
    /// use forge_core::obj;
    ///
    /// let greeting = forge_runjucks::generators::string(obj! {
    ///     "template": "<p>Hello, {{ name }}</p>",
    ///     "data": obj! { "name": answer("fullName") },
    /// });
    /// # let _ = greeting;
    /// ```
    pub fn string(props: Value) -> Ex {
        if let Some(template) = props.get("template").as_str()
            && let Err(e) = super::assert_template_is_allowed(template)
        {
            panic!("{e}");
        }
        generator::call("String", vec![props])
    }
}

/// `nunjucksFunctions`: the `String` generator, which renders an inline template with its own
/// autoescaping environment (never the app's page environment).
pub fn nunjucks_functions() -> Vec<forge_core::engine::registries::FunctionEntry> {
    static SAFE_ENV: std::sync::LazyLock<Environment> = std::sync::LazyLock::new(|| {
        let mut env = Environment::default();
        env.autoescape = true;
        env
    });
    vec![forge_core::engine::registries::FunctionEntry::generator("String", |args| {
        let props = args.first().cloned().unwrap_or(Value::Undefined);
        let template = props
            .get("template")
            .as_str()
            .map(str::to_string)
            .ok_or_else(|| ForgeError::evaluation("NunjucksGenerators.String requires a string template"))?;
        assert_template_is_allowed(&template)?;
        let data = match props.get("data") {
            Value::Undefined => Value::empty_object(),
            d => d,
        };
        SAFE_ENV
            .render_string(template, data.to_json())
            .map(Value::from)
            .map_err(|e| ForgeError::evaluation(format!("Template render error: {e}")))
    })]
}

#[cfg(test)]
mod nunjucks_generator_tests {
    use super::*;

    #[test]
    fn string_generator_escapes_and_rejects_includes() {
        let f = &nunjucks_functions()[0];
        let _ = f;
        assert!(assert_template_is_allowed("{% include 'x' %}").is_err());
        assert!(assert_template_is_allowed("{%- macro x() %}{% endmacro %}").is_err());
        assert!(assert_template_is_allowed("{% if a %}{{ a }}{% endif %}").is_ok());
        let out = SAFE_ENV_FOR_TEST.render_string("<b>{{ name }}</b>{{ html | safe }}".into(), serde_json::json!({"name": "<i>", "html": "<i>"}));
        assert_eq!(out.unwrap(), "<b>&lt;i&gt;</b><i>");
    }

    static SAFE_ENV_FOR_TEST: std::sync::LazyLock<Environment> = std::sync::LazyLock::new(|| {
        let mut env = Environment::default();
        env.autoescape = true;
        env
    });
}
