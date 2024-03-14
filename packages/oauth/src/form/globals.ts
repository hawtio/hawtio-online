export const FORM_AUTH_PROTOCOL_MODULE = 'hawtio-form-auth'

export const FORM_TOKEN_STORAGE_KEY = 'online.oauth.form.token'

export interface FormConfig {
  uri: string
}

export type User = {
  username: string
  isLogin: boolean
}

export type ResolveUser = (user: User) => void
