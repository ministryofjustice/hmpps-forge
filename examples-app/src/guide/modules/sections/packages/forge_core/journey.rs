//! Ported from `examples-app/server/journeys/forge-developer-guide/sections/packages/forge-core/journey.ts`.

#![allow(unused_imports, clippy::all)]

use crate::guide::dsl::*;
use forge_core::{Value, obj};
use forge_core::authoring::{condition, generator, transformer};
use forge_core::builtins::components as core_blocks;
use forge_govuk_components::blocks as govuk;
use forge_moj_components::blocks as moj;
use crate::components as guide_blocks;
use crate::guide::modules::sections::packages::forge_core::collection_block::step::collection_block_step;
use crate::guide::modules::sections::packages::forge_core::conditions_address::step::conditions_address_step;
use crate::guide::modules::sections::packages::forge_core::conditions_array::step::conditions_array_step;
use crate::guide::modules::sections::packages::forge_core::conditions_date::step::conditions_date_step;
use crate::guide::modules::sections::packages::forge_core::conditions_email::step::conditions_email_step;
use crate::guide::modules::sections::packages::forge_core::conditions_general::step::conditions_general_step;
use crate::guide::modules::sections::packages::forge_core::conditions_number::step::conditions_number_step;
use crate::guide::modules::sections::packages::forge_core::conditions_object::step::conditions_object_step;
use crate::guide::modules::sections::packages::forge_core::conditions_phone::step::conditions_phone_step;
use crate::guide::modules::sections::packages::forge_core::conditions_string::step::conditions_string_step;
use crate::guide::modules::sections::packages::forge_core::forge_class::step::forge_class_step;
use crate::guide::modules::sections::packages::forge_core::fragment::step::fragment_step;
use crate::guide::modules::sections::packages::forge_core::generators_date::step::generators_date_step;
use crate::guide::modules::sections::packages::forge_core::html_block::step::html_block_step;
use crate::guide::modules::sections::packages::forge_core::overview::step::forge_core_overview_step;
use crate::guide::modules::sections::packages::forge_core::template_wrapper::step::template_wrapper_step;
use crate::guide::modules::sections::packages::forge_core::transformers_array::step::transformers_array_step;
use crate::guide::modules::sections::packages::forge_core::transformers_date::step::transformers_date_step;
use crate::guide::modules::sections::packages::forge_core::transformers_number::step::transformers_number_step;
use crate::guide::modules::sections::packages::forge_core::transformers_object::step::transformers_object_step;
use crate::guide::modules::sections::packages::forge_core::transformers_string::step::transformers_string_step;

pub fn forge_core_journey() -> D {
    journey(obj! {
        "code": "forge-core",
        "title": "Forge Core",
        "path": "/forge-core",
        "metadata": obj! { "navGroup": "Frameworks" },
        "view": obj! { "locals": obj! { "showBackToTop": true } },
        "steps": arr![
            forge_core_overview_step(),
            forge_class_step(),
            collection_block_step(),
            fragment_step(),
            html_block_step(),
            template_wrapper_step(),
            conditions_address_step(),
            conditions_array_step(),
            conditions_date_step(),
            conditions_email_step(),
            conditions_general_step(),
            conditions_number_step(),
            conditions_object_step(),
            conditions_phone_step(),
            conditions_string_step(),
            generators_date_step(),
            transformers_array_step(),
            transformers_date_step(),
            transformers_number_step(),
            transformers_object_step(),
            transformers_string_step(),
        ],
    })
}

/// Evaluates this module as TS does on first import (see `crate::guide::init`).
#[doc(hidden)]
pub fn __init() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        crate::guide::modules::sections::packages::forge_core::overview::step::__init();
        crate::guide::modules::sections::packages::forge_core::forge_class::step::__init();
        crate::guide::modules::sections::packages::forge_core::collection_block::step::__init();
        crate::guide::modules::sections::packages::forge_core::fragment::step::__init();
        crate::guide::modules::sections::packages::forge_core::html_block::step::__init();
        crate::guide::modules::sections::packages::forge_core::template_wrapper::step::__init();
        crate::guide::modules::sections::packages::forge_core::conditions_address::step::__init();
        crate::guide::modules::sections::packages::forge_core::conditions_array::step::__init();
        crate::guide::modules::sections::packages::forge_core::conditions_date::step::__init();
        crate::guide::modules::sections::packages::forge_core::conditions_email::step::__init();
        crate::guide::modules::sections::packages::forge_core::conditions_general::step::__init();
        crate::guide::modules::sections::packages::forge_core::conditions_number::step::__init();
        crate::guide::modules::sections::packages::forge_core::conditions_object::step::__init();
        crate::guide::modules::sections::packages::forge_core::conditions_phone::step::__init();
        crate::guide::modules::sections::packages::forge_core::conditions_string::step::__init();
        crate::guide::modules::sections::packages::forge_core::generators_date::step::__init();
        crate::guide::modules::sections::packages::forge_core::transformers_array::step::__init();
        crate::guide::modules::sections::packages::forge_core::transformers_date::step::__init();
        crate::guide::modules::sections::packages::forge_core::transformers_number::step::__init();
        crate::guide::modules::sections::packages::forge_core::transformers_object::step::__init();
        crate::guide::modules::sections::packages::forge_core::transformers_string::step::__init();
        let _ = forge_core_journey();
    });
}
