import { IJmxMBean, IJmxOperation, IRequest } from "jolokia.js"

// TODO must be an easier and less verbose way for this
const METHODS = [
  'GET', 'POST', 'OPTIONS', 'HEAD', 'PROPFIND', 'PUT', 'MKCOL',
  'DELETE', 'COPY', 'MOVE', 'PROPPATCH', 'LOCK', 'PATCH', 'TRACE'
]

export type MethodType =
  'GET' |'POST' | 'OPTIONS' | 'HEAD' | 'PROPFIND' | 'PUT' | 'MKCOL' |
  'DELETE' | 'COPY' | 'MOVE' | 'PROPPATCH' | 'LOCK' | 'PATCH' | 'TRACE'

export function isRequestMethod(method: string): method is MethodType {
  return METHODS.includes(method.toUpperCase())
}

export function isObject(value: unknown): value is object {
  const type = typeof value
  return value != null && (type === 'object' || type === 'function')
}

export function isString(value: unknown): value is string {
  return typeof value === 'string' || value instanceof String
}

export interface InterceptedResponse {
  status: number,
  request: IRequest,
  value?: unknown,
  timestamp?: number,
  reason?: string
}

export interface Intercepted {
  intercepted: boolean,
  request: IRequest,
  response?: InterceptedResponse
}

export interface BulkValue {
  CanInvoke: boolean,
  Method: string,
  ObjectName: string
}

export interface ACLCheck {
  allowed: boolean,
  reason: string
}

// Taken from hawtio/next
export interface OptimisedJmxMBean extends IJmxMBean {
  opByString?: { [name: string]: IJmxOperation }
}
