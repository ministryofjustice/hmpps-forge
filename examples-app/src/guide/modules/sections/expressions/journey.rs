//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/expressions/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::expressions::answer_and_self::step::answer_and_self_step;
use crate::guide::modules::sections::expressions::combinators::step::combinators_step;
use crate::guide::modules::sections::expressions::conditionals::step::conditionals_step;
use crate::guide::modules::sections::expressions::conditions::step::conditions_step;
use crate::guide::modules::sections::expressions::data::step::data_step;
use crate::guide::modules::sections::expressions::effects::step::effects_step;
use crate::guide::modules::sections::expressions::format::step::format_step;
use crate::guide::modules::sections::expressions::generators::step::generators_step;
use crate::guide::modules::sections::expressions::item::step::item_step;
use crate::guide::modules::sections::expressions::item_and_iterators::step::iterators_step;
use crate::guide::modules::sections::expressions::literal::step::literal_step;
use crate::guide::modules::sections::expressions::loop_::step::loop_step;
use crate::guide::modules::sections::expressions::overview::step::expressions_overview_step;
use crate::guide::modules::sections::expressions::params::step::params_step;
use crate::guide::modules::sections::expressions::post::step::post_step;
use crate::guide::modules::sections::expressions::query::step::query_step;
use crate::guide::modules::sections::expressions::request::step::request_step;
use crate::guide::modules::sections::expressions::session::step::session_step;
use crate::guide::modules::sections::expressions::transformers::step::transformers_step;

pub fn expressions_journey() -> D {
    journey(obj! {
        "code": "authoring-language",
        "title": "Authoring language",
        "path": "/authoring-language",
        "view": obj! { "locals": obj! { "showBackToTop": true } },
        "steps": arr![
            expressions_overview_step(),
            answer_and_self_step(),
            data_step(),
            params_step(),
            query_step(),
            post_step(),
            session_step(),
            request_step(),
            item_step(),
            loop_step(),
            iterators_step(),
            format_step(),
            literal_step(),
            generators_step(),
            transformers_step(),
            conditions_step(),
            effects_step(),
            combinators_step(),
            conditionals_step(),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::expressions::overview::step::__init();
        crate::guide::modules::sections::expressions::answer_and_self::step::__init();
        crate::guide::modules::sections::expressions::data::step::__init();
        crate::guide::modules::sections::expressions::params::step::__init();
        crate::guide::modules::sections::expressions::query::step::__init();
        crate::guide::modules::sections::expressions::post::step::__init();
        crate::guide::modules::sections::expressions::session::step::__init();
        crate::guide::modules::sections::expressions::request::step::__init();
        crate::guide::modules::sections::expressions::item::step::__init();
        crate::guide::modules::sections::expressions::loop_::step::__init();
        crate::guide::modules::sections::expressions::item_and_iterators::step::__init();
        crate::guide::modules::sections::expressions::format::step::__init();
        crate::guide::modules::sections::expressions::literal::step::__init();
        crate::guide::modules::sections::expressions::generators::step::__init();
        crate::guide::modules::sections::expressions::transformers::step::__init();
        crate::guide::modules::sections::expressions::conditions::step::__init();
        crate::guide::modules::sections::expressions::effects::step::__init();
        crate::guide::modules::sections::expressions::combinators::step::__init();
        crate::guide::modules::sections::expressions::conditionals::step::__init();
        let _ = expressions_journey();
    });
}
