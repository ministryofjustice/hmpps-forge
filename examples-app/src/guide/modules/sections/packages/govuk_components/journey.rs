//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/govuk-components/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::packages::govuk_components::accordion::step::accordion_step;
use crate::guide::modules::sections::packages::govuk_components::back_link::step::back_link_step;
use crate::guide::modules::sections::packages::govuk_components::body::step::body_step;
use crate::guide::modules::sections::packages::govuk_components::breadcrumbs::step::breadcrumbs_step;
use crate::guide::modules::sections::packages::govuk_components::button::step::button_step;
use crate::guide::modules::sections::packages::govuk_components::button_group::step::button_group_step;
use crate::guide::modules::sections::packages::govuk_components::checkbox_input::step::checkbox_input_step;
use crate::guide::modules::sections::packages::govuk_components::date_input::step::date_input_step;
use crate::guide::modules::sections::packages::govuk_components::details::step::details_step;
use crate::guide::modules::sections::packages::govuk_components::exit_this_page::step::exit_this_page_step;
use crate::guide::modules::sections::packages::govuk_components::grid_row::step::grid_row_step;
use crate::guide::modules::sections::packages::govuk_components::heading::step::heading_step;
use crate::guide::modules::sections::packages::govuk_components::inset_text::step::inset_text_step;
use crate::guide::modules::sections::packages::govuk_components::list::step::list_step;
use crate::guide::modules::sections::packages::govuk_components::notification_banner::step::notification_banner_step;
use crate::guide::modules::sections::packages::govuk_components::overview::step::govuk_components_overview_step;
use crate::guide::modules::sections::packages::govuk_components::pagination::step::pagination_step;
use crate::guide::modules::sections::packages::govuk_components::panel::step::panel_step;
use crate::guide::modules::sections::packages::govuk_components::password_input::step::password_input_step;
use crate::guide::modules::sections::packages::govuk_components::radio_input::step::radio_input_step;
use crate::guide::modules::sections::packages::govuk_components::section_break::step::section_break_step;
use crate::guide::modules::sections::packages::govuk_components::select_input::step::select_input_step;
use crate::guide::modules::sections::packages::govuk_components::summary_list::step::summary_list_step;
use crate::guide::modules::sections::packages::govuk_components::table::step::table_step;
use crate::guide::modules::sections::packages::govuk_components::tabs::step::tabs_step;
use crate::guide::modules::sections::packages::govuk_components::tag::step::tag_step;
use crate::guide::modules::sections::packages::govuk_components::task_list::step::task_list_step;
use crate::guide::modules::sections::packages::govuk_components::text_input::step::text_input_step;
use crate::guide::modules::sections::packages::govuk_components::textarea_input::step::textarea_input_step;
use crate::guide::modules::sections::packages::govuk_components::utility_classes::step::utility_classes_step;
use crate::guide::modules::sections::packages::govuk_components::validations::step::validations_step;
use crate::guide::modules::sections::packages::govuk_components::warning_text::step::warning_text_step;

pub fn govuk_components_journey() -> D {
    journey(obj! {
        "code": "govuk-components",
        "title": "GOV.UK Components",
        "path": "/govuk-components",
        "metadata": obj! { "navGroup": "Component Libraries" },
        "view": obj! { "locals": obj! { "showBackToTop": true } },
        "steps": arr![
            govuk_components_overview_step(),
            text_input_step(),
            textarea_input_step(),
            password_input_step(),
            radio_input_step(),
            checkbox_input_step(),
            select_input_step(),
            date_input_step(),
            button_step(),
            accordion_step(),
            back_link_step(),
            breadcrumbs_step(),
            details_step(),
            exit_this_page_step(),
            inset_text_step(),
            notification_banner_step(),
            pagination_step(),
            panel_step(),
            summary_list_step(),
            table_step(),
            tabs_step(),
            tag_step(),
            task_list_step(),
            warning_text_step(),
            body_step(),
            heading_step(),
            list_step(),
            section_break_step(),
            grid_row_step(),
            button_group_step(),
            utility_classes_step(),
            validations_step(),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::packages::govuk_components::overview::step::__init();
        crate::guide::modules::sections::packages::govuk_components::text_input::step::__init();
        crate::guide::modules::sections::packages::govuk_components::textarea_input::step::__init();
        crate::guide::modules::sections::packages::govuk_components::password_input::step::__init();
        crate::guide::modules::sections::packages::govuk_components::radio_input::step::__init();
        crate::guide::modules::sections::packages::govuk_components::checkbox_input::step::__init();
        crate::guide::modules::sections::packages::govuk_components::select_input::step::__init();
        crate::guide::modules::sections::packages::govuk_components::date_input::step::__init();
        crate::guide::modules::sections::packages::govuk_components::button::step::__init();
        crate::guide::modules::sections::packages::govuk_components::accordion::step::__init();
        crate::guide::modules::sections::packages::govuk_components::back_link::step::__init();
        crate::guide::modules::sections::packages::govuk_components::breadcrumbs::step::__init();
        crate::guide::modules::sections::packages::govuk_components::details::step::__init();
        crate::guide::modules::sections::packages::govuk_components::exit_this_page::step::__init();
        crate::guide::modules::sections::packages::govuk_components::inset_text::step::__init();
        crate::guide::modules::sections::packages::govuk_components::notification_banner::step::__init();
        crate::guide::modules::sections::packages::govuk_components::pagination::step::__init();
        crate::guide::modules::sections::packages::govuk_components::panel::step::__init();
        crate::guide::modules::sections::packages::govuk_components::summary_list::step::__init();
        crate::guide::modules::sections::packages::govuk_components::table::step::__init();
        crate::guide::modules::sections::packages::govuk_components::tabs::step::__init();
        crate::guide::modules::sections::packages::govuk_components::tag::step::__init();
        crate::guide::modules::sections::packages::govuk_components::task_list::step::__init();
        crate::guide::modules::sections::packages::govuk_components::warning_text::step::__init();
        crate::guide::modules::sections::packages::govuk_components::body::step::__init();
        crate::guide::modules::sections::packages::govuk_components::heading::step::__init();
        crate::guide::modules::sections::packages::govuk_components::list::step::__init();
        crate::guide::modules::sections::packages::govuk_components::section_break::step::__init();
        crate::guide::modules::sections::packages::govuk_components::grid_row::step::__init();
        crate::guide::modules::sections::packages::govuk_components::button_group::step::__init();
        crate::guide::modules::sections::packages::govuk_components::utility_classes::step::__init();
        crate::guide::modules::sections::packages::govuk_components::validations::step::__init();
        let _ = govuk_components_journey();
    });
}
