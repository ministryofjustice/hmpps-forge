//! Resolving template names to source strings for [`crate::Environment::render_template`].

use crate::errors::{Result, RunjucksError};
use std::borrow::Cow;
use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::sync::Arc;

/// Loads template source by name (e.g. `"layout.html"`).
///
/// Implement for in-memory maps, filesystem reads, or embedders that fetch from a CDN.
pub trait TemplateLoader: Send + Sync {
    fn load(&self, name: &str) -> Result<String>;

    /// Borrow-friendly variant of [`Self::cache_key`].
    ///
    /// Default behavior delegates to `cache_key` and returns an owned key. Implementors with
    /// stable name-based keys can return `Cow::Borrowed(name)` to avoid per-render allocations on
    /// cache hits.
    fn cache_key_cow<'a>(&self, name: &'a str) -> Option<Cow<'a, str>> {
        self.cache_key(name).map(Cow::Owned)
    }

    /// When `Some`, parsed templates for this name may be cached in [`crate::Environment`].
    /// Return `None` for loaders whose sources are not stable by name (e.g. dynamic closures).
    fn cache_key(&self, name: &str) -> Option<String> {
        let _ = name;
        None
    }

    /// Whether sources are immutable for keys returned by [`Self::cache_key`] while this loader
    /// instance is alive. When true, [`crate::Environment`] may reuse parsed ASTs for named
    /// templates without reloading source on every render.
    fn cache_keys_are_stable(&self) -> bool {
        false
    }
}

impl TemplateLoader for HashMap<String, String> {
    fn load(&self, name: &str) -> Result<String> {
        self.get(name)
            .cloned()
            .ok_or_else(|| RunjucksError::new(format!("template not found: {name}")))
    }

    fn cache_key(&self, name: &str) -> Option<String> {
        let _ = self;
        Some(name.to_string())
    }

    fn cache_key_cow<'a>(&self, name: &'a str) -> Option<Cow<'a, str>> {
        let _ = self;
        Some(Cow::Borrowed(name))
    }

    fn cache_keys_are_stable(&self) -> bool {
        true
    }
}

/// Wraps a closure as a [`TemplateLoader`].
pub struct FnLoader<F>(pub F);

impl<F> TemplateLoader for FnLoader<F>
where
    F: Fn(&str) -> Result<String> + Send + Sync,
{
    fn load(&self, name: &str) -> Result<String> {
        (self.0)(name)
    }
}

/// Helper to build an `Arc<dyn TemplateLoader>` from a map.
pub fn map_loader(map: HashMap<String, String>) -> Arc<dyn TemplateLoader + Send + Sync> {
    Arc::new(map)
}

/// Loads template files from a directory. Names are **relative** paths under `root` (POSIX-style
/// separators work on all platforms). `..`, absolute paths, and Windows path prefixes in `name` are
/// rejected. Resolved paths are canonicalized so symbolic links cannot escape `root`.
#[derive(Debug)]
pub struct FileSystemLoader {
    root: PathBuf,
}

impl FileSystemLoader {
    /// Creates a loader rooted at `root` (must exist; canonicalized for containment checks).
    pub fn new(root: impl AsRef<Path>) -> Result<Self> {
        let root = root.as_ref().canonicalize().map_err(|e| {
            RunjucksError::new(format!(
                "filesystem loader: cannot access root {}: {e}",
                root.as_ref().display()
            ))
        })?;
        Ok(Self { root })
    }

    fn resolve_safe(&self, name: &str) -> Result<PathBuf> {
        let path = Path::new(name);
        if path.is_absolute() {
            return Err(RunjucksError::new(format!(
                "template name must be relative, got {name:?}"
            )));
        }
        let mut out = self.root.clone();
        for c in path.components() {
            match c {
                Component::Normal(s) => out.push(s),
                Component::CurDir => {}
                Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                    return Err(RunjucksError::new(format!(
                        "invalid template path (no parent segments): {name:?}"
                    )));
                }
            }
        }
        let canon = out
            .canonicalize()
            .map_err(|_| RunjucksError::new(format!("template not found: {name}")))?;
        if !canon.starts_with(&self.root) {
            return Err(RunjucksError::new(format!(
                "template path escapes loader root: {name}"
            )));
        }
        Ok(canon)
    }
}

impl TemplateLoader for FileSystemLoader {
    fn load(&self, name: &str) -> Result<String> {
        let path = self.resolve_safe(name)?;
        std::fs::read_to_string(&path).map_err(|e| {
            RunjucksError::new(format!("failed to read template {}: {e}", path.display()))
        })
    }

    fn cache_key(&self, name: &str) -> Option<String> {
        self.resolve_safe(name)
            .ok()
            .map(|p| p.to_string_lossy().into_owned())
    }
}

/// Builds an `Arc` dyn loader for [`crate::Environment::loader`] from a filesystem root.
pub fn file_system_loader(root: impl AsRef<Path>) -> Result<Arc<dyn TemplateLoader + Send + Sync>> {
    Ok(Arc::new(FileSystemLoader::new(root)?))
}
