//! Whitespace control (`{%-`, `-%}`, `{{-`, `-}}`) and trim-blocks behavior (Nunjucks docs).
//! Vectors inspired by nunjucks/tests/lexer.js and templating.md.

use runjucks_core::lexer::{tokenize, Token};

fn tag(s: &str) -> Token {
    Token::Tag(s.into())
}

/// `{{- value -}}` trims spaces around the variable output region (Nunjucks).
#[test]
fn trim_variable_strips_inner_spaces_around_expression() {
    let tokens = tokenize("{{- name -}}").unwrap();
    assert_eq!(tokens, vec![Token::Expression("name".into())]);
}

#[test]
fn trim_tag_open_close() {
    let tokens = tokenize("{%- if true -%}x{%- endif -%}").unwrap();
    assert_eq!(
        tokens,
        vec![tag("if true"), Token::Text("x".into()), tag("endif"),]
    );
}

#[test]
fn trim_mixed_with_plain_text() {
    let tokens = tokenize("a {{- b -}} c").unwrap();
    assert_eq!(
        tokens,
        vec![
            Token::Text("a".into()),
            Token::Expression("b".into()),
            Token::Text("c".into()),
        ]
    );
}

/// `{%-` trims whitespace on the template source before this tag (including newlines).
#[test]
fn trim_tag_open_strips_preceding_whitespace_only() {
    let tokens = tokenize("  \n{%- if true -%}x").unwrap();
    assert_eq!(tokens, vec![tag("if true"), Token::Text("x".into())]);
}

/// `-%}` / `-}}` trim whitespace after the block before the next output.
#[test]
fn trim_close_strips_leading_whitespace_on_following_text() {
    let tokens = tokenize("{%- if true -%}   \n  y").unwrap();
    assert_eq!(tokens, vec![tag("if true"), Token::Text("y".into())]);
}

#[test]
fn trim_var_close_strips_leading_spaces_on_following_text() {
    let tokens = tokenize("{{- x -}}   z").unwrap();
    assert_eq!(
        tokens,
        vec![Token::Expression("x".into()), Token::Text("z".into())]
    );
}

#[test]
fn only_minus_in_tag_close_still_closes() {
    let tokens = tokenize("{% name -%}").unwrap();
    assert_eq!(tokens, vec![tag("name")]);
}

#[test]
fn double_hyphen_inside_expression_is_not_trim() {
    let tokens = tokenize("{{ a - b }}").unwrap();
    assert_eq!(tokens, vec![Token::Expression(" a - b ".into())]);
}
