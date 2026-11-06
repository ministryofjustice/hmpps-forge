#![allow(unused_imports)]
//! `Generator.*` builders: function call expressions for the built-in generators.
//! Generated from the TS registrations; argument order matches the TS builders.

use crate::authoring::IntoValue;
use crate::value::Value;

/// A call to any registered generator by name (custom registries included).
pub fn call(name: &str, arguments: Vec<Value>) -> crate::authoring::Ex {
    let mut arguments = arguments;
    while arguments.last().is_some_and(Value::is_undefined) {
        arguments.pop();
    }
    crate::authoring::Ex::from_value(crate::authoring::function_call("FunctionType.Generator", name, arguments))
}

/// `Generator.FormatString`
pub fn format_string(template: impl IntoValue, rest: Vec<Value>) -> crate::authoring::Ex {
    let mut arguments = vec![template.into_value()];
    arguments.extend(rest);
    call("FormatString", arguments)
}

/// `Generator.Date.*`
pub mod date {
    use crate::authoring::IntoValue;
    use crate::value::Value;

    /// `Generator.Date.Now`
    pub fn now() -> crate::authoring::Ex {
        super::call("Date.Now", vec![])
    }

    /// `Generator.Date.Today`
    pub fn today() -> crate::authoring::Ex {
        super::call("Date.Today", vec![])
    }
}
