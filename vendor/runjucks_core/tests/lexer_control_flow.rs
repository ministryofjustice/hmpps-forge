//! Lexer expectations for `{% … %}` bodies (trimmed), aligned with Nunjucks `parseStatement` tags:
//! `if`, `elif`, `elseif`, `else`, `endif`, `for`, `endfor`, `asyncEach`, `asyncAll`, `block`,
//! `endblock`, `extends`, `include`, `set`, `macro`, `endmacro`, `call`, `endcall`, `import`,
//! `from`, `filter`, `endfilter`, `switch`, `case`, `default`, `endswitch`, `raw`, `endraw`,
//! `verbatim`, `endverbatim`, `ifAsync`.

use runjucks_core::lexer::{tokenize, Token};

fn tag(s: &str) -> Token {
    Token::Tag(s.into())
}

#[test]
fn if_elif_else_endif_chain() {
    let tokens = tokenize("{% if a %}{% elif b %}{% else %}{% endif %}").unwrap();
    assert_eq!(
        tokens,
        vec![tag("if a"), tag("elif b"), tag("else"), tag("endif"),]
    );
}

#[test]
fn elseif_alias() {
    let tokens = tokenize("{% elseif cond %}").unwrap();
    assert_eq!(tokens, vec![tag("elseif cond")]);
}

#[test]
fn if_async() {
    let tokens = tokenize("{% ifAsync cond %}").unwrap();
    assert_eq!(tokens, vec![tag("ifAsync cond")]);
}

#[test]
fn for_in_endfor() {
    let tokens = tokenize("{% for item in items %}x{% endfor %}").unwrap();
    assert_eq!(
        tokens,
        vec![
            tag("for item in items"),
            Token::Text("x".into()),
            tag("endfor")
        ]
    );
}

#[test]
fn for_else_endfor() {
    let tokens = tokenize("{% for x in y %}{% else %}{% endfor %}").unwrap();
    assert_eq!(tokens, vec![tag("for x in y"), tag("else"), tag("endfor")]);
}

#[test]
fn async_each() {
    let tokens = tokenize("{% asyncEach item in rows %}{% endeach %}").unwrap();
    assert_eq!(tokens, vec![tag("asyncEach item in rows"), tag("endeach")]);
}

#[test]
fn async_all() {
    let tokens = tokenize("{% asyncAll item in rows %}{% endall %}").unwrap();
    assert_eq!(tokens, vec![tag("asyncAll item in rows"), tag("endall")]);
}

#[test]
fn block_endblock() {
    let tokens = tokenize("{% block title %}{% endblock %}").unwrap();
    assert_eq!(tokens, vec![tag("block title"), tag("endblock")]);
}

#[test]
fn block_endblock_named() {
    let tokens = tokenize("{% endblock title %}").unwrap();
    assert_eq!(tokens, vec![tag("endblock title")]);
}

#[test]
fn extends_string() {
    let tokens = tokenize("{% extends \"base.html\" %}").unwrap();
    assert_eq!(tokens, vec![tag("extends \"base.html\"")]);
}

#[test]
fn include() {
    let tokens = tokenize("{% include \"part.html\" %}").unwrap();
    assert_eq!(tokens, vec![tag("include \"part.html\"")]);
}

#[test]
fn set_statement() {
    let tokens = tokenize("{% set x = 1 %}").unwrap();
    assert_eq!(tokens, vec![tag("set x = 1")]);
}

#[test]
fn macro_endmacro() {
    let tokens = tokenize("{% macro field(name, type) %}{% endmacro %}").unwrap();
    assert_eq!(
        tokens,
        vec![tag("macro field(name, type)"), tag("endmacro")]
    );
}

#[test]
fn call_endcall() {
    let tokens = tokenize("{% call foo() %}{% endcall %}").unwrap();
    assert_eq!(tokens, vec![tag("call foo()"), tag("endcall")]);
}

#[test]
fn import_statement() {
    let tokens = tokenize("{% import \"macros.html\" as m %}").unwrap();
    assert_eq!(tokens, vec![tag("import \"macros.html\" as m")]);
}

#[test]
fn from_import() {
    let tokens = tokenize("{% from \"helpers.html\" import foo, bar %}").unwrap();
    assert_eq!(tokens, vec![tag("from \"helpers.html\" import foo, bar")]);
}

#[test]
fn filter_block_endfilter() {
    let tokens = tokenize("{% filter upper %}{% endfilter %}").unwrap();
    assert_eq!(tokens, vec![tag("filter upper"), tag("endfilter")]);
}

#[test]
fn set_block_endset_tokens() {
    let tokens = tokenize("{% set x %}c{% endset %}").unwrap();
    assert_eq!(
        tokens,
        vec![tag("set x"), Token::Text("c".into()), tag("endset"),]
    );
}

#[test]
fn switch_case_default_endswitch() {
    let tokens = tokenize("{% switch x %}{% case \"a\" %}a{% default %}d{% endswitch %}").unwrap();
    assert_eq!(
        tokens,
        vec![
            tag("switch x"),
            tag("case \"a\""),
            Token::Text("a".into()),
            tag("default"),
            Token::Text("d".into()),
            tag("endswitch"),
        ]
    );
}

#[test]
fn raw_endraw() {
    let tokens = tokenize("{% raw %}{{ not a var }}{% endraw %}").unwrap();
    assert_eq!(
        tokens,
        vec![
            tag("raw"),
            Token::Text("{{ not a var }}".into()),
            tag("endraw"),
        ]
    );
}

#[test]
fn verbatim_endverbatim() {
    let tokens = tokenize("{% verbatim %}{%{% endverbatim %}").unwrap();
    assert_eq!(
        tokens,
        vec![
            tag("verbatim"),
            Token::Text("{%".into()),
            tag("endverbatim"),
        ]
    );
}
