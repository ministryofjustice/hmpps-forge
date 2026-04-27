declare module 'express-session' {
  // Declare that the session will potentially contain these additional fields
  interface SessionData {
    returnTo: string
  }
}

declare global {
  namespace Express {
    interface Request {
      id: string
    }
  }
}

export {}
