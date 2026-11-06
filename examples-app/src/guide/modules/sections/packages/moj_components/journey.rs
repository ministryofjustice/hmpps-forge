//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/moj-components/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::packages::moj_components::alert::step::alert_step;
use crate::guide::modules::sections::packages::moj_components::badge::step::badge_step;
use crate::guide::modules::sections::packages::moj_components::banner::step::banner_step;
use crate::guide::modules::sections::packages::moj_components::button_menu::step::button_menu_step;
use crate::guide::modules::sections::packages::moj_components::card::step::card_step;
use crate::guide::modules::sections::packages::moj_components::card_group::step::card_group_step;
use crate::guide::modules::sections::packages::moj_components::date_picker::step::date_picker_step;
use crate::guide::modules::sections::packages::moj_components::filter::step::filter_step;
use crate::guide::modules::sections::packages::moj_components::identity_bar::step::identity_bar_step;
use crate::guide::modules::sections::packages::moj_components::interruption_card::step::interruption_card_step;
use crate::guide::modules::sections::packages::moj_components::messages::step::messages_step;
use crate::guide::modules::sections::packages::moj_components::multi_select::step::multi_select_step;
use crate::guide::modules::sections::packages::moj_components::notification_badge::step::notification_badge_step;
use crate::guide::modules::sections::packages::moj_components::overview::step::moj_components_overview_step;
use crate::guide::modules::sections::packages::moj_components::page_header_actions::step::page_header_actions_step;
use crate::guide::modules::sections::packages::moj_components::progress_bar::step::progress_bar_step;
use crate::guide::modules::sections::packages::moj_components::side_navigation::step::side_navigation_step;
use crate::guide::modules::sections::packages::moj_components::sortable_table::step::sortable_table_step;
use crate::guide::modules::sections::packages::moj_components::sub_navigation::step::sub_navigation_step;
use crate::guide::modules::sections::packages::moj_components::ticket_panel::step::ticket_panel_step;
use crate::guide::modules::sections::packages::moj_components::timeline::step::timeline_step;

pub fn moj_components_journey() -> D {
    journey(obj! {
        "code": "moj-components",
        "title": "MOJ Components",
        "path": "/moj-components",
        "metadata": obj! { "navGroup": "Component Libraries" },
        "view": obj! { "locals": obj! { "showBackToTop": true } },
        "steps": arr![
            moj_components_overview_step(),
            notification_badge_step(),
            identity_bar_step(),
            page_header_actions_step(),
            interruption_card_step(),
            alert_step(),
            badge_step(),
            banner_step(),
            button_menu_step(),
            card_step(),
            card_group_step(),
            date_picker_step(),
            filter_step(),
            messages_step(),
            multi_select_step(),
            progress_bar_step(),
            side_navigation_step(),
            sortable_table_step(),
            sub_navigation_step(),
            ticket_panel_step(),
            timeline_step(),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::packages::moj_components::overview::step::__init();
        crate::guide::modules::sections::packages::moj_components::alert::step::__init();
        crate::guide::modules::sections::packages::moj_components::banner::step::__init();
        crate::guide::modules::sections::packages::moj_components::badge::step::__init();
        crate::guide::modules::sections::packages::moj_components::button_menu::step::__init();
        crate::guide::modules::sections::packages::moj_components::card::step::__init();
        crate::guide::modules::sections::packages::moj_components::card_group::step::__init();
        crate::guide::modules::sections::packages::moj_components::date_picker::step::__init();
        crate::guide::modules::sections::packages::moj_components::filter::step::__init();
        crate::guide::modules::sections::packages::moj_components::messages::step::__init();
        crate::guide::modules::sections::packages::moj_components::multi_select::step::__init();
        crate::guide::modules::sections::packages::moj_components::progress_bar::step::__init();
        crate::guide::modules::sections::packages::moj_components::side_navigation::step::__init();
        crate::guide::modules::sections::packages::moj_components::sortable_table::step::__init();
        crate::guide::modules::sections::packages::moj_components::sub_navigation::step::__init();
        crate::guide::modules::sections::packages::moj_components::ticket_panel::step::__init();
        crate::guide::modules::sections::packages::moj_components::timeline::step::__init();
        crate::guide::modules::sections::packages::moj_components::notification_badge::step::__init();
        crate::guide::modules::sections::packages::moj_components::identity_bar::step::__init();
        crate::guide::modules::sections::packages::moj_components::page_header_actions::step::__init();
        crate::guide::modules::sections::packages::moj_components::interruption_card::step::__init();
        let _ = moj_components_journey();
    });
}
