use runjucks_core::RunjucksError;

#[test]
fn display_message() {
    let e = RunjucksError::new("bad thing");
    assert_eq!(e.to_string(), "bad thing");
}
