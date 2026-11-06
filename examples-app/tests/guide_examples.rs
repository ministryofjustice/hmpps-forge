//! The guide's complete code examples, compiled and run, so the documented code stays correct.
//! Each module holds an example exactly as the guide shows it (keep them in sync when editing
//! the page it names).

use forge_core::testing::{ForgeTestHarness, TestRequestOptions};
use forge_core::{ForgeOptions, obj};

/// `get-started/creating-your-first-journey`: the feedback journey.
mod first_journey {
    use forge_core::authoring::*;
    use forge_core::{Value, obj};
    use forge_govuk_components::blocks as govuk;

    fn name_step() -> Value {
        step(obj! {
            "path": "/",
            "title": "What is your name?",
            "reachability": obj! { "entryWhen": true },
            "blocks": [
                govuk::TEXT_INPUT.build(obj! {
                    "code": "fullName",
                    "label": obj! {
                        "text": "What is your name?",
                        "isPageHeading": true,
                        "classes": "govuk-label--l",
                    },
                }),
                govuk::BUTTON.build(obj! { "text": "Continue" }),
            ],
            "onSubmission": [submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "next": [redirect(obj! { "goto": "your-feedback" })],
                },
            })],
        })
    }

    fn feedback_step() -> Value {
        step(obj! {
            "path": "/your-feedback",
            "title": "Your feedback",
            "blocks": [
                govuk::TEXTAREA.build(obj! {
                    "code": "feedback",
                    "label": obj! {
                        "text": "Your feedback",
                        "isPageHeading": true,
                        "classes": "govuk-label--l",
                    },
                    "hint": obj! { "text": "Tell us what you think of this service." },
                }),
                govuk::BUTTON.build(obj! { "text": "Send feedback" }),
            ],
            "onSubmission": [submit(obj! {
                "validate": true,
                "onValid": obj! {
                    "next": [redirect(obj! { "goto": "confirmation" })],
                },
            })],
        })
    }

    fn confirmation_step() -> Value {
        step(obj! {
            "path": "/confirmation",
            "title": "Feedback sent",
            "blocks": [govuk::PANEL.build(obj! { "titleText": "Feedback sent" })],
        })
    }

    pub fn feedback_journey() -> Value {
        journey(obj! {
            "code": "feedback",
            "title": "Give feedback",
            "path": "/feedback",
            "view": obj! { "template": "partials/form-step" },
            "steps": [name_step(), feedback_step(), confirmation_step()],
        })
    }

    pub mod package {
        use forge_core::ForgePackage;

        pub fn package() -> ForgePackage {
            ForgePackage::new(super::feedback_journey())
        }
    }
}

#[tokio::test]
async fn first_journey_runs() {
    let mut harness = ForgeTestHarness::new(ForgeOptions::default());
    harness.register_global_components(forge_govuk_components::components()).unwrap();
    harness.register_package(first_journey::package::package()).unwrap();
    let client = harness.create_client(None);

    let page = client.get("/feedback", TestRequestOptions::default()).await.unwrap();
    assert!(page.context().is_some(), "the name page renders");
    let next = client.post("/feedback", TestRequestOptions::body(obj! { "fullName": "Ada" })).await.unwrap();
    assert_eq!(next.redirect_url(), Some("/feedback/your-feedback"));
}

/// `get-started/using-forge-with-topcoat-and-runjucks`: "Putting it together", without starting
/// the server.
#[test]
fn adapter_setup_builds_a_router() {
    use std::sync::Arc;

    use forge_core::Forge;
    use forge_runjucks::{RunjucksEngine, RunjucksRenderer};
    use forge_topcoat::{AdapterOptions, mount};
    use topcoat::router::Router;

    // Forge
    let mut forge = Forge::new(ForgeOptions::default());
    forge.register_global_components(forge_govuk_components::components()).expect("GOV.UK components");
    forge.register_global_components(forge_moj_components::components()).expect("MOJ components");
    forge.register_package(first_journey::package::package()).expect("feedback journey");

    // Template engine
    let engine = RunjucksEngine::new([
        "views".into(),
        "node_modules/govuk-frontend/dist".into(),
        "node_modules/@ministryofjustice/frontend".into(),
        forge_moj_components::templates_dir(),
    ]);
    let mut renderer = RunjucksRenderer::new(engine);
    renderer.default_template = "partials/form-step".into();

    // Routes
    let options = AdapterOptions { csrf: true, state: obj! { "serviceName": "My service" }, ..AdapterOptions::default() };
    // The first step's path "/" shares the journey's URL: the step is served.
    let _router = mount(Router::builder(), Arc::new(forge), Arc::new(renderer), options).build();
}

/// `get-started/why-use-forge`: the add-trip step (built, not registered: its effects are the
/// app's own).
#[test]
fn why_use_forge_step_builds() {
    use forge_core::authoring::*;
    use forge_govuk_components::blocks as govuk;
    use forge_govuk_components::validations;

    let add_trip_step = step(obj! {
        "path": "/add-trip",
        "title": "Add a trip",
        "blocks": [
            govuk::SELECT_INPUT.build(obj! {
                "code": "tripCountry",
                "label": obj! { "text": "Which country did you visit?" },
                "items": data("countries"),
                "validWhen": [validation(obj! {
                    "condition": self_().matches(condition::is_required()),
                    "message": "Select a country",
                })],
            }),
            govuk::DATE_INPUT_FULL.build(obj! {
                "code": "tripDepartureDate",
                "fieldset": obj! {
                    "legend": obj! { "text": "Departure date" },
                },
                "validWhen": validations::date_input_full(obj! {
                    "empty": "Enter a departure date",
                    "missingDay": "Departure date must include a day",
                    "missingMonth": "Departure date must include a month",
                    "missingYear": "Departure date must include a year",
                    "invalid": "Enter a valid departure date",
                }),
            }),
            govuk::DATE_INPUT_FULL.build(obj! {
                "code": "tripReturnDate",
                "fieldset": obj! {
                    "legend": obj! { "text": "Return date" },
                },
                "validWhen": concat([
                    validations::date_input_full(obj! {
                        "empty": "Enter a return date",
                        "missingDay": "Return date must include a day",
                        "missingMonth": "Return date must include a month",
                        "missingYear": "Return date must include a year",
                        "invalid": "Enter a valid return date",
                    }),
                    validation(obj! {
                        "condition": self_().matches(condition::date::is_after(answer("tripDepartureDate"))),
                        "message": "Return date must be after the departure date",
                    }),
                ]),
            }),
            govuk::BUTTON.build(obj! { "text": "Save and continue" }),
        ],
        "onAccess": [access(obj! {
            "effects": [effect::call("LoadCountries", vec![])],
        })],
        "onSubmission": [submit(obj! {
            "validate": true,
            "onValid": obj! {
                "effects": [effect::call("SaveAnswers", vec![])],
                "next": [redirect(obj! { "goto": "check-answers" })],
            },
        })],
    });
    assert_eq!(add_trip_step.get("type").as_str(), Some("StructureType.Step"));
}

/// `building-journeys/testing`: the harness snippets, against a small journey whose
/// `SaveRecord` effect calls a service the package captures.
mod testing_page {
    use std::sync::{Arc, Mutex};

    use forge_core::authoring::*;
    use forge_core::testing::{ForgeTestHarness, TestRequestOptions, TestResult};
    use forge_core::{ForgeOptions, ForgePackage, FunctionEntry, Value, obj};
    use forge_govuk_components::blocks as govuk;

    pub trait RecordApi: Send + Sync {
        fn save_record(&self, record: Value);
    }

    fn my_journey() -> Value {
        journey(obj! {
            "code": "my-journey",
            "path": "/my-journey",
            "title": "My journey",
            "steps": [
                step(obj! {
                    "path": "/step-one",
                    "title": "What is your name?",
                    "reachability": obj! { "entryWhen": true },
                    "blocks": [govuk::TEXT_INPUT.build(obj! {
                        "code": "firstName",
                        "label": obj! { "text": "First name" },
                        "validWhen": [validation(obj! {
                            "condition": self_().matches(condition::is_required()),
                            "message": "Enter your first name",
                        })],
                    })],
                    "onSubmission": [submit(obj! {
                        "validate": true,
                        "onValid": obj! {
                            "effects": [effect::call("SaveRecord", vec![])],
                            "next": [redirect(obj! { "goto": "step-two" })],
                        },
                    })],
                }),
                step(obj! { "path": "/step-two", "title": "Done" }),
            ],
        })
    }

    fn my_functions(api: Arc<dyn RecordApi>) -> Vec<FunctionEntry> {
        vec![FunctionEntry::effect("SaveRecord", move |context, _args| {
            let api = api.clone();
            async move {
                api.save_record(Value::object(context.get_all_answers()));
                Ok(())
            }
        })]
    }

    fn my_package(api: Arc<dyn RecordApi>) -> ForgePackage {
        ForgePackage::new(my_journey()).with_functions(my_functions(api))
    }

    #[derive(Default)]
    struct RecordingApi(Mutex<Vec<Value>>);

    impl RecordApi for RecordingApi {
        fn save_record(&self, record: Value) {
            self.0.lock().unwrap().push(record);
        }
    }

    #[tokio::test]
    async fn snippets_run() -> Result<(), Box<dyn std::error::Error>> {
        // Substituting services
        let api = Arc::new(RecordingApi::default());

        let mut harness = ForgeTestHarness::new(ForgeOptions::default());
        harness.register_global_components(forge_govuk_components::components())?;
        harness.register_package(my_package(api.clone()))?;
        let client = harness.create_client(None);

        client
            .post("/my-journey/step-one", TestRequestOptions::body(obj! { "firstName": "Sam" }))
            .await?;

        assert_eq!(api.0.lock().unwrap()[0].get("firstName"), Value::from("Sam"));

        // Render results
        let result = client.get("/my-journey/step-one", TestRequestOptions::session(obj! { "user": "test" })).await?;
        if let TestResult::Render { context, .. } = &result {
            assert_eq!(context.get("showValidationFailures"), Value::Bool(false));
        } else {
            panic!("expected a render");
        }
        assert_eq!(result.blocks_by_variant("govukTextInput").len(), 1);

        // Redirect results
        let result = client
            .post("/my-journey/step-one", TestRequestOptions::body(obj! { "firstName": "Sam" }))
            .await?;
        assert!(result.redirect_url().expect("redirected").contains("step-two"));

        // Validation errors
        let result = client.post("/my-journey/step-one", TestRequestOptions::body(obj! {})).await?;
        let errors = result.validation_errors_for("firstName");
        assert_eq!(errors.len(), 1);
        assert_eq!(errors[0].get("message"), Value::from("Enter your first name"));
        assert_eq!(result.context().expect("rendered").get("showValidationFailures"), Value::Bool(true));

        // Replacing an effect
        let recorded = Arc::new(Mutex::new(Vec::new()));
        let seen = recorded.clone();
        let mut functions: Vec<FunctionEntry> =
            my_functions(api.clone()).into_iter().filter(|f| &*f.name != "SaveRecord").collect();
        functions.push(FunctionEntry::effect("SaveRecord", move |_context, args| {
            seen.lock().unwrap().push(args);
            async { Ok(()) }
        }));
        let mut harness = ForgeTestHarness::new(ForgeOptions::default());
        harness.register_global_components(forge_govuk_components::components())?;
        harness.register_package(ForgePackage::new(my_journey()).with_functions(functions))?;
        let client = harness.create_client(None);
        client
            .post("/my-journey/step-one", TestRequestOptions::body(obj! { "firstName": "Sam" }))
            .await?;
        assert_eq!(recorded.lock().unwrap().len(), 1);
        Ok(())
    }
}

/// `building-journeys/shaping-data` and `building-functions-and-components/inline-functions`:
/// anonymous registration on a `Functions` collector.
#[tokio::test]
async fn inline_transformer_runs() -> Result<(), Box<dyn std::error::Error>> {
    use forge_core::authoring::*;
    use forge_core::{ForgePackage, Value};
    use forge_govuk_components::blocks as govuk;

    let functions = Functions::new();
    let to_upper = functions.transformer(|value, _args| Ok(Value::from(value.to_js_string().to_uppercase())));
    let journey = journey(obj! {
        "code": "inline",
        "path": "/inline",
        "title": "Inline",
        "steps": [step(obj! {
            "path": "/page",
            "title": "Page",
            "reachability": obj! { "entryWhen": true },
            "blocks": [govuk::BODY.build(obj! { "text": query("name").pipe([to_upper.call(vec![])]) })],
        })],
    });
    let mut harness = ForgeTestHarness::new(ForgeOptions::default());
    harness.register_global_components(forge_govuk_components::components())?;
    harness.register_package(ForgePackage::new(journey).with_functions(&functions))?;
    let client = harness.create_client(None);
    let result = client.get("/inline/page", TestRequestOptions { query: obj! { "name": "sam" }, ..TestRequestOptions::default() }).await?;
    let body = &result.blocks_by_variant("govukBody")[0];
    assert_eq!(body.get("properties").get("text"), Value::from("SAM"));
    Ok(())
}

/// `building-functions-and-components/custom-conditions`: the declarations and their tests.
mod custom_conditions {
    use std::sync::LazyLock;

    use forge_core::authoring::condition;
    use forge_core::{ForgeError, FunctionEntry, Value};
    use regex::Regex;

    static NI_NUMBER: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^[A-Z]{2}\d{6}[A-D]$").unwrap());

    pub fn my_conditions() -> Vec<FunctionEntry> {
        vec![
            // Checks that a numeric value meets the minimum score threshold.
            // args[0] - the minimum value required for eligibility.
            FunctionEntry::condition("IsEligible", |value, args| {
                let Some(value) = value.as_f64() else {
                    return Err(ForgeError::type_error("IsEligible expects a number"));
                };

                Ok(Some(value) >= args[0].as_f64())
            }),
            // Validates that the value is a correctly formatted UK National Insurance number.
            FunctionEntry::condition("IsValidNiNumber", |value, _args| {
                let Some(value) = value.as_str() else {
                    return Err(ForgeError::type_error("IsValidNiNumber expects a string"));
                };

                Ok(NI_NUMBER.is_match(&value.replace(char::is_whitespace, "")))
            }),
            // Checks that a date string falls before the given deadline.
            // args[0] - an ISO date string representing the cutoff date.
            FunctionEntry::condition("IsBeforeDeadline", |value, args| {
                let Some(value) = value.as_str() else {
                    return Err(ForgeError::type_error("IsBeforeDeadline expects a date string"));
                };

                // ISO dates (YYYY-MM-DD) sort in date order
                Ok(args[0].as_str().is_some_and(|deadline| value < deadline))
            }),
        ]
    }

    /// Checks that a numeric value meets the minimum score threshold.
    pub fn is_eligible(min_score: impl Into<Value>) -> Value {
        condition::call("IsEligible", vec![min_score.into()])
    }

    /// Validates that the value is a correctly formatted UK National Insurance number.
    pub fn is_valid_ni_number() -> Value {
        condition::call("IsValidNiNumber", vec![])
    }

    /// Checks that a date string falls before the given deadline.
    pub fn is_before_deadline(deadline: impl Into<Value>) -> Value {
        condition::call("IsBeforeDeadline", vec![deadline.into()])
    }

    mod tests {
        use super::*;
        use forge_core::{FunctionEntry, Value};

        fn condition(name: &str) -> FunctionEntry {
            my_conditions().into_iter().find(|f| &*f.name == name).unwrap()
        }

        async fn evaluate(name: &str, args: Vec<Value>) -> forge_core::ForgeResult<Value> {
            condition(name).call(args).await
        }

        mod is_eligible {
            use super::*;

            #[tokio::test]
            async fn should_return_true_when_value_meets_minimum_score() {
                // Arrange / Act / Assert
                assert_eq!(evaluate("IsEligible", vec![75.into(), 50.into()]).await.unwrap(), Value::Bool(true));
            }

            #[tokio::test]
            async fn should_return_false_when_value_is_below_minimum_score() {
                // Arrange / Act / Assert
                assert_eq!(evaluate("IsEligible", vec![30.into(), 50.into()]).await.unwrap(), Value::Bool(false));
            }

            #[tokio::test]
            async fn should_return_true_when_value_equals_minimum_score() {
                // Arrange / Act / Assert
                assert_eq!(evaluate("IsEligible", vec![50.into(), 50.into()]).await.unwrap(), Value::Bool(true));
            }

            #[tokio::test]
            async fn should_return_type_error_when_value_is_not_a_number() {
                // Arrange / Act / Assert
                let result = evaluate("IsEligible", vec!["fifty".into(), 50.into()]).await;
                assert!(matches!(result, Err(ForgeError::Type { .. })));
            }
        }

        mod is_valid_ni_number {
            use super::*;

            #[tokio::test]
            async fn should_return_true_for_a_valid_ni_number() {
                // Arrange / Act / Assert
                assert_eq!(evaluate("IsValidNiNumber", vec!["AB123456C".into()]).await.unwrap(), Value::Bool(true));
            }

            #[tokio::test]
            async fn should_return_true_when_spaces_are_present() {
                // Arrange / Act / Assert
                assert_eq!(evaluate("IsValidNiNumber", vec!["AB 12 34 56 C".into()]).await.unwrap(), Value::Bool(true));
            }

            #[tokio::test]
            async fn should_return_false_for_an_invalid_format() {
                // Arrange / Act / Assert
                assert_eq!(evaluate("IsValidNiNumber", vec!["12345".into()]).await.unwrap(), Value::Bool(false));
            }
        }
    }

    #[test]
    fn helpers_build_calls() {
        assert_eq!(is_eligible(50).get("name").as_str(), Some("IsEligible"));
        assert_eq!(is_valid_ni_number().get("arguments").as_array().map(|a| a.len()), Some(0));
        assert_eq!(is_before_deadline("2026-12-31").get("arguments").get("0"), Value::from("2026-12-31"));
    }
}

/// `building-functions-and-components/custom-transformers`: the declarations and their tests.
mod custom_transformers {
    use forge_core::authoring::transformer;
    use forge_core::jsdate::{JsDate, as_date};
    use forge_core::{ForgeError, FunctionEntry, Value};

    pub fn my_transformers() -> Vec<FunctionEntry> {
        vec![
            // Converts a date value into a human-readable relative time string like "Today" or "3 days ago".
            FunctionEntry::transformer("RelativeTime", |value, _args| {
                let date = match value.as_str() {
                    Some(s) => JsDate::parse(s),
                    None => as_date(value).ok_or_else(|| ForgeError::type_error("RelativeTime expects a string or Date"))?,
                };

                let diff_ms = JsDate::now().ms - date.ms;
                let diff_days = (diff_ms / (1000.0 * 60.0 * 60.0 * 24.0)).floor();

                Ok(Value::from(match diff_days as i64 {
                    0 => "Today".to_string(),
                    1 => "Yesterday".to_string(),
                    days => format!("{days} days ago"),
                }))
            }),
            // Shortens a string to the given length, appending the suffix if truncated.
            // args[0] - the maximum number of characters to keep.
            // args[1] - the string to append when truncation occurs.
            FunctionEntry::transformer("Truncate", |value, args| {
                let Some(value) = value.as_str() else {
                    return Err(ForgeError::type_error("Truncate expects a string"));
                };

                let max_length = args[0].as_f64().unwrap_or_default() as usize;
                if value.chars().count() <= max_length {
                    return Ok(Value::from(value));
                }

                Ok(Value::from(format!("{}{}", value.chars().take(max_length).collect::<String>(), args[1].to_js_string())))
            }),
        ]
    }

    /// Converts a date value into a human-readable relative time string.
    pub fn relative_time() -> Value {
        transformer::call("RelativeTime", vec![])
    }

    /// Shortens a string to `max_length` characters, appending `suffix` if truncated.
    pub fn truncate(max_length: impl Into<Value>, suffix: &str) -> Value {
        transformer::call("Truncate", vec![max_length.into(), suffix.into()])
    }

    mod tests {
        use super::*;
        use forge_core::{FunctionEntry, Value};

        async fn evaluate(name: &str, args: Vec<Value>) -> forge_core::ForgeResult<Value> {
            let entry: FunctionEntry = my_transformers().into_iter().find(|f| &*f.name == name).unwrap();
            entry.call(args).await
        }

        mod truncate {
            use super::*;

            #[tokio::test]
            async fn should_return_the_value_unchanged_when_shorter_than_max_length() {
                // Arrange
                let value = Value::from("short");

                // Act
                let result = evaluate("Truncate", vec![value, 10.into(), "...".into()]).await.unwrap();

                // Assert
                assert_eq!(result, Value::from("short"));
            }

            #[tokio::test]
            async fn should_truncate_and_append_suffix_when_longer_than_max_length() {
                // Arrange
                let value = Value::from("a long string that should be truncated");

                // Act
                let result = evaluate("Truncate", vec![value, 10.into(), "...".into()]).await.unwrap();

                // Assert
                assert_eq!(result, Value::from("a long str..."));
            }

            #[tokio::test]
            async fn should_return_type_error_when_value_is_not_a_string() {
                // Arrange / Act / Assert
                let result = evaluate("Truncate", vec![123.into(), 10.into(), "...".into()]).await;
                assert!(matches!(result, Err(ForgeError::Type { .. })));
            }
        }
    }

    #[tokio::test]
    async fn slugify_and_schema_examples() {
        use forge_core::schema::Schema;

        let slugify =
        FunctionEntry::transformer("Slugify", |value, _args| {
            let Some(value) = value.as_str() else {
                return Err(ForgeError::type_error("Slugify expects a string"));
            };

            let slug = value
                .to_lowercase()
                .split(|c: char| !c.is_ascii_alphanumeric())
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join("-");

            Ok(Value::from(slug))
        });
        assert_eq!(slugify.call(vec!["Hello, World!".into()]).await.unwrap(), Value::from("hello-world"));

        let schema_truncate =
        FunctionEntry::transformer("Truncate", |value, args| {
            let value = value.as_str().unwrap_or_default();
            let max_length = args[0].as_f64().unwrap_or_default() as usize;
            if value.chars().count() <= max_length {
                return Ok(Value::from(value));
            }

            Ok(Value::from(format!("{}{}", value.chars().take(max_length).collect::<String>(), args[1].to_js_string())))
        })
        .with_input(Schema::String)
        .with_arguments(Schema::Tuple(vec![
            Schema::custom("positive integer", |v| v.as_f64().is_some_and(|n| n >= 1.0 && n.fract() == 0.0)),
            Schema::String,
        ]));
        assert_eq!(schema_truncate.call(vec!["abcdef".into(), 3.into(), "~".into()]).await.unwrap(), Value::from("abc~"));
        assert!(matches!(schema_truncate.call(vec!["abc".into(), 0.into(), "~".into()]).await, Err(ForgeError::Type { .. })));
        assert_eq!(truncate(5, "...").get("name").as_str(), Some("Truncate"));
        assert_eq!(relative_time().get("name").as_str(), Some("RelativeTime"));
    }
}

/// `building-functions-and-components/custom-generators`: the declarations and their tests.
mod custom_generators {
    use std::sync::Arc;

    pub trait SequenceService: Send + Sync {
        fn next(&self) -> f64;
    }

    pub struct Services {
        pub sequence_service: Arc<dyn SequenceService>,
    }

    use std::sync::atomic::{AtomicU32, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    use forge_core::authoring::{Ex, generator};
    use forge_core::{FunctionEntry, Value};

    static SEQUENCE: AtomicU32 = AtomicU32::new(0);

    pub fn my_generators() -> Vec<FunctionEntry> {
        vec![
            // Produces a new v4 UUID (with the `uuid` crate).
            FunctionEntry::generator("NewUUID", |_args| {
                Ok(Value::from(uuid::Uuid::new_v4().to_string()))
            }),
            // Produces a unique reference number with the given prefix.
            // args[0] - the string to prepend to the generated number.
            FunctionEntry::generator("NewReferenceNumber", |args| {
                let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis();
                let sequence = SEQUENCE.fetch_add(1, Ordering::Relaxed) % 10_000;

                Ok(Value::from(format!("{}-{timestamp:x}-{sequence:04}", args[0].to_js_string()).to_uppercase()))
            }),
        ]
    }

    /// Produces a new v4 UUID.
    pub fn new_uuid() -> Ex {
        generator::call("NewUUID", vec![])
    }

    /// Produces a unique reference number with the given prefix.
    pub fn new_reference_number(prefix: impl Into<Value>) -> Ex {
        generator::call("NewReferenceNumber", vec![prefix.into()])
    }

    pub fn sequence_generators(services: Arc<Services>) -> Vec<FunctionEntry> {
        let sequence_service = services.sequence_service.clone();
        vec![FunctionEntry::generator("NextSequenceNumber", move |_args| {
            Ok(Value::from(sequence_service.next()))
        })]
    }

    mod tests {
        use super::*;
        use forge_core::{FunctionEntry, Value};

        fn generator(name: &str) -> FunctionEntry {
            my_generators().into_iter().find(|f| &*f.name == name).unwrap()
        }

        mod new_reference_number {
            use super::*;

            #[tokio::test]
            async fn should_start_with_the_given_prefix() {
                // Arrange / Act
                let result = generator("NewReferenceNumber").call(vec!["REF".into()]).await.unwrap();

                // Assert
                assert!(result.to_js_string().starts_with("REF-"));
            }
        }

        mod next_sequence_number {
            use super::*;
            use std::sync::atomic::{AtomicUsize, Ordering};

            struct StubSequence(AtomicUsize);

            impl SequenceService for StubSequence {
                fn next(&self) -> f64 {
                    self.0.fetch_add(1, Ordering::Relaxed);
                    42.0
                }
            }

            #[tokio::test]
            async fn should_call_the_sequence_service() {
                // Arrange
                let sequence = Arc::new(StubSequence(AtomicUsize::new(0)));
                let services = Arc::new(Services { sequence_service: sequence.clone() });
                let next_sequence_number = sequence_generators(services).remove(0);

                // Act
                let result = next_sequence_number.call(vec![]).await.unwrap();

                // Assert
                assert_eq!(result, Value::from(42));
                assert_eq!(sequence.0.load(Ordering::Relaxed), 1);
            }
        }
    }

    #[tokio::test]
    async fn uuid_and_helpers() {
        let uuid = my_generators()[0].call(vec![]).await.unwrap();
        assert_eq!(uuid.to_js_string().len(), 36);
        assert_eq!(Value::from(new_reference_number("REF")).get("name").as_str(), Some("NewReferenceNumber"));
        assert_eq!(Value::from(new_uuid()).get("type").as_str(), Some("FunctionType.Generator"));
    }
}

/// `building-functions-and-components/custom-effects`: the declarations and their tests, with
/// stub services.
#[allow(dead_code)]
mod custom_effects {
    use std::sync::Mutex;

    use forge_core::{ForgeError, ForgeResult};
    use forge_core::value::Map;

    pub struct Services {
        pub case_api: Arc<dyn CaseApi>,
        pub form_data_store: Arc<dyn FormDataStore>,
    }

    pub trait CaseApi: Send + Sync {
        fn get_case(&self, id: &str) -> std::pin::Pin<Box<dyn std::future::Future<Output = ForgeResult<Value>> + Send + '_>>;
    }

    pub trait FormDataStore: Send + Sync {
        fn save(&self, session_id: &str, answers: Map) -> std::pin::Pin<Box<dyn std::future::Future<Output = ForgeResult<()>> + Send + '_>>;
    }

    pub struct StubCaseApi(Value, Mutex<Vec<String>>);

    impl StubCaseApi {
        pub fn returning(value: Value) -> Self {
            Self(value, Mutex::new(Vec::new()))
        }

        pub fn requested(&self) -> Vec<String> {
            self.1.lock().unwrap().clone()
        }
    }

    impl CaseApi for StubCaseApi {
        fn get_case(&self, id: &str) -> std::pin::Pin<Box<dyn std::future::Future<Output = ForgeResult<Value>> + Send + '_>> {
            self.1.lock().unwrap().push(id.to_string());
            Box::pin(async move { Ok(self.0.clone()) })
        }
    }

    #[derive(Default)]
    pub struct StubStore(Mutex<Vec<Map>>);

    impl FormDataStore for StubStore {
        fn save(&self, _session_id: &str, answers: Map) -> std::pin::Pin<Box<dyn std::future::Future<Output = ForgeResult<()>> + Send + '_>> {
            self.0.lock().unwrap().push(answers);
            Box::pin(async { Ok(()) })
        }
    }

    pub fn stub_services() -> Arc<Services> {
        Arc::new(Services { case_api: Arc::new(StubCaseApi::returning(Value::Null)), form_data_store: Arc::new(StubStore::default()) })
    }

    use std::sync::Arc;

    use forge_core::authoring::effect;
    use forge_core::{FunctionEntry, Value, obj};

    pub fn my_effects(services: Arc<Services>) -> Vec<FunctionEntry> {
        let (case_api, form_data_store) = (services.case_api.clone(), services.form_data_store.clone());
        vec![
            // Loads case data from the API and sets it on the data context.
            // args[0] - the unique identifier of the case to load.
            FunctionEntry::effect("LoadCaseData", move |context, args| {
                let case_api = case_api.clone();
                async move {
                    let case_data = case_api.get_case(&args[0].to_js_string()).await?;

                    context.set_data("case", case_data)
                }
            }),
            // Persists all current answers to the data store.
            FunctionEntry::effect("SaveAnswers", move |context, _args| {
                let form_data_store = form_data_store.clone();
                async move {
                    let session_id = context.get_session().get("id").to_js_string();
                    let answers = context.get_all_answers();

                    form_data_store.save(&session_id, answers).await
                }
            }),
            // Collects trip field answers into a structured object and appends it to the trips array.
            FunctionEntry::effect("AddTrip", |context, _args| async move {
                let trip = obj! {
                    "country": context.get_answer("tripCountry"),
                    "departureDate": context.get_answer("tripDepartureDate"),
                    "returnDate": context.get_answer("tripReturnDate"),
                    "reason": context.get_answer("tripReason"),
                };

                let mut trips = context.get_answer("trips").as_array().map(|t| t.to_vec()).unwrap_or_default();
                trips.push(trip);
                context.set_answer("trips", Value::from(trips))?;

                context.set_answer("tripCountry", Value::Undefined)?;
                context.set_answer("tripDepartureDate", Value::Undefined)?;
                context.set_answer("tripReturnDate", Value::Undefined)?;
                context.set_answer("tripReason", Value::Undefined)?;
                Ok(())
            }),
            // Removes a trip from the trips array by its position.
            // args[0] - the zero-based index of the trip to remove.
            FunctionEntry::effect("RemoveTrip", |context, args| async move {
                let index = args[0].as_f64().unwrap_or(-1.0) as i64;
                let trips = context.get_answer("trips");
                let kept: Vec<Value> = trips.as_array().map(|t| t.iter().enumerate().filter(|(i, _)| *i as i64 != index).map(|(_, t)| t.clone()).collect()).unwrap_or_default();
                context.set_answer("trips", Value::from(kept))
            }),
        ]
    }

    /// Loads case data from the API and sets it on the data context.
    pub fn load_case_data(case_id: impl Into<Value>) -> Value {
        effect::call("LoadCaseData", vec![case_id.into()])
    }

    /// Removes a trip from the trips array by its position.
    pub fn remove_trip(index: i64) -> Value {
        assert!(index >= 0, "RemoveTrip requires a non-negative integer index");

        effect::call("RemoveTrip", vec![Value::from(index)])
    }

    mod tests {
        use super::*;
        use forge_core::testing::TestEffectContext;

        mod load_case_data {
            use super::*;

            #[tokio::test]
            async fn should_load_case_data_and_set_it_on_the_context() {
                // Arrange
                let case_data = obj! { "id": "123", "name": "Test case" };
                let case_api = Arc::new(StubCaseApi::returning(case_data.clone()));
                let services = Arc::new(Services { case_api: case_api.clone(), form_data_store: Arc::new(StubStore::default()) });

                let context = TestEffectContext::new();
                let load_case_data = effect(&my_effects(services), "LoadCaseData");

                // Act
                load_case_data.run_effect(context.context(), vec!["123".into()]).await.unwrap();

                // Assert
                assert_eq!(case_api.requested(), vec!["123".to_string()]);
                assert_eq!(context.data().get("case"), Some(&case_data));
            }
        }

        mod add_trip {
            use super::*;

            #[tokio::test]
            async fn should_append_a_trip_and_clear_temporary_fields() {
                // Arrange
                let context = TestEffectContext::new().with_answers(obj! {
                    "tripCountry": "France",
                    "tripDepartureDate": "2026-06-01",
                    "tripReturnDate": "2026-06-14",
                    "trips": [obj! { "country": "Spain", "departureDate": "2026-01-01", "returnDate": "2026-01-07" }],
                });

                let add_trip = effect(&my_effects(stub_services()), "AddTrip");

                // Act
                add_trip.run_effect(context.context(), vec![]).await.unwrap();

                // Assert
                let answers = context.answers();
                assert_eq!(answers.get("trips").and_then(|t| t.as_array()).map(|t| t.len()), Some(2));
                assert!(answers.get("tripCountry").is_none_or(|v| v.is_undefined()));
            }
        }

        fn effect(entries: &[FunctionEntry], name: &str) -> FunctionEntry {
            entries.iter().find(|f| &*f.name == name).unwrap().clone()
        }
    }

    #[allow(unused_variables)]
    mod typed {
        use super::*;

        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Trip {
            country: String,
        }

        use serde::Deserialize;

        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct MyAnswers {
            full_name: Option<String>,
            email: Option<String>,
            contact_method: Option<ContactMethod>,
            #[serde(default)]
            trips: Vec<Trip>,
        }

        #[derive(Deserialize)]
        #[serde(rename_all = "lowercase")]
        enum ContactMethod {
            Email,
            Phone,
            Text,
        }

        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct MySession {
            id: String,
            user_id: String,
        }

        #[tokio::test]
        async fn typed_answers_deserialise() {
            let entry =
                FunctionEntry::effect("SaveAnswers", |context, _args| async move {
                    let answers: MyAnswers = serde_json::from_value(Value::object(context.get_all_answers()).to_json())
                        .map_err(|e| ForgeError::type_error(e.to_string()))?;
                    let session: MySession = serde_json::from_value(context.get_session().to_json())
                        .map_err(|e| ForgeError::type_error(e.to_string()))?;

                    let name = answers.full_name;          // Option<String>
                    let method = answers.contact_method;   // Option<ContactMethod>
                    // ...
                    Ok(())
                });
            let context = forge_core::testing::TestEffectContext::new()
                .with_answers(obj! { "fullName": "Ada", "contactMethod": "email", "trips": [obj! { "country": "France" }] })
                .with_session(obj! { "id": "s1", "userId": "u1" });
            entry.run_effect(context.context(), vec![]).await.unwrap();
        }
    }

    #[tokio::test]
    async fn remove_trip_removes_by_index() {
        let context = forge_core::testing::TestEffectContext::new().with_answers(obj! { "trips": ["a", "b", "c"] });
        let remove = my_effects(stub_services()).into_iter().find(|f| &*f.name == "RemoveTrip").unwrap();
        remove.run_effect(context.context(), vec![1.into()]).await.unwrap();
        assert_eq!(context.answers().get("trips"), Some(&Value::from(vec![Value::from("a"), Value::from("c")])));
        assert_eq!(remove_trip(2).get("name").as_str(), Some("RemoveTrip"));
    }
}

/// `building-functions-and-components/inline-functions`: every inline kind, registered and run.
mod inline_functions {
    use std::sync::Arc;

    use forge_core::authoring::*;
    use forge_core::testing::{ForgeTestHarness, TestRequestOptions};
    use forge_core::{ForgeOptions, ForgePackage, ForgeResult, Value, obj};
    use forge_govuk_components::blocks as govuk;

    pub struct Api;

    impl Api {
        async fn get_overview(&self) -> ForgeResult<Value> {
            Ok(obj! { "count": 3 })
        }
    }

    pub struct Services {
        pub api: Arc<Api>,
    }

    fn content() -> Value {
        govuk::BODY.build(obj! { "text": data("overview.count") })
    }


    pub fn case_summary(functions: &Functions) -> Value {
        govuk::SUMMARY_LIST.build(obj! {
            "rows": [obj! {
                "key": obj! { "text": "Status" },
                "value": obj! {
                    "text": data("caseDetails").pipe([functions
                        .transformer(|details, _args| {
                            Ok(Value::from(if details.get("status").as_str() == Some("closed") {
                                "Closed".to_string()
                            } else {
                                format!("Open - {}", details.get("priority").to_js_string())
                            }))
                        })
                        .call(vec![])]),
                },
            }],
        })
    }

    pub fn urgent_banner(functions: &Functions) -> Value {
        govuk::BODY.build(obj! {
            "text": "This case requires immediate attention.",
            "visibleWhen": data("caseDetails").matches(
                functions
                    .condition(|details, _args| {
                        Ok(details.get("priority").as_str() == Some("urgent")
                            && details.get("status").as_str() != Some("closed"))
                    })
                    .call(vec![]),
            ),
        })
    }

    pub fn my_step(functions: &Functions, services: &Arc<Services>) -> Value {
        let api = services.api.clone();
        step(obj! {
            "path": "/overview",
            "title": "Overview",
            "reachability": obj! { "entryWhen": true },
            "onAccess": [access(obj! {
                "effects": [functions
                    .effect(move |context, _args| {
                        let api = api.clone();
                        async move {
                            let data = api.get_overview().await?;
                            context.set_data("overview", data)
                        }
                    })
                    .call(vec![])],
            })],
            "blocks": [content()],
        })
    }

    pub fn timestamp(functions: &Functions) -> Value {
        govuk::BODY.build(obj! {
            "text": functions
                .generator(|_args| Ok(Value::from(forge_core::jsdate::JsDate::now().local_fields().map(|f| f.year).unwrap_or_default().to_string())))
                .call(vec![]),
        })
    }


    pub fn status_tags(functions: &Functions) -> Vec<Value> {
        let to_status_tag = functions.transformer(|value, _args| {
            Ok(match value.as_str() {
                Some("completed") => obj! { "text": "Completed", "classes": "govuk-tag--green" },
                Some("in-progress") => obj! { "text": "In progress", "classes": "govuk-tag--blue" },
                _ => obj! { "text": "Not yet started" },
            })
        });

        let status_tag = |code: &str| answer(code).pipe([to_status_tag.call(vec![])]);

        vec![status_tag("task1Status").into(), status_tag("task2Status").into()]
    }

    #[tokio::test]
    async fn inline_functions_register_and_run() {
        let services = Arc::new(Services { api: Arc::new(Api) });
        let functions = Functions::new();
        let mut overview = my_step(&functions, &services);
        let mut blocks = overview.get("blocks").as_array().unwrap().to_vec();
        blocks.extend([case_summary(&functions), urgent_banner(&functions), timestamp(&functions)]);
        blocks.extend(status_tags(&functions).into_iter().map(|tag| govuk::TAG.build(obj! { "text": tag.clone() })));
        overview.set("blocks", Value::from(blocks));
        let journey = journey(obj! {
            "code": "inline-kinds",
            "path": "/inline-kinds",
            "title": "Inline",
            "data": obj! { "caseDetails": obj! { "status": "open", "priority": "urgent" } },
            "steps": [overview],
        });
        let mut harness = ForgeTestHarness::new(ForgeOptions::default());
        harness.register_global_components(forge_govuk_components::components()).unwrap();
        harness.register_package(ForgePackage::new(journey).with_functions(&functions)).unwrap();
        let result = harness.create_client(None).get("/inline-kinds/overview", TestRequestOptions::default()).await.unwrap();
        let bodies = result.blocks_by_variant("govukBody");
        assert_eq!(bodies[0].get("properties").get("text"), Value::from(3));
        assert_eq!(bodies.len(), 3, "urgent banner is visible");
        let rows = &result.blocks_by_variant("govukSummaryList")[0];
        assert_eq!(rows.get("properties").get("rows").get("0").get("value").get("text"), Value::from("Open - urgent"));
    }
}

/// `building-functions-and-components/custom-components`: the wrappers, renderers and tests.
#[allow(dead_code)]
mod custom_components {
    use forge_core::authoring::*;
    use forge_core::{ComponentEntry, Value, obj};
    use forge_runjucks::nunjucks_render;


    /// A card with a heading and optional body text.
    ///
    /// Props (each accepts a value or an expression):
    /// - `heading` - the card's heading.
    /// - `content` - body text shown below the heading (optional).
    /// - `outlined` - whether to show a subtle border (optional).
    pub const MY_CARD: Component = Component::basic("myCard");

    /// A star rating field.
    ///
    /// Props: `code`, `label`, `maxStars`, plus the usual field props
    /// (`validWhen`, `defaultValue`, ...).
    pub const MY_STAR_RATING: Component = Component::field("myStarRating");

    mod closure_card {
        use super::*;


        pub fn my_card() -> ComponentEntry {
            ComponentEntry::new("myCard").with_render(|block, _engine| {
                let border = if block.get("outlined").truthy() { " my-card--outlined" } else { "" };
                let content = match block.get("content") {
                    Value::Undefined | Value::Null => String::new(),
                    content => format!(r#"<p class="govuk-body">{}</p>"#, content.to_js_string()),
                };

                Ok(Value::from(format!(
                    r#"
            <div class="my-card{border}">
              <h2 class="govuk-heading-m">{}</h2>
              {content}
            </div>
          "#,
                    block.get("heading").to_js_string(),
                )))
            })
        }

        mod tests {
            use super::*;
            use forge_core::obj;

            #[test]
            fn my_card_should_include_the_heading_text() {
                // Arrange
                let block = obj! {
                    "variant": "myCard",
                    "heading": "Hello",
                    "content": "Body text",
                    "outlined": false,
                };

                // Act
                let render = my_card().render.unwrap();
                let html = render(&block, &()).unwrap().to_js_string();

                // Assert
                assert!(html.contains("Hello"));
                assert!(html.contains("Body text"));
            }
        }
    }

    mod template_card {
        use super::*;


        fn my_card_params(block: &Value) -> Value {
            obj! {
                "heading": block.get("heading"),
                "content": block.get("content"),
                "outlined": block.get("outlined"),
            }
        }

        pub fn my_card() -> ComponentEntry {
            ComponentEntry::new("myCard").with_render(nunjucks_render("components/my-card/template.njk", my_card_params))
        }

        #[test]
        fn should_pass_heading_to_the_template() {
            // Arrange
            let block = obj! {
                "variant": "myCard",
                "heading": "Hello",
            };

            // Act
            let params = my_card_params(&block);

            // Assert
            assert_eq!(params.get("heading"), Value::from("Hello"));
        }
    }

    fn render_children(children: &Value) -> String {
        children
            .as_array()
            .map(|children| children.iter().map(|child| child.get("html").to_js_string()).collect())
            .unwrap_or_default()
    }

    fn text_input_params(block: &Value) -> Value {
        let errors = block.get("errors");
        obj! {
            "id": match block.get("id") {
                Value::Undefined | Value::Null => block.get("code"),
                id => id,
            },
            "name": block.get("code"),
            "label": match block.get("label") {
                label @ Value::Object(_) => label,
                label => obj! { "text": label },
            },
            "value": block.get("value"),
            "errorMessage": match errors.as_array() {
                Some(errors) if !errors.is_empty() => obj! { "text": errors[0].get("message") },
                _ => Value::Undefined,
            },
        }
    }

    pub fn govuk_text_input() -> ComponentEntry {
        ComponentEntry::new("govukTextInput").with_render(nunjucks_render("govuk/components/input/template.njk", text_input_params))
    }

    fn escape_html(value: &str) -> String {
        value
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#39;")
    }

    pub fn my_badge() -> ComponentEntry {
        ComponentEntry::new("myBadge").with_render(|block, _engine| {
            let label = match block.get("label") {
                Value::Undefined | Value::Null => String::new(),
                label => escape_html(&label.to_js_string()),
            };

            Ok(Value::from(format!(r#"<span class="my-badge">{label}</span>"#)))
        })
    }

    #[test]
    fn snippets_run() {
        let block = obj! { "code": "dob", "value": obj! { "day": "31" }, "errors": [obj! { "message": "x", "details": obj! { "field": "day" } }] };
        let parts = block.get("value");
        let code = block.get("code").to_js_string();

        let items = [
            obj! { "name": format!("{code}[day]"),   "value": parts.get("day") },
            obj! { "name": format!("{code}[month]"), "value": parts.get("month") },
            obj! { "name": format!("{code}[year]"),  "value": parts.get("year") },
        ];
        assert_eq!(items[0].get("name"), Value::from("dob[day]"));
        let errors = block.get("errors");
        let error_details = errors.get("0").get("details");
        let has_error = errors.as_array().is_some_and(|e| !e.is_empty());

        let class_for_field = |field_name: &str| -> Option<&str> {
            if !has_error {
                return None;
            }
            match error_details.get("field").as_str() {
                None => Some("govuk-input--error"),
                Some(field) if field == field_name => Some("govuk-input--error"),
                Some(_) => None,
            }
        };
        assert_eq!(class_for_field("day"), Some("govuk-input--error"));
        assert_eq!(class_for_field("month"), None);
        assert_eq!(render_children(&Value::from(vec![obj! { "html": "<a>" }, obj! { "html": "<b>" }])), "<a><b>");
        let html = (my_badge().render.unwrap())(&obj! { "label": "<x>" }, &()).unwrap();
        assert_eq!(html, Value::from(r#"<span class="my-badge">&lt;x&gt;</span>"#));
        assert_eq!(text_input_params(&obj! { "code": "email", "label": "Email" }).get("id"), Value::from("email"));
        assert_eq!(MY_CARD.build(obj! { "heading": "Title" }).get("variant"), Value::from("myCard"));
        assert_eq!(MY_STAR_RATING.build(obj! { "code": "rating" }).get("blockType").as_str(), Some("BlockType.field"));
    }
}

/// `packages/topcoat/request-state`: an opaque request-scoped object travels through
/// request state to an effect.
mod request_state_page {
    use std::any::Any;
    use std::sync::Arc;

    use forge_core::authoring::*;
    use forge_core::testing::{ForgeTestHarness, TestRequestOptions};
    use forge_core::value::OpaqueValue;
    use forge_core::{ForgeOptions, ForgePackage, FunctionEntry, Value, obj};

    pub struct ApiClient {
        user: String,
    }

    /// An API client authenticated as the request's user.
    #[derive(Clone)]
    pub struct AuthenticatedClient(pub Arc<ApiClient>);

    impl OpaqueValue for AuthenticatedClient {
        fn view(&self) -> Value {
            Value::empty_object()
        }

        fn as_any(&self) -> &dyn Any {
            self
        }
    }

    #[tokio::test]
    async fn opaque_state_reaches_effects() {
        let effect = FunctionEntry::effect("LoadClientDetails", |context, args| async move {
            let state = context.get_state("authenticatedClient");
            let Some(AuthenticatedClient(client)) = state.downcast::<AuthenticatedClient>().cloned() else {
                return Ok(());
            };
            context.set_data("clientDetails", Value::from(format!("{} for {}", args[0].to_js_string(), client.user)))
        });
        let journey = journey(obj! {
            "code": "client",
            "path": "/client",
            "title": "Client",
            "steps": [step(obj! {
                "path": "/details",
                "title": "Details",
                "reachability": obj! { "entryWhen": true },
                "onAccess": [access(obj! { "effects": [effect::call("LoadClientDetails", vec!["CASE-1".into()])] })],
            })],
        });
        let mut harness = ForgeTestHarness::new(ForgeOptions::default());
        harness.register_package(ForgePackage::new(journey).with_functions([effect])).unwrap();
        let client = harness.create_client(None);
        let state = obj! { "authenticatedClient": Value::opaque(AuthenticatedClient(Arc::new(ApiClient { user: "ada".into() }))) };
        let result = client.get("/client/details", TestRequestOptions { state, ..TestRequestOptions::default() }).await.unwrap();
        assert_eq!(result.context().unwrap().get("data").get("clientDetails"), Value::from("CASE-1 for ada"));
    }
}
