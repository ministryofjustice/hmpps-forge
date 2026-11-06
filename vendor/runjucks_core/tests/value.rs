use runjucks_core::value::value_to_string;
use serde_json::json;

#[test]
fn null_is_empty_string() {
    assert_eq!(value_to_string(&json!(null)), "");
}

#[test]
fn bool_number_string() {
    assert_eq!(value_to_string(&json!(true)), "true");
    assert_eq!(value_to_string(&json!(false)), "false");
    assert_eq!(value_to_string(&json!(42)), "42");
    assert_eq!(value_to_string(&json!(-1.5)), "-1.5");
    assert_eq!(value_to_string(&json!("café")), "café");
}

#[test]
fn array_and_object_use_json_stringification() {
    assert_eq!(value_to_string(&json!([1, 2])), "[1,2]");
    assert_eq!(value_to_string(&json!({"a": 1})), r#"{"a":1}"#);
}
