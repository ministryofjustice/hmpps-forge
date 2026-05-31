export interface CookieOptions {
  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  path?: string
  domain?: string
}

export interface CookieMutation {
  value: string
  options?: CookieOptions
}
