//! Registration-time validation of journey definitions (port of `concerns/dsl-validation`) and
//! the diagnostics shared with semantic analysis: DSL path formatting (`DSLPathFormatter`) and
//! the aggregate error text (`RegistrationErrorFormatter`).

pub mod schemas;
pub mod zod;

use crate::engine::errors::{ForgeError, ForgeResult};
use crate::value::Value;
use zod::Seg;

/// One entry of an aggregate registration error, with the fields `RegistrationErrorFormatter`
/// prints after the title.
#[derive(Clone, Debug, Default)]
pub struct Diagnostic {
    pub name: &'static str,
    pub message: String,
    pub path: Option<String>,
    pub expected: Option<String>,
    pub function: Option<String>,
    pub function_type: Option<String>,
    pub variant: Option<String>,
}

impl Diagnostic {
    pub fn new(name: &'static str, message: impl Into<String>) -> Self {
        Self { name, message: message.into(), ..Self::default() }
    }

    pub fn at(self, path: impl Into<String>) -> Self {
        Self { path: Some(path.into()), ..self }
    }
}

/// `RegistrationErrorFormatter.formatAggregate`: `Forge registration failed: <title>` and the
/// numbered entries.
pub fn aggregate(title: &str, entries: &[Diagnostic]) -> ForgeError {
    let mut lines = vec![format!("Forge registration failed: {title}"), String::new()];
    for (i, d) in entries.iter().enumerate() {
        lines.push(format!("{}. {}: {}", i + 1, d.name, d.message));
        let fields = [
            ("Path", &d.path),
            ("Expected", &d.expected),
            ("Function", &d.function),
            ("Type", &d.function_type),
            ("Variant", &d.variant),
        ];
        for (label, value) in fields {
            if let Some(v) = value.as_ref().filter(|v| !v.is_empty()) {
                lines.push(format!("   {label}: {v}"));
            }
        }
    }
    ForgeError::Registration { message: lines.join("\n"), title: title.to_string() }
}

// DSLPathFormatter ------------------------------------------------------------------------------

fn non_empty_str<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    value.as_object().and_then(|o| o.get(key)).and_then(Value::as_str).filter(|s| !s.trim().is_empty())
}

fn trim_path(path: &str) -> String {
    let trimmed = path.trim_matches('/');
    if trimmed.is_empty() { path.to_string() } else { trimmed.to_string() }
}

/// A journey or step's segment: its code, else its trimmed path, else its title.
fn structure_segment(value: &Value) -> Option<String> {
    non_empty_str(value, "code")
        .map(str::to_string)
        .or_else(|| non_empty_str(value, "path").map(trim_path))
        .or_else(|| non_empty_str(value, "title").map(str::to_string))
}

const FUNCTION_TYPES: &[&str] = &["FunctionType.Condition", "FunctionType.Transformer", "FunctionType.Generator", "FunctionType.Effect"];

fn function_context(value: &Value) -> Option<String> {
    let ty = non_empty_str(value, "type")?;
    let name = non_empty_str(value, "name")?;
    if !FUNCTION_TYPES.contains(&ty) {
        return None;
    }
    Some(format!("{} - {name}", ty.rsplit('.').next().unwrap_or(ty).to_lowercase()))
}

fn block_context(value: &Value) -> Option<String> {
    if value.get("type").as_str() != Some("StructureType.Block") {
        return None;
    }
    let variant = non_empty_str(value, "variant")?;
    let code = if value.get("blockType").as_str() == Some("BlockType.field") { non_empty_str(value, "code") } else { None };
    Some(match code {
        Some(c) => format!("{variant} - {c}"),
        None => variant.to_string(),
    })
}

/// `DSLPathFormatter.format`: `journey > step > blocks[0] (variant - code) > ...`.
pub fn format_path(root: &Value, path: &[Seg]) -> String {
    let mut segments = vec![structure_segment(root).unwrap_or_else(|| "root".into())];
    let mut current = root.clone();
    let mut i = 0;
    while i < path.len() {
        match &path[i] {
            Seg::Index(n) => {
                current = current.as_array().and_then(|a| a.get(*n).cloned()).unwrap_or(Value::Undefined);
                segments.push(format!("[{n}]"));
                i += 1;
            }
            Seg::Key(key) => {
                let value = if current.as_object().is_some() { current.get(key) } else { Value::Undefined };
                if let Some(Seg::Index(n)) = path.get(i + 1) {
                    let item = value.as_array().and_then(|a| a.get(*n).cloned()).unwrap_or(Value::Undefined);
                    let segment = match key.as_str() {
                        "steps" | "children" => structure_segment(&item).unwrap_or_else(|| format!("{key}[{n}]")),
                        _ => {
                            let context = if key == "blocks" { block_context(&item) } else { function_context(&item) };
                            match context {
                                Some(c) => format!("{key}[{n}] ({c})"),
                                None => format!("{key}[{n}]"),
                            }
                        }
                    };
                    segments.push(segment);
                    current = item;
                    i += 2;
                    continue;
                }
                let ty = current.get("type");
                let ty = ty.as_str();
                if key == "condition" && ty == Some("PredicateType.Test") && function_context(&value).is_some() {
                    // The condition function names itself through the predicate's segment.
                } else if ty == Some("ExpressionType.Iterate") && key == "input" {
                    segments.push("source".into());
                } else if ty == Some("ExpressionType.Iterate") && key == "iterator" {
                    segments.push("source".into());
                    segments.push("iterator".into());
                } else if ty == Some("IteratorType.Map") && key == "yield" {
                    segments.push("template".into());
                } else {
                    segments.push(key.clone());
                }
                current = value;
                i += 1;
            }
        }
    }
    segments.join(" > ")
}

// DSLValidator ----------------------------------------------------------------------------------

/// `checkSerializableTypes`: values a JSON round trip would lose.
fn serialisation_issues(value: &Value, path: &mut Vec<Seg>, out: &mut Vec<(String, Vec<Seg>)>) {
    match value {
        Value::Undefined => out.push(("Undefined value".into(), path.clone())),
        Value::Opaque(o) => {
            let kind = if o.as_any().is::<crate::jsdate::JsDate>() { "Date object".to_string() } else { "Non-plain object (unknown)".to_string() };
            out.push((kind, path.clone()));
        }
        Value::Array(items) => {
            for (i, item) in items.iter().enumerate() {
                path.push(Seg::Index(i));
                serialisation_issues(item, path, out);
                path.pop();
            }
        }
        Value::Object(o) => {
            for (k, v) in o.iter() {
                path.push(Seg::Key(k.to_string()));
                serialisation_issues(v, path, out);
                path.pop();
            }
        }
        _ => {}
    }
}

/// `DSLValidator.validateJSON` then `validateSchema`.
pub fn validate(journey: &Value) -> ForgeResult<()> {
    if journey.is_undefined() {
        return Err(aggregate(
            "JSON validation failed due to non-serializable types",
            &[Diagnostic::new("ForgeSerialisationError", "Input is undefined (not valid JSON)").at("root")],
        ));
    }
    let mut found = Vec::new();
    serialisation_issues(journey, &mut Vec::new(), &mut found);
    if !found.is_empty() {
        let entries: Vec<Diagnostic> = found
            .into_iter()
            .map(|(kind, path)| {
                let formatted = format_path(journey, &path);
                Diagnostic::new("ForgeSerialisationError", format!("{kind} at {formatted} (not JSON serializable)")).at(formatted)
            })
            .collect();
        return Err(aggregate("JSON validation failed due to non-serializable types", &entries));
    }
    let issues = schemas::JOURNEY.issues(journey);
    if !issues.is_empty() {
        let entries: Vec<Diagnostic> = issues
            .into_iter()
            .map(|issue| Diagnostic {
                expected: issue.expected.clone(),
                ..Diagnostic::new("ForgeSchemaError", issue.message.clone()).at(format_path(journey, &issue.path))
            })
            .collect();
        return Err(aggregate("Schema validation failed", &entries));
    }
    Ok(())
}
