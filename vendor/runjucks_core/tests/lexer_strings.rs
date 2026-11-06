//! Delimiter sequences inside double-quoted strings (string-aware lexer scanning).

use runjucks_core::lexer::{tokenize, Token};

fn tag(s: &str) -> Token {
    Token::Tag(s.into())
}

#[test]
fn tag_body_with_percent_brace_inside_string() {
    let tokens = tokenize(r#"{% set s = "x %}y" %}"#).unwrap();
    assert_eq!(tokens, vec![tag(r#"set s = "x %}y""#)]);
}

#[test]
fn expression_with_close_braces_inside_string() {
    let tokens = tokenize(r#"{{ "a }}b" }}"#).unwrap();
    assert_eq!(tokens, vec![Token::Expression(r#" "a }}b" "#.into())]);
}

#[test]
fn expression_escaped_quote_before_close_braces_in_string() {
    let tokens = tokenize(r#"{{ "foo\" }}bar" }}"#).unwrap();
    assert_eq!(tokens, vec![Token::Expression(r#" "foo\" }}bar" "#.into())]);
}

#[test]
fn expression_quoted_double_braces_not_nested_error() {
    let tokens = tokenize(r#"{{ "{{ not nested }}" }}"#).unwrap();
    assert_eq!(
        tokens,
        vec![Token::Expression(r#" "{{ not nested }}" "#.into())]
    );
}
