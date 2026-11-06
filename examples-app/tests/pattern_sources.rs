//! The pattern demos' code panels (`content/sections/patterns/**/*.rs`) are display versions of
//! the demo modules, written against the public API. Including every one here keeps them
//! compiling: when you add a file under `content/sections/patterns`, add it to the tree below.
//! Modules a panel imports but no panel shows are stubbed.

#![allow(dead_code, unused_imports, clippy::all)]

pub mod components {
    pub mod lottery_ball {
        include!("../content/components/lottery_ball.rs");
    }
    pub const RICH_TEXT_EDITOR: forge_core::authoring::Component = forge_core::authoring::Component::field("richTextEditor");
}

pub mod add_another {
    pub mod demo {
        pub mod add_contact {
            pub mod blocks {
                include!("../content/sections/patterns/add-another/demo/add-contact/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/add-another/demo/add-contact/step.rs");
            }
        }
        pub mod check_answers {
            pub mod blocks {
                include!("../content/sections/patterns/add-another/demo/check-answers/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/add-another/demo/check-answers/step.rs");
            }
        }
        pub mod confirmation {
            pub mod blocks {
                include!("../content/sections/patterns/add-another/demo/confirmation/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/add-another/demo/confirmation/step.rs");
            }
        }
        pub mod delete_contact {
            pub mod blocks {
                include!("../content/sections/patterns/add-another/demo/delete-contact/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/add-another/demo/delete-contact/step.rs");
            }
        }
        pub mod edit_contact {
            pub mod blocks {
                include!("../content/sections/patterns/add-another/demo/edit-contact/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/add-another/demo/edit-contact/step.rs");
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/add-another/demo/journey.rs");
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/add-another/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/add-another/demo/overview/step.rs");
            }
        }
        pub mod your_contacts {
            pub mod blocks {
                include!("../content/sections/patterns/add-another/demo/your-contacts/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/add-another/demo/your-contacts/step.rs");
            }
        }
    }
}
pub mod auth_role {
    pub mod demo {
        pub mod admin_panel {
            pub mod blocks {
                include!("../content/sections/patterns/auth-role/demo/admin-panel/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/auth-role/demo/admin-panel/step.rs");
            }
        }
        pub mod dashboard {
            pub mod blocks {
                include!("../content/sections/patterns/auth-role/demo/dashboard/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/auth-role/demo/dashboard/step.rs");
            }
        }
        pub mod guards {
            include!("../content/sections/patterns/auth-role/demo/guards.rs");
        }
        pub mod journey {
            include!("../content/sections/patterns/auth-role/demo/journey.rs");
        }
        pub mod login {
            pub mod blocks {
                include!("../content/sections/patterns/auth-role/demo/login/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/auth-role/demo/login/step.rs");
            }
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/auth-role/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/auth-role/demo/overview/step.rs");
            }
        }
    }
}
pub mod branching {
    pub mod demo {
        pub mod check_answers {
            pub mod blocks {
                include!("../content/sections/patterns/branching/demo/check-answers/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/branching/demo/check-answers/step.rs");
            }
        }
        pub mod confirmation {
            pub mod blocks {
                include!("../content/sections/patterns/branching/demo/confirmation/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/branching/demo/confirmation/step.rs");
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/branching/demo/journey.rs");
        }
        pub mod location {
            pub mod blocks {
                include!("../content/sections/patterns/branching/demo/location/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/branching/demo/location/step.rs");
            }
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/branching/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/branching/demo/overview/step.rs");
            }
        }
        pub mod phone_number {
            pub mod blocks {
                include!("../content/sections/patterns/branching/demo/phone-number/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/branching/demo/phone-number/step.rs");
            }
        }
        pub mod video_email {
            pub mod blocks {
                include!("../content/sections/patterns/branching/demo/video-email/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/branching/demo/video-email/step.rs");
            }
        }
        pub mod visit_type {
            pub mod blocks {
                include!("../content/sections/patterns/branching/demo/visit-type/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/branching/demo/visit-type/step.rs");
            }
        }
    }
}
pub mod cms_content {
    pub mod demo {
        pub mod journey {
            include!("../content/sections/patterns/cms-content/demo/journey.rs");
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/cms-content/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/cms-content/demo/overview/step.rs");
            }
        }
        pub mod posts {
            pub mod blocks {
                include!("../content/sections/patterns/cms-content/demo/posts/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/cms-content/demo/posts/step.rs");
            }
        }
        pub mod write {
            pub mod blocks {
                include!("../content/sections/patterns/cms-content/demo/write/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/cms-content/demo/write/step.rs");
            }
        }
    }
}
pub mod collection_validation {
    pub mod demo {
        pub mod agree_plan {
            pub mod blocks {
                include!("../content/sections/patterns/collection-validation/demo/agree-plan/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/collection-validation/demo/agree-plan/step.rs");
            }
        }
        pub mod confirmation {
            pub mod blocks {
                include!("../content/sections/patterns/collection-validation/demo/confirmation/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/collection-validation/demo/confirmation/step.rs");
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/collection-validation/demo/journey.rs");
        }
        pub mod manage_plan {
            pub mod blocks {
                include!("../content/sections/patterns/collection-validation/demo/manage-plan/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/collection-validation/demo/manage-plan/step.rs");
            }
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/collection-validation/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/collection-validation/demo/overview/step.rs");
            }
        }
    }
}
pub mod composite_fields {
    pub mod demo {
        pub mod address {
            pub mod blocks {
                include!("../content/sections/patterns/composite-fields/demo/address/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/composite-fields/demo/address/step.rs");
            }
        }
        pub mod check_answers {
            pub mod blocks {
                include!("../content/sections/patterns/composite-fields/demo/check-answers/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/composite-fields/demo/check-answers/step.rs");
            }
        }
        pub mod confirmation {
            pub mod blocks {
                include!("../content/sections/patterns/composite-fields/demo/confirmation/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/composite-fields/demo/confirmation/step.rs");
            }
        }
        pub mod date_of_birth {
            pub mod blocks {
                include!("../content/sections/patterns/composite-fields/demo/date-of-birth/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/composite-fields/demo/date-of-birth/step.rs");
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/composite-fields/demo/journey.rs");
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/composite-fields/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/composite-fields/demo/overview/step.rs");
            }
        }
    }
}
pub mod edit_and_return {
    pub mod demo {
        pub mod check_answers {
            pub mod blocks {
                include!("../content/sections/patterns/edit-and-return/demo/check-answers/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/edit-and-return/demo/check-answers/step.rs");
            }
        }
        pub mod confirmation {
            pub mod blocks {
                include!("../content/sections/patterns/edit-and-return/demo/confirmation/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/edit-and-return/demo/confirmation/step.rs");
            }
        }
        pub mod contact_preference {
            pub mod blocks {
                include!("../content/sections/patterns/edit-and-return/demo/contact-preference/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/edit-and-return/demo/contact-preference/step.rs");
            }
        }
        pub mod email_address {
            pub mod blocks {
                include!("../content/sections/patterns/edit-and-return/demo/email-address/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/edit-and-return/demo/email-address/step.rs");
            }
        }
        pub mod full_name {
            pub mod blocks {
                include!("../content/sections/patterns/edit-and-return/demo/full-name/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/edit-and-return/demo/full-name/step.rs");
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/edit-and-return/demo/journey.rs");
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/edit-and-return/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/edit-and-return/demo/overview/step.rs");
            }
        }
    }
}
pub mod inline_functions {
    pub mod demo {
        pub mod after {
            pub mod blocks {
                include!("../content/sections/patterns/inline-functions/demo/after/blocks.rs");
            }
            pub mod step {
                //! Not shown in the guide: stubbed.
                pub fn after_step() -> forge_core::Value { forge_core::Value::Null }
            }
        }
        pub mod before {
            pub mod blocks {
                include!("../content/sections/patterns/inline-functions/demo/before/blocks.rs");
            }
            pub mod step {
                //! Not shown in the guide: stubbed.
                pub fn before_step() -> forge_core::Value { forge_core::Value::Null }
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/inline-functions/demo/journey.rs");
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/inline-functions/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/inline-functions/demo/overview/step.rs");
            }
        }
    }
}
pub mod load_reference_data {
    pub mod demo {
        pub mod draw {
            pub mod blocks {
                include!("../content/sections/patterns/load-reference-data/demo/draw/blocks.rs");
            }
            pub mod step {
                //! Not shown in the guide: stubbed.
                pub fn draw_step() -> forge_core::Value { forge_core::Value::Null }
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/load-reference-data/demo/journey.rs");
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/load-reference-data/demo/overview/blocks.rs");
            }
            pub mod step {
                //! Not shown in the guide: stubbed.
                pub fn overview_step() -> forge_core::Value { forge_core::Value::Null }
            }
        }
    }
}
pub mod pagination {
    pub mod demo {
        pub mod detail {
            pub mod blocks {
                include!("../content/sections/patterns/pagination/demo/detail/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/pagination/demo/detail/step.rs");
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/pagination/demo/journey.rs");
        }
        pub mod list {
            pub mod blocks {
                include!("../content/sections/patterns/pagination/demo/list/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/pagination/demo/list/step.rs");
            }
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/pagination/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/pagination/demo/overview/step.rs");
            }
        }
    }
}
pub mod pre_fill {
    pub mod demo {
        pub mod check_answers {
            pub mod blocks {
                include!("../content/sections/patterns/pre-fill/demo/check-answers/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/pre-fill/demo/check-answers/step.rs");
            }
        }
        pub mod confirmation {
            pub mod blocks {
                include!("../content/sections/patterns/pre-fill/demo/confirmation/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/pre-fill/demo/confirmation/step.rs");
            }
        }
        pub mod find_address {
            pub mod blocks {
                include!("../content/sections/patterns/pre-fill/demo/find-address/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/pre-fill/demo/find-address/step.rs");
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/pre-fill/demo/journey.rs");
        }
        pub mod overview {
            pub mod step {
                //! Not shown in the guide: stubbed.
                pub fn overview_step() -> forge_core::Value { forge_core::Value::Null }
            }
        }
    }
}
pub mod read_only_mode {
    pub mod demo {
        pub mod contacts {
            pub mod blocks {
                include!("../content/sections/patterns/read-only-mode/demo/contacts/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/read-only-mode/demo/contacts/step.rs");
            }
        }
        pub mod guards {
            include!("../content/sections/patterns/read-only-mode/demo/guards.rs");
        }
        pub mod journey {
            include!("../content/sections/patterns/read-only-mode/demo/journey.rs");
        }
        pub mod login {
            pub mod blocks {
                include!("../content/sections/patterns/read-only-mode/demo/login/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/read-only-mode/demo/login/step.rs");
            }
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/read-only-mode/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/read-only-mode/demo/overview/step.rs");
            }
        }
        pub mod record {
            pub mod blocks {
                include!("../content/sections/patterns/read-only-mode/demo/record/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/read-only-mode/demo/record/step.rs");
            }
        }
    }
}
pub mod repeating_fieldsets {
    pub mod demo {
        pub mod check_answers {
            pub mod blocks {
                include!("../content/sections/patterns/repeating-fieldsets/demo/check-answers/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/repeating-fieldsets/demo/check-answers/step.rs");
            }
        }
        pub mod confirmation {
            pub mod blocks {
                include!("../content/sections/patterns/repeating-fieldsets/demo/confirmation/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/repeating-fieldsets/demo/confirmation/step.rs");
            }
        }
        pub mod household_members {
            pub mod blocks {
                include!("../content/sections/patterns/repeating-fieldsets/demo/household-members/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/repeating-fieldsets/demo/household-members/step.rs");
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/repeating-fieldsets/demo/journey.rs");
        }
        pub mod overview {
            pub mod step {
                //! Not shown in the guide: stubbed.
                pub fn overview_step() -> forge_core::Value { forge_core::Value::Null }
            }
        }
    }
}
pub mod resuming {
    pub mod demo {
        pub mod check_answers {
            pub mod blocks {
                include!("../content/sections/patterns/resuming/demo/check-answers/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/resuming/demo/check-answers/step.rs");
            }
        }
        pub mod confirmation {
            pub mod blocks {
                include!("../content/sections/patterns/resuming/demo/confirmation/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/resuming/demo/confirmation/step.rs");
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/resuming/demo/journey.rs");
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/resuming/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/resuming/demo/overview/step.rs");
            }
        }
        pub mod your_name {
            pub mod blocks {
                include!("../content/sections/patterns/resuming/demo/your-name/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/resuming/demo/your-name/step.rs");
            }
        }
        pub mod your_role {
            pub mod blocks {
                include!("../content/sections/patterns/resuming/demo/your-role/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/resuming/demo/your-role/step.rs");
            }
        }
    }
}
pub mod reveal_fields {
    pub mod demo {
        pub mod check_answers {
            pub mod blocks {
                include!("../content/sections/patterns/reveal-fields/demo/check-answers/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/reveal-fields/demo/check-answers/step.rs");
            }
        }
        pub mod confirmation {
            pub mod blocks {
                include!("../content/sections/patterns/reveal-fields/demo/confirmation/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/reveal-fields/demo/confirmation/step.rs");
            }
        }
        pub mod heard_from {
            pub mod blocks {
                include!("../content/sections/patterns/reveal-fields/demo/heard-from/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/reveal-fields/demo/heard-from/step.rs");
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/reveal-fields/demo/journey.rs");
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/reveal-fields/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/reveal-fields/demo/overview/step.rs");
            }
        }
    }
}
pub mod search_and_select {
    pub mod demo {
        pub mod journey {
            include!("../content/sections/patterns/search-and-select/demo/journey.rs");
        }
        pub mod log {
            pub mod blocks {
                include!("../content/sections/patterns/search-and-select/demo/log/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/search-and-select/demo/log/step.rs");
            }
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/search-and-select/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/search-and-select/demo/overview/step.rs");
            }
        }
        pub mod search {
            pub mod blocks {
                include!("../content/sections/patterns/search-and-select/demo/search/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/search-and-select/demo/search/step.rs");
            }
        }
    }
}
pub mod single_question_per_page {
    pub mod demo {
        pub mod check_answers {
            pub mod blocks {
                include!("../content/sections/patterns/single-question-per-page/demo/check-answers/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/single-question-per-page/demo/check-answers/step.rs");
            }
        }
        pub mod confirmation {
            pub mod blocks {
                include!("../content/sections/patterns/single-question-per-page/demo/confirmation/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/single-question-per-page/demo/confirmation/step.rs");
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/single-question-per-page/demo/journey.rs");
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/single-question-per-page/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/single-question-per-page/demo/overview/step.rs");
            }
        }
        pub mod your_name {
            pub mod blocks {
                include!("../content/sections/patterns/single-question-per-page/demo/your-name/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/single-question-per-page/demo/your-name/step.rs");
            }
        }
        pub mod your_role {
            pub mod blocks {
                include!("../content/sections/patterns/single-question-per-page/demo/your-role/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/single-question-per-page/demo/your-role/step.rs");
            }
        }
    }
}
pub mod task_list {
    pub mod demo {
        pub mod additional_needs {
            pub mod blocks {
                include!("../content/sections/patterns/task-list/demo/additional-needs/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/task-list/demo/additional-needs/step.rs");
            }
        }
        pub mod check_answers {
            pub mod blocks {
                include!("../content/sections/patterns/task-list/demo/check-answers/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/task-list/demo/check-answers/step.rs");
            }
        }
        pub mod confirmation {
            pub mod blocks {
                include!("../content/sections/patterns/task-list/demo/confirmation/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/task-list/demo/confirmation/step.rs");
            }
        }
        pub mod journey {
            include!("../content/sections/patterns/task-list/demo/journey.rs");
        }
        pub mod overview {
            pub mod blocks {
                include!("../content/sections/patterns/task-list/demo/overview/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/task-list/demo/overview/step.rs");
            }
        }
        pub mod tasks {
            pub mod blocks {
                include!("../content/sections/patterns/task-list/demo/tasks/blocks.rs");
            }
            pub mod step {
                include!("../content/sections/patterns/task-list/demo/tasks/step.rs");
            }
        }
        pub mod visit_preferences {
            pub mod journey {
                //! Not shown in the guide: stubbed.
                pub fn visit_preferences_journey() -> forge_core::Value { forge_core::Value::Null }
            }
            pub mod preferred_day {
                pub mod blocks {
                    include!("../content/sections/patterns/task-list/demo/visit-preferences/preferred-day/blocks.rs");
                }
                pub mod step {
                    include!("../content/sections/patterns/task-list/demo/visit-preferences/preferred-day/step.rs");
                }
            }
            pub mod visit_type {
                pub mod blocks {
                    include!("../content/sections/patterns/task-list/demo/visit-preferences/visit-type/blocks.rs");
                }
                pub mod step {
                    include!("../content/sections/patterns/task-list/demo/visit-preferences/visit-type/step.rs");
                }
            }
        }
        pub mod your_details {
            pub mod journey {
                //! Not shown in the guide: stubbed.
                pub fn your_details_journey() -> forge_core::Value { forge_core::Value::Null }
            }
            pub mod relationship {
                pub mod blocks {
                    include!("../content/sections/patterns/task-list/demo/your-details/relationship/blocks.rs");
                }
                pub mod step {
                    include!("../content/sections/patterns/task-list/demo/your-details/relationship/step.rs");
                }
            }
            pub mod your_name {
                pub mod blocks {
                    include!("../content/sections/patterns/task-list/demo/your-details/your-name/blocks.rs");
                }
                pub mod step {
                    include!("../content/sections/patterns/task-list/demo/your-details/your-name/step.rs");
                }
            }
        }
    }
}

#[test]
fn pattern_sources_compile() {}

/// The effects panels show `content/sections/patterns/effects.rs`, a copy of `src/effects.rs`.
#[test]
fn effects_panel_matches_the_app() {
    assert!(
        include_str!("../content/sections/patterns/effects.rs") == include_str!("../src/effects.rs"),
        "copy src/effects.rs to content/sections/patterns/effects.rs"
    );
}
