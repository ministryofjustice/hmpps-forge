//! Integration tests: `switch` fall-through, `for` + `loop`, frame `set`, `include` + `ignore missing`.

use runjucks_core::loader::map_loader;
use runjucks_core::Environment;
use serde_json::json;
use std::collections::HashMap;

fn env_map(templates: HashMap<String, String>) -> Environment {
    let mut env = Environment::default();
    env.loader = Some(map_loader(templates));
    env
}

#[test]
fn switch_fall_through_empty_case() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% switch 1 %}{% case 1 %}{% case 2 %}B{% endswitch %}"#.into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "B");
}

#[test]
fn switch_matches_first_case() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% switch 2 %}{% case 1 %}A{% case 2 %}B{% default %}D{% endswitch %}"#.into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "B");
}

#[test]
fn for_loop_object_sorted_keys_kv() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% for k, v in o %}{{ k }}={{ v }};{% endfor %}"#.into(),
            json!({ "o": { "b": 2, "a": 1 } }),
        )
        .unwrap();
    assert_eq!(out, "a=1;b=2;");
}

#[test]
fn for_tuple_unpack_rows() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% for a, b in rows %}{{ a }}:{{ b }}|{% endfor %}"#.into(),
            json!({ "rows": [[1, 2], [3, 4]] }),
        )
        .unwrap();
    assert_eq!(out, "1:2|3:4|");
}

#[test]
fn loop_bindings_in_template() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% for i in [10,20] %}{{ loop.index }}:{{ loop.index0 }}:{{ loop.length }};{% endfor %}"#
                .into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "1:0:2;2:1:2;");
}

#[test]
fn set_inside_for_not_visible_outside() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% for i in [1] %}{% set val = 5 %}{% endfor %}{{ val }}"#.into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "");
}

#[test]
fn set_inside_for_updates_outer_when_defined() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% set val = 1 %}{% for i in [1] %}{% set val = 5 %}{% endfor %}{{ val }}"#.into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "5");
}

#[test]
fn set_after_if_visible() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% if true %}{% set x = "green" %}{% endif %}{{ x }}"#.into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "green");
}

#[test]
fn include_sees_enclosing_loop() {
    let mut templates = HashMap::new();
    templates.insert(
        "main.njk".into(),
        r#"{% for item in [1,2,3] %}{% include "loop.njk" %}{% endfor %}"#.into(),
    );
    templates.insert(
        "loop.njk".into(),
        "{{ loop.index }},{{ loop.index0 }},{{ loop.first }}\n".into(),
    );
    let env = env_map(templates);
    let out = env.render_template("main.njk", json!({})).unwrap();
    assert_eq!(out, "1,0,true\n2,1,false\n3,2,false\n");
}

#[test]
fn include_ignore_missing_empty() {
    let mut m = HashMap::new();
    m.insert(
        "main.html".into(),
        r#"x{% include "nope.html" ignore missing %}y"#.into(),
    );
    let env = env_map(m);
    let out = env.render_template("main.html", json!({})).unwrap();
    assert_eq!(out, "xy");
}

#[test]
fn include_dynamic_name_from_context() {
    let mut m = HashMap::new();
    m.insert("main.html".into(), r#"{% include name %}"#.into());
    m.insert("part.html".into(), "ok".into());
    let env = env_map(m);
    let out = env
        .render_template("main.html", json!({ "name": "part.html" }))
        .unwrap();
    assert_eq!(out, "ok");
}

#[test]
fn set_block_capture() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% set cap %}a{{ 1 }}b{% endset %}[{{ cap }}]"#.into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "[a1b]");
}

#[test]
fn nested_for_shadows_outer_loop_var() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% for i in [1,2] %}{% for i in [3,4] %}{{ i }}{% endfor %}{{ i }}{% endfor %}"#
                .into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "341342");
}

#[test]
fn multi_set_same_value() {
    let env = Environment::default();
    let out = env
        .render_string(r#"{% set x, y = "foo" %}{{ x }}{{ y }}"#.into(), json!({}))
        .unwrap();
    assert_eq!(out, "foofoo");
}
