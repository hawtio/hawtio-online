import { Logger } from '@hawtio/react'

export const log = Logger.get('hawtio-oauth')
export const PATH_OSCONSOLE_CLIENT_CONFIG = 'osconsole/config.json'
export const LOGOUT_ENDPOINT = '/auth/logout'

// Kinds identified for the master cluster
export const OPENSHIFT_MASTER_KIND = 'OPENSHIFT'
export const KUBERNETES_MASTER_KIND = 'KUBERNETES'
