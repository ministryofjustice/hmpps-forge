//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/demos/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::add_another::demo::journey::add_another_demo_journey;
use crate::guide::modules::sections::patterns::auth_role::demo::journey::auth_role_demo_journey;
use crate::guide::modules::sections::patterns::branching::demo::journey::branching_demo_journey;
use crate::guide::modules::sections::patterns::cms_content::demo::journey::cms_content_demo_journey;
use crate::guide::modules::sections::patterns::collection_validation::demo::journey::collection_validation_demo_journey;
use crate::guide::modules::sections::patterns::composite_fields::demo::journey::composite_fields_demo_journey;
use crate::guide::modules::sections::patterns::edit_and_return::demo::journey::edit_and_return_demo_journey;
use crate::guide::modules::sections::patterns::inline_functions::demo::journey::inline_functions_demo_journey;
use crate::guide::modules::sections::patterns::load_reference_data::demo::journey::load_reference_data_demo_journey;
use crate::guide::modules::sections::patterns::pagination::demo::journey::pagination_demo_journey;
use crate::guide::modules::sections::patterns::pre_fill::demo::journey::pre_fill_demo_journey;
use crate::guide::modules::sections::patterns::read_only_mode::demo::journey::read_only_mode_demo_journey;
use crate::guide::modules::sections::patterns::repeating_fieldsets::demo::journey::repeating_fieldsets_demo_journey;
use crate::guide::modules::sections::patterns::resuming::demo::journey::resuming_demo_journey;
use crate::guide::modules::sections::patterns::reveal_fields::demo::journey::reveal_fields_demo_journey;
use crate::guide::modules::sections::patterns::search_and_select::demo::journey::search_and_select_demo_journey;
use crate::guide::modules::sections::patterns::single_question_per_page::demo::journey::single_question_per_page_demo_journey;
use crate::guide::modules::sections::patterns::task_list::demo::journey::task_list_demo_journey;

pub fn pattern_demos_journey() -> D {
    journey(obj! {
        "code": "pattern-demos",
        "title": "Pattern demos",
        "path": "/demos",
        "metadata": obj! { "hiddenFromNav": true },
        "reachability": obj! { "disableReachabilityChecks": false },
        "steps": arr![],
        "children": arr![
            single_question_per_page_demo_journey(),
            branching_demo_journey(),
            reveal_fields_demo_journey(),
            composite_fields_demo_journey(),
            resuming_demo_journey(),
            add_another_demo_journey(),
            task_list_demo_journey(),
            load_reference_data_demo_journey(),
            pre_fill_demo_journey(),
            repeating_fieldsets_demo_journey(),
            edit_and_return_demo_journey(),
            auth_role_demo_journey(),
            read_only_mode_demo_journey(),
            search_and_select_demo_journey(),
            pagination_demo_journey(),
            inline_functions_demo_journey(),
            cms_content_demo_journey(),
            collection_validation_demo_journey(),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::single_question_per_page::demo::journey::__init();
        crate::guide::modules::sections::patterns::branching::demo::journey::__init();
        crate::guide::modules::sections::patterns::reveal_fields::demo::journey::__init();
        crate::guide::modules::sections::patterns::composite_fields::demo::journey::__init();
        crate::guide::modules::sections::patterns::resuming::demo::journey::__init();
        crate::guide::modules::sections::patterns::add_another::demo::journey::__init();
        crate::guide::modules::sections::patterns::task_list::demo::journey::__init();
        crate::guide::modules::sections::patterns::load_reference_data::demo::journey::__init();
        crate::guide::modules::sections::patterns::pre_fill::demo::journey::__init();
        crate::guide::modules::sections::patterns::repeating_fieldsets::demo::journey::__init();
        crate::guide::modules::sections::patterns::edit_and_return::demo::journey::__init();
        crate::guide::modules::sections::patterns::auth_role::demo::journey::__init();
        crate::guide::modules::sections::patterns::read_only_mode::demo::journey::__init();
        crate::guide::modules::sections::patterns::search_and_select::demo::journey::__init();
        crate::guide::modules::sections::patterns::pagination::demo::journey::__init();
        crate::guide::modules::sections::patterns::inline_functions::demo::journey::__init();
        crate::guide::modules::sections::patterns::cms_content::demo::journey::__init();
        crate::guide::modules::sections::patterns::collection_validation::demo::journey::__init();
        let _ = pattern_demos_journey();
    });
}
