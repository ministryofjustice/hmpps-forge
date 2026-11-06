//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/patterns/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::patterns::add_another::step::add_another_pattern_step;
use crate::guide::modules::sections::patterns::auth_role::step::auth_role_pattern_step;
use crate::guide::modules::sections::patterns::branching::step::branching_pattern_step;
use crate::guide::modules::sections::patterns::cms_content::step::cms_content_pattern_step;
use crate::guide::modules::sections::patterns::collection_validation::step::collection_validation_pattern_step;
use crate::guide::modules::sections::patterns::composite_fields::step::composite_fields_pattern_step;
use crate::guide::modules::sections::patterns::demos::journey::pattern_demos_journey;
use crate::guide::modules::sections::patterns::edit_and_return::step::edit_and_return_pattern_step;
use crate::guide::modules::sections::patterns::inline_functions::step::inline_functions_pattern_step;
use crate::guide::modules::sections::patterns::load_reference_data::step::load_reference_data_pattern_step;
use crate::guide::modules::sections::patterns::overview::step::patterns_overview_step;
use crate::guide::modules::sections::patterns::pagination::step::pagination_pattern_step;
use crate::guide::modules::sections::patterns::pre_fill::step::pre_fill_pattern_step;
use crate::guide::modules::sections::patterns::read_only_mode::step::read_only_mode_pattern_step;
use crate::guide::modules::sections::patterns::repeating_fieldsets::step::repeating_fieldsets_pattern_step;
use crate::guide::modules::sections::patterns::resuming::step::resuming_pattern_step;
use crate::guide::modules::sections::patterns::reveal_fields::step::reveal_fields_pattern_step;
use crate::guide::modules::sections::patterns::search_and_select::step::search_and_select_pattern_step;
use crate::guide::modules::sections::patterns::single_question_per_page::step::single_question_per_page_pattern_step;
use crate::guide::modules::sections::patterns::task_list::step::task_list_pattern_step;

pub fn patterns_guide_journey() -> D {
    journey(obj! {
        "code": "patterns",
        "title": "Patterns",
        "path": "/patterns",
        "view": obj! { "locals": obj! { "showBackToTop": true } },
        "steps": arr![
            patterns_overview_step(),
            single_question_per_page_pattern_step(),
            branching_pattern_step(),
            reveal_fields_pattern_step(),
            composite_fields_pattern_step(),
            resuming_pattern_step(),
            add_another_pattern_step(),
            task_list_pattern_step(),
            load_reference_data_pattern_step(),
            pre_fill_pattern_step(),
            repeating_fieldsets_pattern_step(),
            edit_and_return_pattern_step(),
            auth_role_pattern_step(),
            read_only_mode_pattern_step(),
            search_and_select_pattern_step(),
            pagination_pattern_step(),
            inline_functions_pattern_step(),
            cms_content_pattern_step(),
            collection_validation_pattern_step(),
        ],
        "children": arr![pattern_demos_journey()],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::patterns::overview::step::__init();
        crate::guide::modules::sections::patterns::single_question_per_page::step::__init();
        crate::guide::modules::sections::patterns::branching::step::__init();
        crate::guide::modules::sections::patterns::reveal_fields::step::__init();
        crate::guide::modules::sections::patterns::composite_fields::step::__init();
        crate::guide::modules::sections::patterns::resuming::step::__init();
        crate::guide::modules::sections::patterns::add_another::step::__init();
        crate::guide::modules::sections::patterns::task_list::step::__init();
        crate::guide::modules::sections::patterns::load_reference_data::step::__init();
        crate::guide::modules::sections::patterns::pre_fill::step::__init();
        crate::guide::modules::sections::patterns::repeating_fieldsets::step::__init();
        crate::guide::modules::sections::patterns::edit_and_return::step::__init();
        crate::guide::modules::sections::patterns::auth_role::step::__init();
        crate::guide::modules::sections::patterns::read_only_mode::step::__init();
        crate::guide::modules::sections::patterns::search_and_select::step::__init();
        crate::guide::modules::sections::patterns::pagination::step::__init();
        crate::guide::modules::sections::patterns::inline_functions::step::__init();
        crate::guide::modules::sections::patterns::cms_content::step::__init();
        crate::guide::modules::sections::patterns::collection_validation::step::__init();
        crate::guide::modules::sections::patterns::demos::journey::__init();
        let _ = patterns_guide_journey();
    });
}
