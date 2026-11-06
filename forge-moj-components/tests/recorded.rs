//! Replays every recorded MOJ component render (`fixtures/components.ndjson`, first recorded
//! from the TS component tests with real Nunjucks): each block must map to the recorded template
//! and params and render the recorded HTML. `UPDATE_FIXTURES=1` rewrites this crate's rows from
//! this implementation (template-parity keeps Runjucks honest against real Nunjucks).

use forge_core::Value;
use forge_core::value::Map;
use forge_runjucks::RunjucksEngine;

fn decode(v: &Value) -> Value {
    match v {
        Value::Object(o) if o.contains_key("$undefined") => Value::Undefined,
        Value::Object(o) => Value::object(o.iter().map(|(k, x)| (k.clone(), decode(x))).collect::<Map>()),
        Value::Array(a) => Value::array(a.iter().map(decode).collect()),
        other => other.clone(),
    }
}

/// The inverse of `decode`: `undefined` becomes the `{"$undefined": true}` marker.
fn encode(v: &Value) -> Value {
    match v {
        Value::Undefined => Value::from_pairs([("$undefined", Value::Bool(true))]),
        Value::Object(o) => Value::object(o.iter().map(|(k, x)| (k.clone(), encode(x))).collect::<Map>()),
        Value::Array(a) => Value::array(a.iter().map(encode).collect()),
        Value::Opaque(o) => encode(&o.view()),
        other => other.clone(),
    }
}

#[test]
fn moj_components_match_typescript() {
    // The corpus was recorded with TZ=UTC; date filters format in the process timezone.
    // SAFETY: the only test in this binary, set before anything reads the environment.
    unsafe { std::env::set_var("TZ", "UTC") };
    let root = concat!(env!("CARGO_MANIFEST_DIR"), "/..");
    let Some(text) = forge_core::testing::fixtures::read("components.ndjson") else {
        eprintln!("component corpus not recorded; skipping");
        return;
    };
    // The frontend packages installed by `npm ci` in rust/examples-app.
    let node_modules = format!("{root}/examples-app/node_modules");
    let engine = RunjucksEngine::new([format!("{node_modules}/govuk-frontend/dist"), format!("{node_modules}/@ministryofjustice/frontend"), forge_moj_components::templates_dir().display().to_string()]);
    let (mut checked, mut failures) = (0, Vec::new());
    let updating = forge_core::testing::fixtures::updating();
    let mut updated: Vec<serde_json::Value> = Vec::new();
    for line in text.lines() {
        let row: Value = serde_json::from_str(line).unwrap();
        updated.push(row.to_json());
        let variant = row.get("variant").to_js_string();
        let Some((template, params)) = forge_moj_components::params_for(&variant) else { continue };
        checked += 1;
        let block = decode(&row.get("block"));
        let recorded = row.get("renders").get("0");
        let got = params(&block);
        if updating {
            let html = engine.render(template, &Value::from_pairs([("params", got.clone())])).expect("render");
            let mut render = recorded.clone();
            render.set("template", Value::from(template));
            let mut context = render.get("context");
            context.set("params", encode(&got));
            render.set("context", context);
            // Keep the recorded HTML when only the clock differs, so updates do not churn.
            let now = regex::Regex::new(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}").unwrap();
            let recorded_html = recorded.get("html").to_js_string();
            let same = now.replace_all(&html, "<now>") == now.replace_all(&recorded_html, "<now>");
            render.set("html", Value::from(if same { recorded_html } else { html }));
            let renders = row.get("renders");
            let mut list: Vec<Value> = renders.as_array().map(|a| a.to_vec()).unwrap_or_default();
            list[0] = render;
            let renders = Value::array(list);
            let mut row = row.clone();
            row.set("renders", renders);
            *updated.last_mut().unwrap() = row.to_json();
            continue;
        }
        let expected = decode(&recorded.get("context").get("params"));
        if template != recorded.get("template").as_str().unwrap_or_default() {
            failures.push(format!("{variant}: template {template} != {:?}", recorded.get("template")));
            continue;
        }
        if !Value::from_json(&got.to_json()).deep_eq(&Value::from_json(&expected.to_json())) {
            failures.push(format!("{variant}: params\n  rust={:?}\n  ts  ={:?}", got, expected));
            continue;
        }
        let html = engine.render(template, &Value::from_pairs([("params", got)]));
        // A timeline item without a timestamp formats "now"; mask the clock on both sides.
        static NOW: std::sync::LazyLock<regex::Regex> =
            std::sync::LazyLock::new(|| regex::Regex::new(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}").unwrap());
        let mask = |s: &str| NOW.replace_all(s, "<now>").into_owned();
        match (html.map(|h| mask(&h)), recorded.get("html").as_str().map(mask).as_deref()) {
            (Ok(h), Some(e)) if h == e => {}
            (Ok(h), Some(e)) => {
                let at = h.chars().zip(e.chars()).take_while(|(a, b)| a == b).count();
                let window = |s: &str| s.chars().skip(at.saturating_sub(40)).take(120).collect::<String>();
                failures.push(format!("{variant}: html differs at {at}\n  rust={:?}\n  ts  ={:?}", window(&h), window(e)))
            }
            (h, e) => failures.push(format!("{variant}: html differs\n  rust={h:?}\n  ts  ={e:?}")),
        }
    }
    if updating {
        forge_core::testing::fixtures::write_ndjson("components.ndjson", &updated);
        return;
    }
    eprintln!("moj components: {checked} renders checked, {} failed", failures.len());
    for f in failures.iter().take(15) {
        eprintln!("  {f}");
    }
    assert!(failures.is_empty());
}
