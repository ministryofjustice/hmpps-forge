//! Block tags (`{% %}`): once the lexer emits `Token::Tag`, the parser should build
//! `If` / `For` / … nodes (see nunjucks/tests/parser.js).

use runjucks_core::lexer::{tokenize, Token};

#[test]
fn lexer_splits_if_else_endif_into_tags_and_text() {
    let tokens = tokenize("{% if x %}a{% else %}b{% endif %}").unwrap();
    assert_eq!(
        tokens,
        vec![
            Token::Tag("if x".into()),
            Token::Text("a".into()),
            Token::Tag("else".into()),
            Token::Text("b".into()),
            Token::Tag("endif".into()),
        ]
    );
}

#[test]
fn lexer_splits_for_endfor() {
    let tokens = tokenize("{% for i in items %}{{ i }}{% endfor %}").unwrap();
    assert_eq!(
        tokens,
        vec![
            Token::Tag("for i in items".into()),
            Token::Expression(" i ".into()),
            Token::Tag("endfor".into()),
        ]
    );
}

#[test]
fn lexer_splits_extends_and_block() {
    let tokens = tokenize("{% extends \"base.html\" %}{% block main %}{% endblock %}").unwrap();
    assert_eq!(
        tokens,
        vec![
            Token::Tag("extends \"base.html\"".into()),
            Token::Tag("block main".into()),
            Token::Tag("endblock".into()),
        ]
    );
}

#[test]
fn lexer_set_statement() {
    let tokens = tokenize("{% set x = 1 %}").unwrap();
    assert_eq!(tokens, vec![Token::Tag("set x = 1".into())]);
}
