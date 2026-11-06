//! Async tree-walk renderer, parallel to [`crate::renderer`].
//!
//! All render/eval functions are `async fn`. The async renderer reuses
//! [`crate::renderer::CtxStack`] and [`crate::renderer::RenderState`] (owned, on the same thread).
//! Shared pure-computation helpers come from [`crate::render_common`].

pub mod entry;
mod eval;
mod loops;
mod macros;
mod nodes;

pub use entry::render_async;
