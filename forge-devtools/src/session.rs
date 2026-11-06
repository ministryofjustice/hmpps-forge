//! One connected panel (port of `session/DevToolsSession.ts`).

use serde_json::{json, Value as Json};
use tokio::sync::mpsc::UnboundedSender;

use crate::auth::{generate_code, now_ms, random_hex, validate_code, CodeValidation, PendingCode, MAX_ATTEMPTS};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SessionState {
    AwaitingCode,
    Authenticated,
    Rejected,
}

/// Outgoing frames for the socket task (the TS session writes to the socket directly).
#[derive(Debug)]
pub enum Outgoing {
    Text(String),
    Close,
}

pub struct DevToolsSession {
    id: String,
    state: SessionState,
    pending: PendingCode,
    cookie: Option<String>,
    tx: UnboundedSender<Outgoing>,
}

impl DevToolsSession {
    pub fn new(tx: UnboundedSender<Outgoing>) -> Self {
        Self { id: random_hex(2), state: SessionState::AwaitingCode, pending: generate_code(), cookie: None, tx }
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn state(&self) -> SessionState {
        self.state
    }

    pub fn code(&self) -> &str {
        &self.pending.code
    }

    pub fn code_expires_in_ms(&self) -> u64 {
        self.pending.expires_at.saturating_sub(now_ms())
    }

    pub fn cookie_value(&self) -> Option<&str> {
        self.cookie.as_deref()
    }

    pub fn remaining_attempts(&self) -> u32 {
        MAX_ATTEMPTS.saturating_sub(self.pending.attempts)
    }

    fn authenticate(&mut self) {
        self.state = SessionState::Authenticated;
        let cookie = random_hex(32);
        self.send(&json!({ "type": "auth:success", "cookie": cookie }));
        self.cookie = Some(cookie);
    }

    pub fn authenticate_immediately(&mut self) {
        self.authenticate();
    }

    pub fn refresh_code(&mut self) {
        self.state = SessionState::AwaitingCode;
        self.pending = generate_code();
        self.send_challenge();
    }

    pub fn handle_auth_code(&mut self, code: &str) -> CodeValidation {
        if self.state != SessionState::AwaitingCode {
            return CodeValidation::MaxAttempts;
        }
        let result = validate_code(&mut self.pending, code);
        match result {
            CodeValidation::Valid => self.authenticate(),
            CodeValidation::Expired => self.send(&json!({ "type": "auth:expired" })),
            CodeValidation::MaxAttempts => self.send(&json!({ "type": "auth:rejected" })),
            CodeValidation::Invalid => {
                self.send(&json!({ "type": "auth:failed", "attemptsRemaining": self.remaining_attempts() }))
            }
        }
        result
    }

    pub fn send_challenge(&self) {
        self.send(&json!({ "type": "auth:challenge", "expiresIn": self.code_expires_in_ms() }));
    }

    pub fn send(&self, message: &Json) {
        self.send_text(message.to_string());
    }

    pub fn send_text(&self, text: String) {
        let _ = self.tx.send(Outgoing::Text(text));
    }

    pub fn close(&self) {
        let _ = self.tx.send(Outgoing::Close);
    }
}
