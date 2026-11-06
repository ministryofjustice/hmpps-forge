//! The developer guide journey definition: the journey the modules in `crate::guide` build.

use forge_core::Value;

/// The guide journey.
pub fn journey() -> Value {
    crate::guide::developer_guide_journey()
}
