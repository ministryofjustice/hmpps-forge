use runjucks_core::tag_lex::{tokenize_tag_body, TagKeyword, TagToken};

#[test]
fn if_cond() {
    let t = tokenize_tag_body("if cond").unwrap();
    assert_eq!(
        t,
        vec![
            TagToken::Keyword(TagKeyword::If),
            TagToken::Ident("cond".into()),
        ]
    );
}

#[test]
fn for_item_in_items() {
    let t = tokenize_tag_body("for item in items").unwrap();
    assert_eq!(
        t,
        vec![
            TagToken::Keyword(TagKeyword::For),
            TagToken::Ident("item".into()),
            TagToken::Keyword(TagKeyword::In),
            TagToken::Ident("items".into()),
        ]
    );
}

#[test]
fn elseif_vs_else() {
    let t = tokenize_tag_body("elseif cond").unwrap();
    assert_eq!(
        t,
        vec![
            TagToken::Keyword(TagKeyword::ElseIf),
            TagToken::Ident("cond".into()),
        ]
    );
    let t2 = tokenize_tag_body("elif x").unwrap();
    assert_eq!(
        t2,
        vec![
            TagToken::Keyword(TagKeyword::Elif),
            TagToken::Ident("x".into()),
        ]
    );
}

#[test]
fn ifoo_is_ident_not_keyword() {
    let t = tokenize_tag_body("ifoo").unwrap();
    assert_eq!(t, vec![TagToken::Ident("ifoo".into())]);
}

#[test]
fn empty_body() {
    assert!(tokenize_tag_body("").unwrap().is_empty());
    assert!(tokenize_tag_body("   ").unwrap().is_empty());
}

#[test]
fn extends_quoted() {
    let t = tokenize_tag_body("extends \"base.html\"").unwrap();
    assert_eq!(
        t,
        vec![
            TagToken::Keyword(TagKeyword::Extends),
            TagToken::String("base.html".into()),
        ]
    );
}

#[test]
fn endset_keyword() {
    let t = tokenize_tag_body("endset").unwrap();
    assert_eq!(t, vec![TagToken::Keyword(TagKeyword::EndSet)]);
}

#[test]
fn macro_with_punct() {
    let t = tokenize_tag_body("macro field(name, type)").unwrap();
    assert_eq!(t[0], TagToken::Keyword(TagKeyword::Macro));
    assert_eq!(t[1], TagToken::Ident("field".into()));
    assert_eq!(t[2], TagToken::Punct('('));
    assert_eq!(t[3], TagToken::Ident("name".into()));
    assert_eq!(t[4], TagToken::Punct(','));
    assert_eq!(t[5], TagToken::Ident("type".into()));
    assert_eq!(t[6], TagToken::Punct(')'));
}
