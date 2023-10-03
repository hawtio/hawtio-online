export const moduleName = 'hawtio-oauth-form'

export interface FormConfig {
  uri: string
}

export type User = {
  username: string
  isLogin: boolean
}

export type ResolveUser = (user: User) => void
