//! `{% raw %}` / `{% verbatim %}` parity with Nunjucks (`nunjucks/tests/parser.js` raw/verbatim cases).

use runjucks_core::ast::Node;
use runjucks_core::environment::Environment;
use runjucks_core::lexer::{tokenize, Token};
use runjucks_core::parser::parse;
use serde_json::json;

fn tag(s: &str) -> Token {
    Token::Tag(s.into())
}

#[test]
fn lexer_nested_raw_balances_to_outer_endraw() {
    let tpl = "{% raw %}{% raw %}{{ x }}{% endraw %}{% endraw %}";
    let tokens = tokenize(tpl).unwrap();
    assert_eq!(
        tokens,
        vec![
            tag("raw"),
            Token::Text("{% raw %}{{ x }}{% endraw %}".into()),
            tag("endraw"),
        ]
    );
}

#[test]
fn lexer_nested_verbatim_balances() {
    let tpl = "{% verbatim %}{% verbatim %}{{ x }}{% endverbatim %}{% endverbatim %}";
    let tokens = tokenize(tpl).unwrap();
    assert_eq!(
        tokens,
        vec![
            tag("verbatim"),
            Token::Text("{% verbatim %}{{ x }}{% endverbatim %}".into()),
            tag("endverbatim"),
        ]
    );
}

/// Inner `{% raw %}` / `{% endraw %}` stays literal when the outer block is `verbatim`.
#[test]
fn lexer_verbatim_contains_raw_tags_as_text() {
    let tpl = "{% verbatim %}{% raw %}x{% endraw %}y{% endverbatim %}";
    let tokens = tokenize(tpl).unwrap();
    assert_eq!(
        tokens,
        vec![
            tag("verbatim"),
            Token::Text("{% raw %}x{% endraw %}y".into()),
            tag("endverbatim"),
        ]
    );
}

#[test]
fn parse_raw_nested_literal_matches_nunjucks() {
    let tpl = "{% raw %}{% raw %}{{ x }}{% endraw %}{% endraw %}";
    let tokens = tokenize(tpl).unwrap();
    let root = parse(&tokens).unwrap();
    let Node::Root(nodes) = root else {
        panic!("expected root");
    };
    assert_eq!(nodes.len(), 1);
    let Node::Text(s) = &nodes[0] else {
        panic!("expected single text node");
    };
    assert_eq!(s.as_ref(), "{% raw %}{{ x }}{% endraw %}");
}

#[test]
fn parse_raw_empty_body() {
    let tpl = "{% raw %}{% endraw %}";
    let tokens = tokenize(tpl).unwrap();
    let root = parse(&tokens).unwrap();
    let Node::Root(nodes) = root else {
        panic!("expected root");
    };
    assert_eq!(nodes.len(), 1);
    assert!(matches!(&nodes[0], Node::Text(s) if s.is_empty()));
}

#[test]
fn parse_raw_with_comment_lookalike_inside() {
    // Nunjucks: `{% raw %}{# test {% endraw %}`
    let tpl = "{% raw %}{# test {% endraw %}";
    let tokens = tokenize(tpl).unwrap();
    let root = parse(&tokens).unwrap();
    let Node::Root(nodes) = root else {
        panic!("expected root");
    };
    let Node::Text(s) = &nodes[0] else {
        panic!("expected text");
    };
    assert_eq!(s.as_ref(), "{# test ");
}

#[test]
fn render_raw_does_not_evaluate_interpolation() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{% raw %}{{ x }}{% endraw %}".into(),
            json!({ "x": "nope" }),
        )
        .unwrap();
    assert_eq!(out, "{{ x }}");
}

#[test]
fn render_nested_raw_full_template() {
    let env = Environment::default();
    let tpl = "{% raw %}{% raw %}{{ x }}{% endraw %}{% endraw %}";
    let out = env
        .render_string(tpl.into(), json!({ "x": "evaluated" }))
        .unwrap();
    assert_eq!(out, "{% raw %}{{ x }}{% endraw %}");
}

#[test]
fn render_verbatim_does_not_evaluate() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{% verbatim %}{{ y }}{% endverbatim %}".into(),
            json!({ "y": "z" }),
        )
        .unwrap();
    assert_eq!(out, "{{ y }}");
}

#[test]
fn render_multiple_raw_blocks() {
    let env = Environment::default();
    let tpl = "{% raw %}{{ a }}{% endraw %}|{{ a }}|{% raw %}{{ a }}{% endraw %}";
    let out = env.render_string(tpl.into(), json!({ "a": "X" })).unwrap();
    assert_eq!(out, "{{ a }}|X|{{ a }}");
}

#[test]
fn tokenize_unclosed_raw_errors() {
    let msg = tokenize("{% raw %}no close").unwrap_err().to_string();
    assert!(msg.contains("endraw") || msg.contains("%}"), "{msg}");
}

#[test]
fn parse_orphan_endraw_errors() {
    let tokens = tokenize("{% endraw %}").unwrap();
    let msg = parse(&tokens).unwrap_err().to_string();
    assert!(msg.contains("unexpected") || msg.contains("endraw"));
}
