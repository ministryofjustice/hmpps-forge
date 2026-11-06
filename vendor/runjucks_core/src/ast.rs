//! Abstract syntax tree for templates after [`crate::parser::parse`].
//!
//! [`Expr`] covers outputs (`{{ … }}`) including literals, variables, and operators
//! (aligned with Nunjucks [`parseExpression`](https://github.com/mozilla/nunjucks/blob/master/nunjucks/src/parser.js)).

use serde_json::Value;
use std::sync::Arc;

/// One branch of an `{% if %}` / `{% elif %}` / `{% else %}` chain.
#[derive(Debug, Clone, PartialEq)]
pub struct IfBranch {
    /// Condition; [`None`] for `{% else %}`.
    pub cond: Option<Expr>,
    pub body: Vec<Node>,
}

/// One formal parameter in a `{% macro %}` header (`a` or `a = expr`).
#[derive(Debug, Clone, PartialEq)]
pub struct MacroParam {
    pub name: String,
    /// Default expression evaluated in the **caller's** scope when the argument is omitted.
    pub default: Option<Expr>,
}

/// A template macro definition (`{% macro name(args) %}…{% endmacro %}`).
#[derive(Debug, Clone, PartialEq)]
pub struct MacroDef {
    pub name: String,
    pub params: Vec<MacroParam>,
    pub body: Vec<Node>,
    /// For a macro imported from another template: the macros visible at that template's top
    /// level (its own and the ones it imports), so the body can call them (Nunjucks macros close
    /// over their defining module).
    pub closure: Option<std::sync::Arc<std::collections::HashMap<String, MacroDef>>>,
}

/// Loop binding list after `for` (`x` or `k, v` or `a, b, c`).
#[derive(Debug, Clone, PartialEq)]
pub enum ForVars {
    Single(String),
    Multi(Vec<String>),
}

/// One `{% case expr %}…` branch inside `{% switch %}`.
#[derive(Debug, Clone, PartialEq)]
pub struct SwitchCase {
    pub cond: Expr,
    pub body: Vec<Node>,
}

/// Template structure produced by the parser.
///
/// - [`Node::Root`]: sequence of top-level fragments (text + outputs).
/// - [`Node::Text`]: literal characters from the template.
/// - [`Node::Output`]: one or more [`Expr`] values to evaluate and concatenate (filters etc. are future work).
#[derive(Debug, Clone, PartialEq)]
pub enum Node {
    /// Container for sibling template fragments.
    Root(Vec<Node>),
    /// Raw text between (or outside) template tags (shared across clones of the AST).
    Text(Arc<str>),
    /// Content inside `{{` … `}}` after expression parsing.
    Output(Vec<Expr>),
    /// `{% if %}`, optional `{% elif %}`, optional `{% else %}`, `{% endif %}`.
    If { branches: Vec<IfBranch> },
    /// `{% for var in iter %} … {% endfor %}` (optional `{% else %}` before `endfor`).
    For {
        vars: ForVars,
        iter: Expr,
        body: Vec<Node>,
        else_body: Option<Vec<Node>>,
    },
    /// `{% set a = expr %}`, `{% set a, b = expr %}`, or `{% set a %}…{% endset %}`.
    Set {
        targets: Vec<String>,
        value: Option<Expr>,
        body: Option<Vec<Node>>,
    },
    /// `{% include expr %}` with optional `ignore missing` — template name from expression.
    ///
    /// `with_context`: `None` / `Some(true)` — current frame stack; `Some(false)` — isolated root
    /// context (template globals only; matches Jinja `without context` / Nunjucks-style isolation).
    Include {
        template: Expr,
        ignore_missing: bool,
        with_context: Option<bool>,
    },
    /// `{% switch expr %}{% case c %}…{% default %}…{% endswitch %}`.
    Switch {
        expr: Expr,
        cases: Vec<SwitchCase>,
        default_body: Option<Vec<Node>>,
    },
    /// `{% extends expr %}` — template name from any expression (e.g. quoted string or variable); must appear before meaningful child content.
    Extends { parent: Expr },
    /// `{% block name %}…{% endblock %}` — default body when used in a base layout.
    Block { name: String, body: Vec<Node> },
    /// `{% macro name(a, b) %}…{% endmacro %}` — emits no output; registers a macro for the current template.
    MacroDef(MacroDef),
    /// `{% import expr as alias %}` — loads a template and exposes its top-level macros under `alias` (`alias.macro()`).
    Import {
        template: Expr,
        alias: String,
        /// `Some(true)` = `with context` (parent context when evaluating top-level `{% set %}` and macro bodies);
        /// `Some(false)` or omitted = isolated (Nunjucks default).
        with_context: Option<bool>,
    },
    /// `{% from expr import a, b as c %}` — imports named macros into the current macro scope.
    FromImport {
        template: Expr,
        /// `(exported_name, alias)` where `alias` is the local name (same as exported if `None`).
        names: Vec<(String, Option<String>)>,
        with_context: Option<bool>,
    },
    /// `{% filter name %}…{% endfilter %}` — render body to a string, then apply a builtin filter.
    FilterBlock {
        name: String,
        args: Vec<Expr>,
        body: Vec<Node>,
    },
    /// `{% call macro(args) %}…{% endcall %}` — macro may invoke `caller()` to render this body.
    /// Optional `{% call(a, b) m() %}` — `caller(x, y)` passes arguments into the call body scope.
    CallBlock {
        caller_params: Vec<MacroParam>,
        callee: Expr,
        body: Vec<Node>,
    },
    /// `{% asyncEach var in iter %} … {% endeach %}` — sequential async iteration.
    /// Each iteration body is awaited sequentially; async filters/globals within the body can suspend.
    AsyncEach {
        vars: ForVars,
        iter: Expr,
        body: Vec<Node>,
        else_body: Option<Vec<Node>>,
    },
    /// `{% asyncAll var in iter %} … {% endall %}` — parallel async iteration.
    /// All iteration bodies are rendered concurrently; results are concatenated in iteration order.
    AsyncAll {
        vars: ForVars,
        iter: Expr,
        body: Vec<Node>,
        else_body: Option<Vec<Node>>,
    },
    /// `{% ifAsync cond %} … {% endif %}` — async condition evaluation.
    IfAsync { branches: Vec<IfBranch> },
    /// Custom extension tag (`addExtension` / [`Environment::register_extension`](crate::environment::Environment::register_extension)).
    ExtensionTag {
        extension_name: String,
        /// Opening tag name (e.g. `echo`).
        tag: String,
        /// Raw source after the tag name until `%}` (trimmed).
        args: String,
        /// Block body when the extension declares an end tag.
        body: Option<Vec<Node>>,
    },
}

/// Comparison operators in a Nunjucks-style chain (`a == b < c`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompareOp {
    Eq,
    StrictEq,
    Ne,
    StrictNe,
    Lt,
    Gt,
    Le,
    Ge,
}

/// Binary operators (arithmetic, logical short-circuit forms use these in the AST).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinOp {
    Add,
    Sub,
    Mul,
    Div,
    FloorDiv,
    Mod,
    Pow,
    /// String concatenation (`~`), compiled as `+ "" +` in Nunjucks JS output.
    Concat,
    And,
    Or,
    /// Membership ([`runtime.inOperator` in Nunjucks](https://github.com/mozilla/nunjucks/blob/master/nunjucks/src/lib.js)).
    In,
    /// `is` test (right-hand side is typically a variable naming the test).
    Is,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnaryOp {
    Not,
    Neg,
    Pos,
}

/// Expression inside a variable tag or tag body (when wired up).
#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    /// JSON literal (numbers, strings, booleans, null).
    Literal(Value),
    /// Context key; non-existent keys render as empty (Nunjucks-style).
    Variable(String),
    /// Attribute access: `base.attr` (Nunjucks `LookupVal`).
    GetAttr {
        base: Box<Expr>,
        attr: String,
    },
    /// Subscript: `base[index]` or Jinja-style `base[start:stop:step]`.
    GetItem {
        base: Box<Expr>,
        /// Single index, or [`Expr::Slice`] for `:` subscripts.
        index: Box<Expr>,
    },
    /// Slice inside `[ … ]` (`start:stop:step`; any part may be omitted).
    Slice {
        start: Option<Box<Expr>>,
        stop: Option<Box<Expr>>,
        step: Option<Box<Expr>>,
    },
    /// Function-style call `callee(args…)` (runtime may be limited until globals exist).
    Call {
        callee: Box<Expr>,
        args: Vec<Expr>,
        /// `name = value` arguments (applied after positionals; unknown names ignored, Nunjucks-style).
        kwargs: Vec<(String, Expr)>,
    },
    /// Filter pipeline step: `input | name` or `input | name(arg, …)`.
    Filter {
        name: String,
        input: Box<Expr>,
        args: Vec<Expr>,
    },
    /// Array literal `[a, b, …]` with arbitrary expressions.
    List(Vec<Expr>),
    /// Object literal `{ key: val, …}` (keys are expressions, usually strings or identifiers).
    Dict(Vec<(Expr, Expr)>),
    /// Python-style conditional: `body if cond else else_`.
    InlineIf {
        cond: Box<Expr>,
        then_expr: Box<Expr>,
        else_expr: Option<Box<Expr>>,
    },
    Unary {
        op: UnaryOp,
        expr: Box<Expr>,
    },
    Binary {
        op: BinOp,
        left: Box<Expr>,
        right: Box<Expr>,
    },
    /// Chained comparisons (`a == b < c` → left-associative JS-style emit in Nunjucks).
    Compare {
        head: Box<Expr>,
        rest: Vec<(CompareOp, Expr)>,
    },
    /// JavaScript-style regex literal `r/pattern/flags` ([Nunjucks lexer](https://github.com/mozilla/nunjucks/blob/master/nunjucks/src/lexer.js)).
    RegexLiteral {
        /// Raw pattern body between slashes (may contain `\/` escapes).
        pattern: String,
        /// Flag letters `g`, `i`, `m`, `y` (subset of ECMAScript).
        flags: String,
    },
}
