//! Engine error types (port of `engine/errors`).

use thiserror::Error;

#[derive(Debug, Error, Clone)]
pub enum ForgeError {
    #[error("{message}")]
    InvalidNode { message: String },

    #[error("Unknown node type: {}", node_type.as_deref().unwrap_or("<missing>"))]
    UnknownNodeType { node_type: Option<String> },

    #[error("Function \"{name}\" ({function_type}) is not registered")]
    UnregisteredFunction { name: String, function_type: String },

    #[error("Component \"{variant}\" is not registered")]
    UnregisteredComponent { variant: String },

    #[error("{message}")]
    Authoring { message: String },

    #[error("Duplicate route path: {message}")]
    DuplicateRoute { message: String },

    /// An aggregate registration failure, already formatted (`RegistrationErrorFormatter`).
    /// `title` is the underlying `AggregateError` message (what compilation traces report).
    #[error("{message}")]
    Registration { message: String, title: String },

    /// A JS `TypeError` from function evaluation (schema failures, bad input types).
    /// Validation conditions treat these as a failed rule rather than an error.
    #[error("{message}")]
    Type { message: String, function_type: Option<String> },

    /// Any other runtime evaluation failure.
    #[error("{message}")]
    Evaluation { message: String },

    /// An error raised by user code (an effect or function) that carries an HTTP status.
    #[error("{message}")]
    Http { status: u16, message: String },

    #[error("Forge iterator evaluation exceeded the per-request limit of {limit} iterations")]
    IteratorBudget { limit: usize },

    /// Something other than an `Error` thrown by user code (`throw { ... }`); `display` is its
    /// `String(value)`.
    #[error("{display}")]
    NonError { display: String },

    /// `ForgeRuntimeEvaluationError`: a failure inside a compiled phase function, wrapped once
    /// (at the innermost phase) with the phase it happened in.
    #[error("{}", runtime_message(phase, cause))]
    Runtime { phase: &'static str, cause: Box<ForgeError> },
}

fn runtime_message(phase: &str, cause: &ForgeError) -> String {
    let base = format!("Failed to evaluate compiled Forge {phase} function");
    match cause {
        ForgeError::NonError { .. } => base,
        cause => format!("{base}: {cause}"),
    }
}

/// Wraps phase-function failures as [`ForgeError::Runtime`].
pub trait InPhase<T> {
    fn in_phase(self, phase: &'static str) -> ForgeResult<T>;
}

impl<T> InPhase<T> for ForgeResult<T> {
    fn in_phase(self, phase: &'static str) -> ForgeResult<T> {
        self.map_err(|e| match e {
            ForgeError::Runtime { .. } => e,
            cause => ForgeError::Runtime { phase, cause: Box::new(cause) },
        })
    }
}

impl ForgeError {
    pub fn evaluation(message: impl Into<String>) -> Self {
        ForgeError::Evaluation { message: message.into() }
    }

    pub fn type_error(message: impl Into<String>) -> Self {
        ForgeError::Type { message: message.into(), function_type: None }
    }

    pub fn http(status: u16, message: impl Into<String>) -> Self {
        ForgeError::Http { status, message: message.into() }
    }

    /// The HTTP status an adapter should respond with, when the error carries one.
    pub fn status(&self) -> Option<u16> {
        match self {
            ForgeError::Http { status, .. } => Some(*status),
            ForgeError::Runtime { cause, .. } => cause.status(),
            _ => None,
        }
    }

    /// The message of the error compilation raised, before registration formatting wraps it
    /// (`CompilationTraceError.message`).
    pub fn compilation_message(&self) -> String {
        match self {
            ForgeError::Registration { title, .. } => title.clone(),
            other => other.to_string(),
        }
    }

    pub fn is_type_error(&self) -> bool {
        matches!(self, ForgeError::Type { .. })
    }
}

pub type ForgeResult<T> = Result<T, ForgeError>;
