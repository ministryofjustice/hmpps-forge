//! The Forge Developer Guide's journey, written with the Rust authoring API.
//!
//! `modules/` holds the journey's sections, steps and pattern demos; `support` holds the shared
//! helpers and `dsl` the definition-time vocabulary they use.

pub mod dsl;
pub mod modules;
pub mod support;

use forge_core::Value;
use forge_core::authoring::IntoValue;

/// Evaluates the guide's modules in TS module order (`index.ts` imports `./journey` first). The
/// journey is pure data except for `patternStep` registering demo sources, whose first-wins
/// registry (llms.txt) depends on that order.
pub fn init() {
    modules::journey::__init();
}

/// The guide journey definition (`developerGuideJourney`), as `createForgePackage` receives it.
pub fn developer_guide_journey() -> Value {
    init();
    modules::journey::developer_guide_journey().into_value()
}
