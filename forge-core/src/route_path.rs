//! Route path helpers (port of `shared/routePath.ts`).

use std::sync::LazyLock;

use regex::Regex;

use crate::value::Value;

/// `normalizeBasePath`: leading slash, no trailing slash, `""` for none.
pub fn normalize_base_path(base_path: Option<&str>) -> String {
    let Some(base) = base_path.filter(|b| !b.is_empty()) else { return String::new() };
    let mut normalized = if base.starts_with('/') { base.to_string() } else { format!("/{base}") };
    if normalized.ends_with('/') {
        normalized.pop();
    }
    normalized
}

/// `normalizeRelativePath`: drops one leading slash and any query or fragment.
pub fn normalize_relative_path(path: &str) -> String {
    let path = path.strip_prefix('/').unwrap_or(path);
    path.split(['?', '#']).next().unwrap_or(path).to_string()
}

static PARAM: LazyLock<Regex> = LazyLock::new(|| Regex::new(r":([a-zA-Z_][a-zA-Z0-9_]*)").unwrap());

/// `resolvePathParams`: substitutes `:name` segments from `params`, leaving unknown ones.
pub fn resolve_path_params(path: &str, params: &Value) -> String {
    PARAM
        .replace_all(path, |c: &regex::Captures| match params.get(&c[1]) {
            Value::Undefined | Value::Null => c[0].to_string(),
            v => v.to_js_string(),
        })
        .into_owned()
}

/// `joinPaths`: joins segments, collapsing slashes, always rooted.
pub fn join_paths(segments: &[&str]) -> String {
    let joined = segments.join("/");
    format!("/{}", joined.split('/').filter(|s| !s.is_empty()).collect::<Vec<_>>().join("/"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::val;

    #[test]
    fn helpers() {
        assert_eq!(normalize_base_path(Some("forms/")), "/forms");
        assert_eq!(normalize_relative_path("/step?x=1"), "step");
        assert_eq!(resolve_path_params("/a/:id/:other", &val!({"id": "7"})), "/a/7/:other");
        assert_eq!(join_paths(&["/a/", "", "b//c"]), "/a/b/c");
    }
}
