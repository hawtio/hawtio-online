import { UserProfile } from '@hawtio/online-oauth'
import { Logger } from '@hawtio/react'

export const pluginName = 'KubernetesAPI'
export const log = Logger.get('hawtio-k8s-api')

export let K8S_PREFIX = 'api'
export const OS_PREFIX = 'apis'
export const K8S_EXT_PREFIX = 'apis/extensions'

export const K8S_API_VERSION = 'v1'
export const OS_API_VERSION = 'v1'
export const K8S_EXT_VERSION = 'v1beta1'
