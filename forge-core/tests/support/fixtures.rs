//! Rust ports of the TS contract fixtures (`packages/forge-core/test/contracts`): the functions
//! the contract journeys call and the dumb test components.

use std::sync::Arc;

use forge_core::Value;
use forge_core::engine::errors::ForgeError;
use forge_core::engine::registries::{ComponentEntry, FunctionEntry};
use forge_core::engine::runtime::context::EffectContext;
use forge_core::framework::CookieOptions;
use forge_core::schema::Schema;
use forge_core::value::{utf16_len, Map};

fn arg(args: &[Value], i: usize) -> Value {
    args.get(i).cloned().unwrap_or_default()
}

fn s(v: &Value) -> String {
    v.to_js_string()
}

/// `session.<key> = value` when there is a session object.
fn set_session_key(ctx: &EffectContext, key: &str, value: Value) {
    ctx.update_session(|session| {
        if session.is_object_like() {
            session.set(key, value);
        }
    });
}

fn merge_captured(ctx: &EffectContext, entries: Vec<(&str, Value)>) {
    ctx.update_session(|session| {
        if !session.is_object_like() {
            return;
        }
        let mut captured = match session.get("captured") {
            Value::Object(o) => (*o).clone(),
            _ => Map::new(),
        };
        for (k, v) in entries {
            captured.insert(k.into(), v);
        }
        session.set("captured", Value::object(captured));
    });
}

fn effect(name: &str, f: impl Fn(&EffectContext, &[Value]) -> Result<(), ForgeError> + Send + Sync + 'static) -> FunctionEntry {
    let f = Arc::new(f);
    FunctionEntry::effect(name, move |ctx, args| {
        let f = f.clone();
        async move { f(&ctx, &args) }
    })
}

fn append_to_log(ctx: &EffectContext, key: &str, marker: &str) -> Value {
    let mut log = match ctx.get_data(key) {
        Value::Array(a) => (*a).clone(),
        _ => Vec::new(),
    };
    log.push(Value::from(marker));
    let updated = Value::array(log);
    ctx.set_data(key, updated.clone()).unwrap();
    updated
}

pub fn functions() -> Vec<FunctionEntry> {
    vec![
        // semanticAnalysis.test.ts
        effect("Semantic.Emit", |_, _| Ok(())),
        effect("Semantic.Track", |_, _| Ok(())),
        // contractHelpers.ts
        effect("LoadAnswers", |ctx, a| {
            let stored = ctx.get_session().get("answers").get(&s(&arg(a, 0)));
            if let Value::Object(o) = stored {
                for (code, value) in o.iter() {
                    if !ctx.has_answer(code) {
                        ctx.set_answer(code, value.clone())?;
                    }
                }
            }
            Ok(())
        }),
        effect("LoadData", |ctx, _| {
            if let Value::Object(o) = ctx.get_session().get("data") {
                for (k, v) in o.iter() {
                    ctx.set_data(k, v.clone())?;
                }
            }
            Ok(())
        }),
        effect("SaveAnswers", |ctx, a| {
            let journey = s(&arg(a, 0));
            let answers = ctx.get_all_answers();
            ctx.update_session(|session| {
                if !session.truthy() {
                    return;
                }
                let mut all = match session.get("answers") {
                    Value::Object(o) => (*o).clone(),
                    _ => Map::new(),
                };
                let mut merged = match all.get(journey.as_str()) {
                    Some(Value::Object(o)) => (**o).clone(),
                    _ => Map::new(),
                };
                for (k, v) in answers {
                    merged.insert(k, v);
                }
                all.insert(journey.as_str().into(), Value::object(merged));
                session.set("answers", Value::object(all));
            });
            Ok(())
        }),
        // references.fixtures.ts
        effect("CaptureValue", |ctx, a| ctx.set_data(&s(&arg(a, 0)), arg(a, 1))),
        // hooks.fixtures.ts
        effect("AppendLog", |ctx, a| {
            let updated = append_to_log(ctx, "effectLog", &s(&arg(a, 0)));
            set_session_key(ctx, "effectLog", updated);
            Ok(())
        }),
        effect("SetHeader", |ctx, a| {
            ctx.set_response_header(&s(&arg(a, 0)), &s(&arg(a, 1)));
            Ok(())
        }),
        effect("SetCookie", |ctx, a| {
            ctx.set_response_cookie(&s(&arg(a, 0)), &s(&arg(a, 1)), None);
            Ok(())
        }),
        effect("SetCookieWithOptions", |ctx, a| {
            let options = CookieOptions {
                http_only: Some(true),
                secure: Some(true),
                max_age: Some(86400.0),
                same_site: Some("strict".into()),
                ..Default::default()
            };
            ctx.set_response_cookie(&s(&arg(a, 0)), &s(&arg(a, 1)), Some(options));
            Ok(())
        }),
        effect("CaptureRequest", |ctx, _| {
            let session = ctx.get_session();
            ctx.set_data("capturedPost", ctx.get_all_post_data())?;
            ctx.set_data("capturedQuery", ctx.get_all_query_params())?;
            let keys = match session.get("answers") {
                Value::Object(o) => Value::array(o.keys().map(|k| Value::String(k.clone())).collect()),
                _ => Value::array(vec![]),
            };
            ctx.set_data("sessionAnswerKeys", keys)?;
            set_session_key(ctx, "captured", Value::from_pairs([("post", ctx.get_all_post_data())]));
            Ok(())
        }),
        effect("DirectSetAnswer", |ctx, a| ctx.set_answer(&s(&arg(a, 0)), arg(a, 1))),
        effect("DirectSetData", |ctx, a| ctx.set_data(&s(&arg(a, 0)), arg(a, 1))),
        effect("DirectClearAnswer", |ctx, a| {
            ctx.clear_answer(&s(&arg(a, 0)));
            Ok(())
        }),
        effect("StoreHasAnswer", |ctx, a| ctx.set_data(&s(&arg(a, 1)), Value::Bool(ctx.has_answer(&s(&arg(a, 0)))))),
        effect("CaptureAnswerIntrospection", |ctx, a| {
            let code = s(&arg(a, 0));
            ctx.set_data("singleAnswer", ctx.get_answer(&code))?;
            ctx.set_data("allAnswers", Value::object(ctx.get_all_answers()))?;
            let history = ctx.get_answer_history(&code);
            if let Some(h) = &history {
                let v = h.to_value();
                ctx.set_data("answerHistory", Value::from_pairs([("current", v.get("current")), ("mutations", v.get("mutations"))]))?;
            }
            ctx.set_data("hasAnswerHistory", Value::Bool(history.is_some()))?;
            let keys = ctx.get_all_answer_histories().keys().map(|k| Value::String(k.clone())).collect();
            ctx.set_data("allHistoryKeys", Value::array(keys))
        }),
        effect("CaptureRequestFull", |ctx, _| {
            ctx.set_data("requestUrl", Value::from(ctx.get_request_url()))?;
            ctx.set_data("allParams", ctx.get_all_request_params())?;
            ctx.set_data("allState", ctx.get_all_state())?;
            let single_param = ctx.get_request_param("id");
            let single_query = ctx.get_query_param("page");
            let single_post = ctx.get_post_data("name");
            let single_state = ctx.get_state("user");
            let single_header = ctx.get_request_header("x-custom");
            let single_cookie = ctx.get_request_cookie("session");
            for (key, v) in [
                ("singleParam", &single_param),
                ("singleQuery", &single_query),
                ("singlePost", &single_post),
                ("singleState", &single_state),
                ("singleHeader", &single_header),
                ("singleCookie", &single_cookie),
            ] {
                if !v.is_undefined() {
                    ctx.set_data(key, v.clone())?;
                }
            }
            merge_captured(ctx, vec![("singlePost", single_post), ("singleHeader", single_header), ("singleCookie", single_cookie)]);
            Ok(())
        }),
        effect("CaptureAllData", |ctx, _| {
            merge_captured(ctx, vec![("allData", Value::object(ctx.get_all_data()))]);
            Ok(())
        }),
        effect("CaptureFieldsToClear", |ctx, _| {
            let fields = Value::array(ctx.get_fields_to_clear().into_iter().map(Value::String).collect());
            ctx.set_data("fieldsToClear", fields.clone())?;
            merge_captured(ctx, vec![("fieldsToClear", fields)]);
            Ok(())
        }),
        effect("ThrowUnhandled", |_, _| Err(ForgeError::evaluation("Unexpected token in booking data"))),
        effect("ThrowHttpError", |_, _| Err(ForgeError::http(404, "Booking not found"))),
        effect("ThrowNonError", |_, _| Err(ForgeError::NonError { display: "[object Object]".into() })),
        effect("class", |ctx, _| {
            append_to_log(ctx, "unusualEffectLog", "class");
            Ok(())
        }),
        effect("audit.log", |ctx, _| {
            append_to_log(ctx, "unusualEffectLog", "audit.log");
            Ok(())
        }),
        effect("123 effect", |ctx, _| {
            append_to_log(ctx, "unusualEffectLog", "123 effect");
            Ok(())
        }),
        FunctionEntry::condition("HasContent", |v, _| Ok(v.get("length").to_js_number() > 0.0)),
        // tracing fixtures
        effect("Ping", |ctx, _| ctx.set_data("pinged", Value::from("yes"))),
        effect("TraceExplode", |_, _| Err(ForgeError::evaluation("Access hook exploded"))),
        effect("TraceExplodeStatus", |_, _| Err(ForgeError::http(418, "Access hook rejected"))),
        // expressions.fixtures.ts
        FunctionEntry::condition("Expressions.IsYes", |v, _| Ok(v.as_str() == Some("yes"))).with_input(Schema::String),
        FunctionEntry::condition("Expressions.HasContent", |v, _| Ok(utf16_len(&v.to_js_string()) > 0)),
        FunctionEntry::transformer("Expressions.Append", |v, a| Ok(Value::from(format!("{}{}", s(v), s(&arg(a, 0))))))
            .with_input(Schema::String)
            .with_arguments(Schema::Tuple(vec![Schema::String])),
        FunctionEntry::transformer("Expressions.Measure", |v, _| Ok(Value::from(utf16_len(&s(v)))))
            .with_input(Schema::String)
            .with_output(Schema::number()),
        FunctionEntry::transformer("Expressions.MeasureBroken", |v, _| Ok(Value::from(utf16_len(&s(v)))))
            .with_input(Schema::String)
            .with_output(Schema::String),
        FunctionEntry::async_condition("Expressions.IsYesAsync", |v, _| async move { Ok(v.as_str() == Some("yes")) })
            .with_input(Schema::String),
        FunctionEntry::async_transformer("Expressions.AppendAsync", |v, a| async move {
            Ok(Value::from(format!("{}{}", s(&v), s(&arg(&a, 0)))))
        })
        .with_input(Schema::String)
        .with_arguments(Schema::Tuple(vec![Schema::String])),
        FunctionEntry::generator("Expressions.Badge", |a| Ok(Value::from(format!("#{}", s(&arg(a, 0))))))
            .with_arguments(Schema::Tuple(vec![Schema::number()])),
        effect("Expressions.SetData", |ctx, a| ctx.set_data(&s(&arg(a, 0)), arg(a, 1))),
        FunctionEntry::async_condition("Expressions.FailOnUnexpectedItem", |v, _| async move {
            if v.as_str() == Some("unexpected") {
                return Err(ForgeError::evaluation("Iterator evaluated an unnecessary item"));
            }
            Ok(v.as_str() == Some("yes"))
        }),
        FunctionEntry::generator("FailingPrimary", |_| Err(ForgeError::evaluation("primary failed"))),
        // validation.fixtures.ts
        FunctionEntry::condition("Validation.Explodes", |_, _| Err(ForgeError::evaluation("condition blew up"))),
        FunctionEntry::generator("ScopingFixed", |a| Ok(arg(a, 0))),
        FunctionEntry::generator("ScopingMutateState", |_| Ok(Value::from("mutated"))),
        FunctionEntry::generator("ScopingIdentity", |a| Ok(arg(a, 0))),
        FunctionEntry::generator("ScopingArgumentsInOrder", |a| Ok(Value::Bool(arg(a, 0).as_str() == Some("mutated")))),
        FunctionEntry::condition("ScopingEquals", |v, a| Ok(v.strict_eq(&arg(a, 0)))),
        FunctionEntry::condition("ScopingLengthBetween", |v, a| {
            let len = utf16_len(&s(v)) as f64;
            Ok(len >= arg(a, 0).to_js_number() && len <= arg(a, 1).to_js_number())
        }),
        FunctionEntry::transformer("ScopingAppendSuffix", |v, a| Ok(Value::from(format!("{}{}", s(v), s(&arg(a, 0)))))),
        // answerPreparation.cases.ts
        FunctionEntry::async_transformer("Prep.TrimAsync", |v, _| async move { Ok(Value::from(s(&v).trim())) })
            .with_input(Schema::String),
        FunctionEntry::async_transformer("Prep.ToUpperAsync", |v, _| async move { Ok(Value::from(s(&v).to_uppercase())) })
            .with_input(Schema::String),
        FunctionEntry::async_generator("Prep.DefaultNameAsync", |_| async move { Ok(Value::from("generated-name")) }),
        FunctionEntry::async_condition("Prep.EqualsAsync", |v, a| async move { Ok(v.strict_eq(&arg(&a, 0))) }),
    ]
}

/// `testComponents.ts`.
/// Contract components render nothing; contract outcomes compare render contexts, not HTML.
fn renders(entry: ComponentEntry) -> ComponentEntry {
    entry.with_render(|_, _| Ok(Value::from("")))
}

pub fn components() -> Vec<ComponentEntry> {
    let entries = vec![
        ComponentEntry::new("testTextField").with_input(Schema::String).with_error_anchor(|props| {
            match props.get("id") {
                Value::Undefined | Value::Null => props.get("code").as_str().map(str::to_string),
                id => Some(id.to_js_string()),
            }
        }),
        ComponentEntry::new("testCheckboxField").with_input(Schema::array(Schema::String)).multiple(),
        ComponentEntry::new("testStaticText"),
        ComponentEntry::new("testRadioField").with_input(Schema::String),
        ComponentEntry::new("testDateField")
            .with_input(Schema::strict_object([("year", Schema::String), ("month", Schema::String), ("day", Schema::String)])),
    ];
    entries.into_iter().map(renders).collect()
}
