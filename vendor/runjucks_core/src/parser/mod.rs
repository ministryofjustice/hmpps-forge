//! Builds [`crate::ast::Node`] trees from [`crate::lexer::Token`] streams.
//!
//! `{{ … }}` bodies are parsed with [`parse_expr`] (nom-driven, Nunjucks-style precedence; see [`expr`]).
//! `{% … %}` supports `if` / `elif` / `else` / `endif`, `switch` / `case` / `default` / `endswitch`, `for` / `else` / `endfor` (multi-var / tuple unpack), `set` (incl. `endset` capture), `include` (expression + `ignore missing` + `with`/`without context`), `import` / `from` (macro libraries), `extends` (expression), `block` / `endblock`, `macro` / `endmacro` (defaults + call kwargs), `filter` / `endfilter`, `call` / `endcall`, and `raw` / `endraw` / `verbatim` / `endverbatim` (see [`template`]).
//! For unimplemented tags, use [`crate::tag_lex::tokenize_tag_body`] for tokenization only.

pub mod expr;
mod split;
mod template;

use crate::ast::{Expr, Node};
use crate::errors::Result;
use crate::extension::ExtensionTagMeta;
use crate::lexer::Token;
use std::collections::{HashMap, HashSet};

/// Parses a token stream into a single [`Node::Root`] containing child nodes.
///
/// # Errors
///
/// Returns an error on malformed `{% %}` blocks, unknown tag keywords, or invalid expressions.
///
/// # Examples
///
/// ```
/// use runjucks_core::lexer::tokenize;
/// use runjucks_core::parser::parse;
///
/// let tokens = tokenize("a{{x}}b").unwrap();
/// let root = parse(&tokens).unwrap();
/// ```
pub fn parse(tokens: &[Token]) -> Result<Node> {
    template::parse_template_tokens(tokens, &HashMap::new(), &HashSet::new())
}

/// Parse with custom extension tags registered on the [`crate::Environment`].
pub fn parse_with_env(
    tokens: &[Token],
    extension_tags: &HashMap<String, ExtensionTagMeta>,
    extension_closing: &HashSet<String>,
) -> Result<Node> {
    template::parse_template_tokens(tokens, extension_tags, extension_closing)
}

pub(crate) use template::is_reserved_tag_keyword;

/// Parses the inside of a `{{` … `}}` region into an [`Expr`].
///
/// # Errors
///
/// Invalid syntax or trailing garbage (after trim) yields [`RunjucksError`].
///
/// # Examples
///
/// ```
/// use runjucks_core::parser::parse_expr;
/// use runjucks_core::ast::Expr;
///
/// match parse_expr("foo").unwrap() {
///     Expr::Variable(name) => assert_eq!(name, "foo"),
///     _ => panic!("expected variable"),
/// }
/// ```
pub fn parse_expr(source: &str) -> Result<Expr> {
    expr::parse_expression(source)
}
