//! The journey definition schemas (`concerns/dsl-validation/schemas/*`), on the zod port.
//! Key order inside each object matches the TS shapes, since it orders the reported issues.

use std::sync::LazyLock;

use super::zod::{Z, array, array_min, lazy, literal, number, object, optional, record, string, trimmed_min};
use crate::value::Value;

fn any() -> Z {
    Z::Any
}

// base.schema.ts -------------------------------------------------------------------------------

static FUNCTION_ARGUMENT: LazyLock<Z> = LazyLock::new(|| {
    Z::Union(vec![string(), number(), Z::Bool, Z::Null, array(lazy(&FUNCTION_ARGUMENT)), record(any())])
});

fn function_expr(ty: &str) -> Z {
    object(vec![("type", literal(ty)), ("name", trimmed_min(1)), ("arguments", array(lazy(&FUNCTION_ARGUMENT)))])
}

static CONDITION_FN: LazyLock<Z> = LazyLock::new(|| function_expr("FunctionType.Condition"));
static TRANSFORMER_FN: LazyLock<Z> = LazyLock::new(|| function_expr("FunctionType.Transformer"));
static EFFECT_FN: LazyLock<Z> = LazyLock::new(|| function_expr("FunctionType.Effect"));
static GENERATOR_FN: LazyLock<Z> = LazyLock::new(|| function_expr("FunctionType.Generator"));
static FUNCTION_EXPR: LazyLock<Z> =
    LazyLock::new(|| Z::Union(vec![lazy(&CONDITION_FN), lazy(&TRANSFORMER_FN), lazy(&EFFECT_FN), lazy(&GENERATOR_FN)]));

// expressions.schema.ts ------------------------------------------------------------------------

static RESOLVABLE_VALUE: LazyLock<Z> = LazyLock::new(|| {
    Z::Union(vec![
        lazy(&REFERENCE),
        lazy(&TRANSFORMER_FN),
        lazy(&GENERATOR_FN),
        lazy(&PIPELINE),
        lazy(&NULLISH),
        lazy(&ITERATE),
        array(lazy(&RESOLVABLE_VALUE)),
        string(),
        number(),
        Z::Bool,
        Z::Null,
        record(any()),
    ])
});

fn rv() -> Z {
    lazy(&RESOLVABLE_VALUE)
}

static REFERENCE: LazyLock<Z> = LazyLock::new(|| object(vec![("type", literal("ExpressionType.Reference")), ("path", array(string()))]));
static NULLISH: LazyLock<Z> = LazyLock::new(|| {
    object(vec![("type", literal("ExpressionType.Nullish")), ("input", rv()), ("fallback", optional(rv()))])
});
static PIPELINE: LazyLock<Z> = LazyLock::new(|| {
    object(vec![("type", literal("ExpressionType.Pipeline")), ("input", rv()), ("steps", array(lazy(&TRANSFORMER_FN)))])
});
static ITERATOR_CONFIG: LazyLock<Z> = LazyLock::new(|| {
    Z::Union(vec![
        object(vec![("type", literal("IteratorType.Map")), ("yield", any())]),
        object(vec![("type", literal("IteratorType.Filter")), ("predicate", any())]),
        object(vec![("type", literal("IteratorType.Find")), ("predicate", any())]),
        object(vec![("type", literal("IteratorType.Some")), ("predicate", any())]),
        object(vec![("type", literal("IteratorType.Every")), ("predicate", any())]),
        object(vec![("type", literal("IteratorType.Count")), ("predicate", any())]),
    ])
});
static ITERATE: LazyLock<Z> = LazyLock::new(|| {
    object(vec![("type", literal("ExpressionType.Iterate")), ("input", rv()), ("iterator", lazy(&ITERATOR_CONFIG))])
});

// predicates.schema.ts -------------------------------------------------------------------------

static PREDICATE: LazyLock<Z> = LazyLock::new(|| {
    Z::Union(vec![
        lazy(&PREDICATE_TEST),
        nary("PredicateType.And", &PREDICATE),
        nary("PredicateType.Or", &PREDICATE),
        nary("PredicateType.Xor", &PREDICATE),
        object(vec![("type", literal("PredicateType.Not")), ("operand", lazy(&PREDICATE))]),
        lazy(&COLLECTION_PREDICATE),
    ])
});

fn predicate() -> Z {
    lazy(&PREDICATE)
}

fn nary(ty: &str, operand: &'static LazyLock<Z>) -> Z {
    object(vec![("type", literal(ty)), ("operands", array_min(lazy(operand), 2))])
}

static COLLECTION_PREDICATE: LazyLock<Z> = LazyLock::new(|| {
    object(vec![
        ("type", literal("ExpressionType.Iterate")),
        ("input", rv()),
        (
            "iterator",
            object(vec![
                ("type", Z::Enum(vec![Value::from("IteratorType.Some"), Value::from("IteratorType.Every")])),
                ("predicate", predicate()),
            ]),
        ),
    ])
});
static PREDICATE_TEST: LazyLock<Z> = LazyLock::new(|| {
    object(vec![
        ("type", literal("PredicateType.Test")),
        ("subject", rv()),
        ("negate", Z::Bool),
        ("condition", lazy(&CONDITION_FN)),
    ])
});
static CONDITIONAL: LazyLock<Z> = LazyLock::new(|| {
    object(vec![
        ("type", literal("ExpressionType.Conditional")),
        ("predicate", predicate()),
        ("thenValue", optional(rv())),
        ("elseValue", optional(rv())),
    ])
});
static CONDITION_BRANCH: LazyLock<Z> = LazyLock::new(|| {
    Z::Union(vec![
        lazy(&CONDITION_FN),
        nary("ConditionCombinatorType.And", &CONDITION_BRANCH),
        nary("ConditionCombinatorType.Or", &CONDITION_BRANCH),
        nary("ConditionCombinatorType.Xor", &CONDITION_BRANCH),
        object(vec![("type", literal("ConditionCombinatorType.Not")), ("operand", lazy(&CONDITION_BRANCH))]),
    ])
});
static MATCH_BRANCH: LazyLock<Z> = LazyLock::new(|| {
    Z::Union(vec![
        object(vec![("condition", lazy(&CONDITION_BRANCH)), ("value", rv())]),
        object(vec![("expected", rv()), ("value", rv())]),
    ])
});
static MATCH: LazyLock<Z> = LazyLock::new(|| {
    object(vec![
        ("type", literal("ExpressionType.Match")),
        ("subject", rv()),
        ("branches", array_min(lazy(&MATCH_BRANCH), 1)),
        ("otherwise", optional(rv())),
    ])
});
static HOOK_OUTCOME: LazyLock<Z> = LazyLock::new(|| Z::Disc {
    key: "type",
    options: vec![
        (
            Value::from("Outcome.Redirect"),
            object(vec![
                ("type", literal("Outcome.Redirect")),
                ("when", optional(predicate())),
                ("goto", Z::Union(vec![string(), rv()])),
            ]),
        ),
        (
            Value::from("Outcome.ThrowError"),
            object(vec![
                ("type", literal("Outcome.ThrowError")),
                ("when", optional(predicate())),
                ("status", Z::Num { int: true, min: Some(100.0), max: Some(599.0) }),
                ("message", Z::Union(vec![string(), rv()])),
            ]),
        ),
    ],
});

// structures.schema.ts -------------------------------------------------------------------------

fn view_config() -> Z {
    object(vec![("template", optional(string())), ("locals", optional(record(any())))])
}

const DYNAMIC_MARKERS: &[&str] = &[
    "ExpressionType.Reference",
    "ExpressionType.Pipeline",
    "ExpressionType.Nullish",
    "ExpressionType.Next",
    "ExpressionType.Validation",
    "ExpressionType.Iterate",
    "ExpressionType.Conditional",
    "ExpressionType.Match",
    "ExpressionType.TieBreaker",
    "FunctionType.Condition",
    "FunctionType.Transformer",
    "FunctionType.Generator",
    "FunctionType.Effect",
    "HookType.Access",
    "HookType.Submit",
    "IteratorType.Map",
    "IteratorType.Filter",
    "IteratorType.Find",
    "IteratorType.Some",
    "IteratorType.Every",
    "IteratorType.Count",
    "Outcome.Redirect",
    "Outcome.ThrowError",
    "PredicateType.Test",
    "PredicateType.And",
    "PredicateType.Or",
    "PredicateType.Xor",
    "PredicateType.Not",
];

fn no_forge_expressions(value: &Value) -> Option<String> {
    let Value::Object(o) = value else { return None };
    let ty = o.get("type").and_then(Value::as_str)?;
    DYNAMIC_MARKERS.contains(&ty).then(|| "Forge expressions are not supported in static data".to_string())
}

static STATIC_DATA_VALUE: LazyLock<Z> = LazyLock::new(|| {
    Z::Refine(
        Box::new(Z::Union(vec![
            string(),
            number(),
            Z::Bool,
            Z::Null,
            array(lazy(&STATIC_DATA_VALUE)),
            record(lazy(&STATIC_DATA_VALUE)),
        ])),
        no_forge_expressions,
    )
});

fn static_data() -> Z {
    record(lazy(&STATIC_DATA_VALUE))
}

static RESOLVABLE_STRING: LazyLock<Z> = LazyLock::new(|| {
    Z::Union(vec![
        string(),
        lazy(&REFERENCE),
        lazy(&GENERATOR_FN),
        lazy(&PIPELINE),
        lazy(&NULLISH),
        lazy(&CONDITIONAL),
        lazy(&MATCH),
    ])
});

fn rs() -> Z {
    lazy(&RESOLVABLE_STRING)
}

static RESOLVABLE_BOOLEAN: LazyLock<Z> = LazyLock::new(|| {
    Z::Union(vec![
        Z::Bool,
        predicate(),
        lazy(&REFERENCE),
        lazy(&GENERATOR_FN),
        lazy(&PIPELINE),
        lazy(&NULLISH),
        lazy(&CONDITIONAL),
        lazy(&MATCH),
    ])
});

fn rb() -> Z {
    lazy(&RESOLVABLE_BOOLEAN)
}

fn route_metadata() -> Z {
    record(optional(rv()))
}

fn groups() -> Z {
    array(trimmed_min(1))
}

static VALIDATION: LazyLock<Z> = LazyLock::new(|| {
    object(vec![
        ("type", literal("ExpressionType.Validation")),
        ("condition", predicate()),
        ("message", rs()),
        ("submissionOnly", optional(Z::Bool)),
        ("groups", optional(groups())),
        ("details", optional(record(any()))),
    ])
});

/// A single iterate yielding validation rules is accepted in place of an array.
fn wrap_iterate(value: &Value) -> Value {
    match value {
        Value::Object(o) if o.get("type").and_then(Value::as_str) == Some("ExpressionType.Iterate") => Value::array(vec![value.clone()]),
        other => other.clone(),
    }
}

static VALID_WHEN: LazyLock<Z> = LazyLock::new(|| {
    Z::Preprocess(
        wrap_iterate,
        Box::new(array(Z::Disc {
            key: "type",
            options: vec![(Value::from("ExpressionType.Validation"), lazy(&VALIDATION)), (Value::from("ExpressionType.Iterate"), lazy(&ITERATE))],
        })),
    )
});

fn base_block() -> Vec<(&'static str, Z)> {
    vec![
        ("type", literal("StructureType.Block")),
        ("variant", string()),
        ("visibleWhen", optional(rb())),
        ("metadata", optional(record(any()))),
    ]
}

static BLOCK: LazyLock<Z> = LazyLock::new(|| {
    let mut field = base_block();
    field.extend([
        ("blockType", literal("BlockType.field")),
        ("code", rs()),
        ("defaultValue", optional(Z::Union(vec![rs(), array(rs()), lazy(&FUNCTION_EXPR)]))),
        ("formatters", optional(array(lazy(&TRANSFORMER_FN)))),
        ("parsers", optional(array(lazy(&TRANSFORMER_FN)))),
        (
            "errors",
            optional(array(object(vec![
                ("message", Z::Str { trim: true, min: Some((1, Some("Validation message must not be empty"))) }),
                ("details", optional(record(any()))),
            ]))),
        ),
        ("validWhen", optional(lazy(&VALID_WHEN))),
        ("dependentWhen", optional(predicate())),
    ]);
    let mut basic = base_block();
    basic.push(("blockType", literal("BlockType.basic")));
    Z::Disc {
        key: "blockType",
        options: vec![(Value::from("BlockType.field"), object(field)), (Value::from("BlockType.basic"), object(basic))],
    }
});

fn hook_branch() -> Z {
    object(vec![("effects", optional(array(lazy(&EFFECT_FN)))), ("next", optional(array(lazy(&HOOK_OUTCOME))))])
}

static ACCESS_HOOK: LazyLock<Z> = LazyLock::new(|| {
    object(vec![
        ("type", literal("HookType.Access")),
        ("when", optional(predicate())),
        ("effects", optional(array(lazy(&EFFECT_FN)))),
        ("next", optional(array(lazy(&HOOK_OUTCOME)))),
    ])
});
static SUBMIT_HOOK: LazyLock<Z> = LazyLock::new(|| {
    object(vec![
        ("type", literal("HookType.Submit")),
        ("when", optional(predicate())),
        ("guards", optional(predicate())),
        ("validate", optional(Z::Union(vec![Z::Bool, object(vec![("groups", array_min(trimmed_min(1), 1))])]))),
        ("onAlways", optional(hook_branch())),
        ("onValid", optional(hook_branch())),
        ("onInvalid", optional(hook_branch())),
    ])
});

static STEP: LazyLock<Z> = LazyLock::new(|| {
    object(vec![
        ("type", literal("StructureType.Step")),
        ("path", string()),
        ("blocks", optional(array(lazy(&BLOCK)))),
        ("onAccess", optional(array(lazy(&ACCESS_HOOK)))),
        ("onSubmission", optional(array(lazy(&SUBMIT_HOOK)))),
        ("validateOnEntry", optional(array(object(vec![("groups", array_min(trimmed_min(1), 1)), ("when", rb())])))),
        ("title", rs()),
        ("description", optional(rs())),
        ("view", optional(view_config())),
        (
            "reachability",
            optional(object(vec![
                ("entryWhen", optional(rb())),
                (
                    "tieBreakers",
                    optional(array(object(vec![
                        ("type", literal("ExpressionType.TieBreaker")),
                        ("priority", number()),
                        ("when", optional(predicate())),
                    ]))),
                ),
            ])),
        ),
        ("backlink", optional(string())),
        ("metadata", optional(route_metadata())),
        ("data", optional(static_data())),
        ("validWhen", optional(lazy(&VALID_WHEN))),
    ])
});

pub static JOURNEY: LazyLock<Z> = LazyLock::new(|| {
    object(vec![
        ("type", literal("StructureType.Journey")),
        ("path", string()),
        ("code", string()),
        ("onAccess", optional(array(lazy(&ACCESS_HOOK)))),
        ("steps", optional(array(lazy(&STEP)))),
        ("children", optional(array(lazy(&JOURNEY)))),
        ("title", rs()),
        ("description", optional(rs())),
        ("view", optional(view_config())),
        ("metadata", optional(route_metadata())),
        ("data", optional(static_data())),
        (
            "reachability",
            optional(object(vec![
                ("resumeWhen", optional(rb())),
                ("unreachableRedirect", optional(Z::Enum(vec![Value::from("entry"), Value::from("frontier")]))),
                ("disableReachabilityChecks", optional(Z::Bool)),
            ])),
        ),
    ])
});

