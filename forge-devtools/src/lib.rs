//! Forge DevTools bridge (port of `@ministryofjustice/hmpps-forge/devtools`, the server half).
//!
//! The Chrome extension (`packages/forge-devtools/src/plugin`) is unchanged: this crate speaks its
//! websocket protocol. Create the server once, register it as a Forge instrumentation sink, and
//! mount its route on the app's router:
//!
//! Pass `redis_url` (or a custom `trace_channel`) when running more than one instance.
//!
//! ```ignore
//! let devtools = forge_devtools::set_up_forge_devtools(ForgeDevToolsOptions::default());
//! forge.add_instrumentation_sink(Arc::new(devtools.clone()));
//! let builder = devtools.mount(builder);
//! ```

pub mod auth;
pub mod channel;
pub mod message;
pub mod server;
pub mod session;

pub use channel::{decode_event, encode_event, RedisTraceChannel, TraceChannel, TRACE_CHANNEL};
pub use message::{build_trace_message, extract_devtools_cookie, DEVTOOLS_COOKIE_NAME};
pub use server::{set_up_forge_devtools, DevToolsLogger, DevToolsServer, ForgeDevToolsOptions, StderrLogger, DEFAULT_PATH};
