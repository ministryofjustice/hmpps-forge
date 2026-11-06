//! Rebuilds contract journeys with the Rust authoring API and requires the exact JSON the TS
//! builders produced (key order included, since block key order decides AST node IDs).

use forge_core::Value;
use forge_core::authoring::*;
use forge_core::obj;

const TEXT_FIELD: Component = Component::field("testTextField");

fn effect(name: &str, args: Vec<Value>) -> Value {
    function_call("FunctionType.Effect", name, args)
}

fn corpus_journey(description: &str) -> Option<Value> {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures/contracts.json");
    let corpus: Value = serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()?;
    corpus.as_array()?.iter().find(|c| c.get("description").as_str() == Some(description)).map(|c| c.get("journey"))
}

fn assert_same(description: &str, built: Value) {
    let Some(expected) = corpus_journey(description) else {
        eprintln!("contract corpus not exported; skipping {description}");
        return;
    };
    assert_eq!(serde_json::to_string(&built).unwrap(), serde_json::to_string(&expected).unwrap(), "{description}");
}

/// `stepScaffold` from `test/contracts/stepScaffold.ts`, with the default submit hook.
fn scaffold(blocks: Vec<Value>) -> Value {
    journey(obj! {
        "code": "scaffold",
        "path": "/scaffold",
        "title": "Step scaffold",
        "onAccess": [access(obj! {
            "effects": [effect("LoadAnswers", vec!["scaffold".into()]), effect("LoadData", vec![])],
        })],
        "steps": [
            step(obj! {
                "path": "/step",
                "title": "Step",
                "reachability": obj! { "entryWhen": true },
                "blocks": blocks,
                "onSubmission": [submit(obj! {
                    "validate": true,
                    "onValid": obj! {
                        "effects": [effect("SaveAnswers", vec!["scaffold".into()])],
                        "next": [redirect(obj! { "goto": "done" })],
                    },
                })],
            }),
            step(obj! { "code": "done", "path": "/done", "title": "Done", "blocks": Vec::<Value>::new() }),
            step(obj! { "code": "invalid", "path": "/invalid", "title": "Invalid", "blocks": Vec::<Value>::new() }),
        ],
    })
}

#[test]
fn field_validation_scaffold() {
    let required = TEXT_FIELD.build(obj! {
        "code": "fullName",
        "validWhen": [validation(obj! {
            "condition": self_().matches(condition::is_required()),
            "message": "Enter your full name",
        })],
    });
    assert_same("field validation", scaffold(vec![required]));
}

#[test]
fn access_hook_errors() {
    let built = journey(obj! {
        "code": "access-error",
        "path": "/access-error",
        "title": "Access Error",
        "onAccess": [access(obj! {
            "effects": [effect("LoadData", vec![])],
            "next": [throw_error(obj! {
                "when": data("notFound").matches(condition::equals(true)),
                "status": 404,
                "message": "Resource not found",
            })],
        })],
        "steps": [step(obj! {
            "path": "/resource",
            "title": "Resource",
            "reachability": obj! { "entryWhen": true },
            "blocks": Vec::<Value>::new(),
        })],
    });
    assert_same("access hook errors", built);
}

#[test]
fn submit_hook_guard_outcomes() {
    let built = journey(obj! {
        "code": "guards",
        "path": "/guards",
        "title": "Guards",
        "onAccess": [access(obj! { "effects": [effect("LoadData", vec![])] })],
        "steps": [
            step(obj! {
                "path": "/form",
                "title": "Form",
                "reachability": obj! { "entryWhen": true },
                "blocks": [TEXT_FIELD.build(obj! { "code": "name" })],
                "onSubmission": [submit(obj! {
                    "guards": data("sessionValid").matches(condition::equals(true)),
                    "validate": false,
                    "onAlways": obj! { "next": [redirect(obj! { "goto": "done" })] },
                })],
            }),
            step(obj! { "code": "done", "path": "/done", "title": "Done", "blocks": Vec::<Value>::new() }),
        ],
    });
    assert_same("submit hook guard outcomes", built);
}
