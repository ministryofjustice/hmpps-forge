#![deny(clippy::all)]
//! Pure Rust template engine core for **Runjucks**, a [Nunjucks](https://mozilla.github.io/nunjucks/)-oriented engine.
//!
//! This crate is the **lex → parse → render** pipeline with no Node or NAPI dependencies. The published
//! [`runjucks` npm package](https://www.npmjs.com/package/runjucks) wraps it in a thin native addon; most
//! JavaScript callers use that API instead of linking this crate directly.
//!
//! Pipeline:
//! 1. [`lexer::tokenize`] splits template source into [`lexer::Token`]s.
//! 2. For each [`lexer::Token::Tag`], [`tag_lex::tokenize_tag_body`] can split the inner string into keywords and identifiers.
//! 3. [`parser::parse`] builds an [`ast::Node`] tree; [`parser::parse_expr`] parses `{{ }}` bodies with Nunjucks-style precedence (see [`parser::expr`]).
//! 4. [`renderer::render`] walks the AST with an [`Environment`], optional [`loader::TemplateLoader`], and a [`renderer::CtxStack`] built from the JSON context (`{% include %}`, `{% extends %}` / `{% block %}`, `for`/`set` frames, macros).
//!
//! # Example
//!
//! ```
//! use runjucks_core::Environment;
//! use serde_json::json;
//!
//! let env = Environment::default();
//! let out = env
//!     .render_string("Hello, {{ name }}".into(), json!({ "name": "Ada" }))
//!     .unwrap();
//! assert_eq!(out, "Hello, Ada");
//! ```

pub mod ast;
pub mod environment;
pub mod errors;
pub mod extension;
pub mod filters;
pub mod globals;
mod js_regex;
pub mod js_methods;
pub mod lexer;
pub mod loader;
pub mod parser;
pub mod render_common;
pub mod renderer;
#[cfg(feature = "async")]
pub mod async_renderer;
pub mod tag_lex;
pub mod value;

pub use environment::{CustomFilter, CustomGlobalFn, CustomTest, Environment};
pub use errors::RunjucksError;
pub use extension::{CustomExtensionHandler, ExtensionTagMeta};
pub use lexer::{LexerOptions, Tags};
pub use loader::{file_system_loader, map_loader, FileSystemLoader, FnLoader, TemplateLoader};
#[cfg(feature = "async")]
pub use environment::{AsyncCustomFilter, AsyncCustomGlobalFn};

