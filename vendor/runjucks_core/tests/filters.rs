use rand::rngs::SmallRng;
use rand::SeedableRng;
use runjucks_core::environment::Environment;
use runjucks_core::filters::{apply_builtin, escape_html};
use runjucks_core::value::is_marked_safe;
use serde_json::{json, Value};

fn test_rng() -> SmallRng {
    SmallRng::seed_from_u64(0x5EED)
}

#[test]
fn builtin_upper_lower_length() {
    let env = Environment::default();
    let mut rng = test_rng();
    assert_eq!(
        apply_builtin(&env, &mut rng, "upper", &json!("ab"), &[]).unwrap(),
        json!("AB")
    );
    assert_eq!(
        apply_builtin(&env, &mut rng, "lower", &json!("AB"), &[]).unwrap(),
        json!("ab")
    );
    assert_eq!(
        apply_builtin(&env, &mut rng, "length", &json!("hello"), &[]).unwrap(),
        json!(5)
    );
}

#[test]
fn builtin_join_round_replace() {
    let env = Environment::default();
    let mut rng = test_rng();
    assert_eq!(
        apply_builtin(&env, &mut rng, "join", &json!(["a", "b"]), &[json!(",")]).unwrap(),
        json!("a,b")
    );
    assert_eq!(
        apply_builtin(&env, &mut rng, "round", &json!(4.5667), &[]).unwrap(),
        json!(5)
    );
    assert_eq!(
        apply_builtin(
            &env,
            &mut rng,
            "replace",
            &json!("foofoo"),
            &[json!("foo"), json!("bar")]
        )
        .unwrap(),
        json!("barbar")
    );
}

#[test]
fn replace_max_count_and_empty_needle_match_nunjucks() {
    let env = Environment::default();
    let mut rng = test_rng();
    assert_eq!(
        apply_builtin(
            &env,
            &mut rng,
            "replace",
            &json!("ababab"),
            &[json!("ab"), json!("x"), json!(2)]
        )
        .unwrap(),
        json!("xxab")
    );
    assert_eq!(
        apply_builtin(
            &env,
            &mut rng,
            "replace",
            &json!("foo"),
            &[json!(""), json!(".")]
        )
        .unwrap(),
        json!(".f.o.o.")
    );
    assert_eq!(
        apply_builtin(
            &env,
            &mut rng,
            "replace",
            &json!("hello"),
            &[json!("l"), json!(""), json!(1)]
        )
        .unwrap(),
        json!("helo")
    );
}

#[test]
fn replace_regex_matches_nunjucks_flags() {
    let env = Environment::default();
    assert_eq!(
        env.render_string(
            r#"{{ "aabbbb" | replace(r/ab{2}/, "z") }}"#.into(),
            json!({})
        )
        .unwrap(),
        "azbb"
    );
    assert_eq!(
        env.render_string(r#"{{ "aaaAAA" | replace(r/a/i, "z") }}"#.into(), json!({}))
            .unwrap(),
        "zaaAAA"
    );
    assert_eq!(
        env.render_string(r#"{{ "aaaAAA" | replace(r/a/g, "z") }}"#.into(), json!({}))
            .unwrap(),
        "zzzAAA"
    );
    assert_eq!(
        env.render_string(r#"{{ "aaaAAA" | replace(r/a/gi, "z") }}"#.into(), json!({}))
            .unwrap(),
        "zzzzzz"
    );
}

#[test]
fn random_filter_single_element_is_stable() {
    let env = Environment::default();
    let mut rng = test_rng();
    assert_eq!(
        apply_builtin(&env, &mut rng, "random", &json!([42]), &[]).unwrap(),
        json!(42)
    );
}

#[test]
fn builtin_abs_capitalize() {
    let env = Environment::default();
    let mut rng = test_rng();
    assert_eq!(
        apply_builtin(&env, &mut rng, "abs", &json!(-3), &[]).unwrap(),
        json!(3)
    );
    assert_eq!(
        apply_builtin(&env, &mut rng, "capitalize", &json!("foo"), &[]).unwrap(),
        json!("Foo")
    );
}

#[test]
fn escape_html_escapes_special_chars() {
    assert_eq!(escape_html(r#"&<>"'"#), "&amp;&lt;&gt;&quot;&#39;");
}

#[test]
fn escape_html_preserves_safe_text() {
    assert_eq!(escape_html("hello world 123"), "hello world 123");
}

#[test]
fn escape_html_empty() {
    assert_eq!(escape_html(""), "");
}

#[test]
fn safe_and_escape_filter_mark_safe() {
    let env = Environment::default();
    let mut rng = test_rng();
    let raw = apply_builtin(&env, &mut rng, "safe", &json!("<b>"), &[]).unwrap();
    assert!(is_marked_safe(&raw));
    let esc = apply_builtin(&env, &mut rng, "escape", &raw, &[]).unwrap();
    assert_eq!(esc, raw);
    let doubled = apply_builtin(&env, &mut rng, "escape", &json!("<"), &[]).unwrap();
    assert!(is_marked_safe(&doubled));
}

#[test]
fn default_undefined_and_boolean_mode() {
    let env = Environment::default();
    let mut rng = test_rng();
    use runjucks_core::value::undefined_value;
    assert_eq!(
        apply_builtin(
            &env,
            &mut rng,
            "default",
            &undefined_value(),
            &[json!("foo")]
        )
        .unwrap(),
        json!("foo")
    );
    assert_eq!(
        apply_builtin(&env, &mut rng, "default", &Value::Null, &[json!("foo")]).unwrap(),
        Value::Null
    );
    assert_eq!(
        apply_builtin(
            &env,
            &mut rng,
            "default",
            &json!(false),
            &[json!("foo"), json!(true)]
        )
        .unwrap(),
        json!("foo")
    );
    assert_eq!(
        apply_builtin(&env, &mut rng, "d", &undefined_value(), &[json!("z")]).unwrap(),
        json!("z")
    );
}

#[test]
fn batch_and_join_attr() {
    let env = Environment::default();
    let mut rng = test_rng();
    let out = apply_builtin(
        &env,
        &mut rng,
        "batch",
        &json!([1, 2, 3, 4, 5, 6]),
        &[json!(2)],
    )
    .unwrap();
    assert_eq!(out, json!([[1, 2], [3, 4], [5, 6]]));
    let with_fill = apply_builtin(
        &env,
        &mut rng,
        "batch",
        &json!([1, 2, 3]),
        &[json!(2), json!(0)],
    )
    .unwrap();
    assert_eq!(with_fill, json!([[1, 2], [3, 0]]));
    let joined = apply_builtin(
        &env,
        &mut rng,
        "join",
        &json!([{"x": "a"}, {"x": "b"}]),
        &[json!(","), json!("x")],
    )
    .unwrap();
    assert_eq!(joined, json!("a,b"));
}

#[test]
fn round_ceil_floor() {
    let env = Environment::default();
    let mut rng = test_rng();
    assert_eq!(
        apply_builtin(
            &env,
            &mut rng,
            "round",
            &json!(1.5),
            &[json!(0), json!("floor")]
        )
        .unwrap(),
        json!(1)
    );
    assert_eq!(
        apply_builtin(
            &env,
            &mut rng,
            "round",
            &json!(1.3),
            &[json!(0), json!("ceil")]
        )
        .unwrap(),
        json!(2)
    );
}

#[test]
fn selectattr_rejectattr_and_sort() {
    let env = Environment::default();
    let mut rng = test_rng();
    let arr = json!([{"a": 1}, {"a": 0}, {"a": 2}]);
    let sel = apply_builtin(&env, &mut rng, "selectattr", &arr, &[json!("a")]).unwrap();
    assert_eq!(sel, json!([{"a": 1}, {"a": 2}]));
    let rej = apply_builtin(&env, &mut rng, "rejectattr", &arr, &[json!("a")]).unwrap();
    assert_eq!(rej, json!([{"a": 0}]));
    let sorted = apply_builtin(&env, &mut rng, "sort", &arr, &[]).unwrap();
    assert_eq!(sorted, json!([{"a": 0}, {"a": 1}, {"a": 2}]));
}

#[test]
fn template_safe_outputs_raw_html_when_autoescape_on() {
    let env = Environment::default();
    assert!(env.autoescape);
    let out = env
        .render_string(r#"{{ "<b>" | safe }}"#.into(), json!({}))
        .unwrap();
    assert_eq!(out, "<b>");
}

#[test]
fn safe_escape_chain_matches_nunjucks() {
    let env = Environment::default();
    let out = env
        .render_string(r#"{{ "<x>" | safe | escape }}"#.into(), json!({}))
        .unwrap();
    assert_eq!(out, "<x>");
}

#[test]
fn escape_safe_chain_matches_nunjucks() {
    let env = Environment::default();
    let out = env
        .render_string(r#"{{ "<x>" | escape | safe }}"#.into(), json!({}))
        .unwrap();
    assert_eq!(out, "&lt;x&gt;");
}

#[test]
fn escape_alias_e_in_output_matches_nunjucks() {
    let env = Environment::default();
    let out = env
        .render_string(r#"{{ "<" | e }}"#.into(), json!({}))
        .unwrap();
    assert_eq!(out, "&lt;");
}

#[test]
fn safe_escape_e_chain_matches_nunjucks() {
    let env = Environment::default();
    let out = env
        .render_string(r#"{{ "<x>" | safe | escape | e }}"#.into(), json!({}))
        .unwrap();
    assert_eq!(out, "<x>");
}

#[test]
fn length_filter_counts_object_keys() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{{ m | length }}"#.into(),
            json!({ "m": { "a": 1, "b": 2 } }),
        )
        .unwrap();
    assert_eq!(out, "2");
}

#[test]
fn forceescape_is_safe_wrapped() {
    let env = Environment::default();
    let mut rng = test_rng();
    let v = apply_builtin(&env, &mut rng, "forceescape", &json!("<"), &[]).unwrap();
    assert!(is_marked_safe(&v));
}

#[test]
fn striptags_matches_nunjucks_preserve_and_flat() {
    let env = Environment::default();
    let mut rng = test_rng();
    let html_flat = "  <p>an  \n <a href=\"#\">example</a> link</p>\n<p>to a webpage</p> <!-- <p>and some comments</p> -->";
    assert_eq!(
        apply_builtin(&env, &mut rng, "striptags", &json!(html_flat), &[]).unwrap(),
        json!("an example link to a webpage")
    );
    let html_preserve = concat!(
        "<div>\n  row1\nrow2  \n  <strong>row3</strong>\n</div>\n\n",
        " HEADER \n\n<ul>\n  <li>option  1</li>\n<li>option  2</li>\n</ul>"
    );
    assert_eq!(
        apply_builtin(
            &env,
            &mut rng,
            "striptags",
            &json!(html_preserve),
            &[json!(true)]
        )
        .unwrap(),
        json!("row1\nrow2\nrow3\n\nHEADER\n\noption 1\noption 2")
    );
}
