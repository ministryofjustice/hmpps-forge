//! Replays every recorded JSX component render (`fixtures/jsx.ndjson`, first recorded from the TS
//! tests): same props in, same HTML out. `UPDATE_FIXTURES=1` rewrites the expected HTML.

use forge_core::Value;
use forge_core::value::Map;

fn decode(v: &Value) -> Value {
    match v {
        Value::Object(o) if o.contains_key("$undefined") => Value::Undefined,
        Value::Object(o) => Value::object(o.iter().map(|(k, x)| (k.clone(), decode(x))).collect::<Map>()),
        Value::Array(a) => Value::array(a.iter().map(decode).collect()),
        other => other.clone(),
    }
}

#[test]
fn jsx_components_match_typescript() {
    let Some(text) = forge_core::testing::fixtures::read("jsx.ndjson") else {
        eprintln!("jsx corpus not recorded; skipping");
        return;
    };
    let (mut checked, mut failures) = (0, Vec::new());
    let updating = forge_core::testing::fixtures::updating();
    let mut updated: Vec<serde_json::Value> = Vec::new();
    for line in text.lines() {
        let mut row: Value = serde_json::from_str(line).unwrap();
        let variant = row.get("variant").to_js_string();
        let render = forge_govuk_components::jsx::render_for(&variant).unwrap_or_else(|| panic!("unported {variant}"));
        checked += 1;
        let got = render(&decode(&row.get("props")));
        if updating {
            row.set("html", Value::from(got.expect("render")));
            updated.push(row.to_json());
            continue;
        }
        let expected = row.get("html").to_js_string();
        if got.as_deref().ok() != Some(expected.as_str()) {
            failures.push(format!("{variant}\n  rust={got:?}\n  ts  ={expected:?}"));
        }
    }
    if updating {
        forge_core::testing::fixtures::write_ndjson("jsx.ndjson", &updated);
        return;
    }
    eprintln!("jsx components: {checked} renders checked, {} failed", failures.len());
    for f in &failures {
        eprintln!("  {f}");
    }
    assert!(failures.is_empty());
}
