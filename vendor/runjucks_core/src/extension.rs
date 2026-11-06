//! Custom tag extensions (Nunjucks-style [`Environment::register_extension`] / JS `addExtension`).

use crate::errors::{Result, RunjucksError};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

/// Metadata for a registered extension opening tag (`{% tagname … %}`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExtensionTagMeta {
    /// Key passed to [`Environment::register_extension`](crate::environment::Environment::register_extension).
    pub extension_name: String,
    /// Closing tag for block extensions (e.g. `Some("endwrap")` for `{% wrap %}…{% endwrap %}`).
    pub end_tag: Option<String>,
}

/// Sync callback: merged JSON context, raw args string after the tag name, optional rendered body.
pub type CustomExtensionHandler =
    Arc<dyn Fn(&Value, &str, Option<String>) -> Result<String> + Send + Sync>;

/// Rebuilds the set of closing-only tag names (for orphan detection).
pub(crate) fn rebuild_extension_closing_tags(
    extension_tags: &HashMap<String, ExtensionTagMeta>,
    out: &mut HashSet<String>,
) {
    out.clear();
    for m in extension_tags.values() {
        if let Some(e) = &m.end_tag {
            out.insert(e.clone());
        }
    }
}

/// Validates and applies a full extension registration (replaces any prior tags for this extension name).
pub(crate) fn register_extension_inner(
    extension_tags: &mut HashMap<String, ExtensionTagMeta>,
    extension_closing: &mut HashSet<String>,
    custom_extensions: &mut HashMap<String, CustomExtensionHandler>,
    extension_name: String,
    tag_specs: Vec<(String, Option<String>)>,
    handler: CustomExtensionHandler,
    is_reserved: impl Fn(&str) -> bool,
) -> Result<()> {
    if tag_specs.is_empty() {
        return Err(RunjucksError::new(
            "extension must declare at least one tag in `tags`",
        ));
    }
    let mut seen_tags = HashSet::new();
    for (tag, _) in &tag_specs {
        if !seen_tags.insert(tag.clone()) {
            return Err(RunjucksError::new(format!(
                "duplicate extension tag `{tag}` in registration"
            )));
        }
    }
    for (tag, end) in &tag_specs {
        if is_reserved(tag) {
            return Err(RunjucksError::new(format!(
                "extension tag `{tag}` conflicts with a built-in tag"
            )));
        }
        if let Some(e) = end {
            if is_reserved(e) {
                return Err(RunjucksError::new(format!(
                    "extension end tag `{e}` conflicts with a built-in tag"
                )));
            }
        }
    }
    for (tag, _) in &tag_specs {
        if let Some(existing) = extension_tags.get(tag) {
            if existing.extension_name != extension_name {
                return Err(RunjucksError::new(format!(
                    "extension tag `{tag}` is already registered by extension `{}`",
                    existing.extension_name
                )));
            }
        }
    }
    extension_tags.retain(|_, v| v.extension_name != extension_name);
    custom_extensions.remove(&extension_name);
    for (tag, end) in tag_specs {
        extension_tags.insert(
            tag,
            ExtensionTagMeta {
                extension_name: extension_name.clone(),
                end_tag: end,
            },
        );
    }
    custom_extensions.insert(extension_name, handler);
    rebuild_extension_closing_tags(extension_tags, extension_closing);
    Ok(())
}

/// Removes a registered extension by name. Returns `true` if an extension handler was removed.
pub fn remove_extension_inner(
    extension_tags: &mut HashMap<String, ExtensionTagMeta>,
    extension_closing: &mut HashSet<String>,
    custom_extensions: &mut HashMap<String, CustomExtensionHandler>,
    extension_name: &str,
) -> bool {
    let removed = custom_extensions.remove(extension_name).is_some();
    extension_tags.retain(|_, v| v.extension_name != extension_name);
    rebuild_extension_closing_tags(extension_tags, extension_closing);
    removed
}
